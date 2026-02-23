import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import prisma from "../utils/prismClient";
import cloudinary from "../middlewares/cloudinary";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { compressPDF } from "../utils/pdfCompressor";
import { encryptText, decryptText } from "../utils/encryption";
import { deleteFromCloudinary } from "../utils/cloudinaryHelper";
import dotenv from "dotenv";
import mammoth from "mammoth";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

dotenv.config();

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  8
);

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

/* -------------------------------------------------------------------------- */
/*                                HTML GENERATOR                              */
/* -------------------------------------------------------------------------- */

const generateTextHtml = (title: string, content: string) => {
  const escape = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escape(title || "Untitled")}</title>
</head>
<body>
  <h1>${escape(title || "Untitled")}</h1>
  <pre>${escape(content)}</pre>
</body>
</html>`;
};

/* -------------------------------------------------------------------------- */
/*                              HELPER FUNCTIONS                               */
/* -------------------------------------------------------------------------- */

const mapTypeToPrismaEnum = (type: string) => {
  const map: Record<string, any> = {
    pdf: "PDF",
    image: "IMAGE",
    video: "VIDEO",
    audio: "AUDIO",
    archive: "ZIP",
    url: "URL",
    text: "TEXT",
    document: "WORD",
    presentation: "PPT",
  };
  return map[type?.toLowerCase()] || "UNIVERSAL";
};

/* -------------------------------------------------------------------------- */
/*                                  CREATE ZAP                                 */
/* -------------------------------------------------------------------------- */

export const createZap = async (req: Request, res: Response) => {
  try {
    const {
      type,
      name,
      originalUrl,
      textContent,
      password,
      viewLimit,
      expiresAt,
      compress,
    } = req.body;

    const file = req.file;

    if (!file && !originalUrl && !textContent) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "Either a file, URL, or text content must be provided."
          )
        );
    }

    const shortId = nanoid();
    const zapId = nanoid();
    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : null;

    let uploadedUrl: string | null = null;
    let contentToStore: string | null = null;

    /* ----------------------------- FILE HANDLING ---------------------------- */
    if (file) {
      const rawFilePath = file.path;
      const resolvedPath = path.resolve(rawFilePath);
      const safeTempDir = path.resolve(os.tmpdir()) + path.sep;

      /* 🔐 PATH TRAVERSAL PROTECTION */
      if (!resolvedPath.startsWith(safeTempDir)) {
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              "Invalid file path. File must be inside the upload directory."
            )
          );
      }

      let finalPath = resolvedPath;
      const ext = path.extname(file.originalname).toLowerCase();
      const shouldCompress =
        compress === true || compress === "true" || compress === "1";

      if (ext === ".pdf" && shouldCompress) {
        const compressedPath = path.join(
          path.dirname(finalPath),
          `${path.basename(finalPath, ".pdf")}_compressed.pdf`
        );
        try {
          await compressPDF(finalPath, compressedPath);
          finalPath = compressedPath;
        } catch {
          // fallback to original
        }
      }

      const upload = await cloudinary.uploader.upload(finalPath, {
        folder: "zaplink_folders",
        resource_type:
          type === "image" ? "image" : type === "video" ? "video" : "raw",
      });

      uploadedUrl = upload.secure_url;

      /* ----------------------- DOCUMENT TEXT EXTRACTION ---------------------- */
      if (ext === ".docx") {
        const result = await mammoth.extractRawText({
          path: finalPath,
        });
        const encrypted = encryptText(result.value);
        contentToStore = `DOCX_CONTENT:${encrypted}`;
      }

      await fs.promises.unlink(finalPath).catch(() => {});
    }

    /* ----------------------------- URL HANDLING ----------------------------- */
    else if (originalUrl) {
      if (!/^https?:\/\//i.test(originalUrl)) {
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              "Invalid URL. Only http and https are allowed."
            )
          );
      }
      uploadedUrl = originalUrl;
      contentToStore = originalUrl;
    }

    /* ----------------------------- TEXT HANDLING ---------------------------- */
    else if (textContent) {
      const encrypted = encryptText(textContent);
      contentToStore = `TEXT_CONTENT:${encrypted}`;
    }

    const zap = await prisma.zap.create({
      data: {
        type: mapTypeToPrismaEnum(type),
        name,
        cloudUrl: uploadedUrl,
        originalUrl: contentToStore,
        qrId: zapId,
        shortId,
        passwordHash: hashedPassword,
        viewLimit: viewLimit ? parseInt(viewLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    const shortUrl = `${FRONTEND_URL}/zaps/${shortId}`;
    const qrCode = await QRCode.toDataURL(shortUrl);

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { zapId, shortUrl, qrCode },
          "Zap created successfully"
        )
      );
  } catch (err) {
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error"));
  }
};

/* -------------------------------------------------------------------------- */
/*                              GET ZAP BY ID                                  */
/* -------------------------------------------------------------------------- */

export const getZapByShortId = async (req: Request, res: Response) => {
  try {
    const zap = await prisma.zap.findUnique({
      where: { shortId: req.params.shortId },
    });

    if (!zap) {
      return res.status(404).json(new ApiError(404, "Zap not found"));
    }

    if (zap.passwordHash) {
      const password = req.query.password as string;
      if (!password || !(await bcrypt.compare(password, zap.passwordHash))) {
        return res
          .status(401)
          .json(new ApiError(401, "Invalid password"));
      }
    }

    if (zap.originalUrl?.startsWith("TEXT_CONTENT:")) {
      const decrypted = decryptText(zap.originalUrl.substring(13));
      return res.send(
        generateTextHtml(zap.name || "Untitled", decrypted)
      );
    }

    if (zap.originalUrl?.startsWith("DOCX_CONTENT:")) {
      const decrypted = decryptText(zap.originalUrl.substring(13));
      return res.send(
        generateTextHtml(zap.name || "Untitled", decrypted)
      );
    }

    if (zap.cloudUrl) {
      return res.redirect(zap.cloudUrl);
    }

    return res
      .status(500)
      .json(new ApiError(500, "Zap content not found"));
  } catch {
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error"));
  }
};