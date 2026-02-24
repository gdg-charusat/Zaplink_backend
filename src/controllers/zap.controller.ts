import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import prisma from "../utils/prismClient";
import cloudinary from "../middlewares/cloudinary";
import {
  clearZapPasswordAttemptCounter,
  registerInvalidZapPasswordAttempt,
} from "../middlewares/rateLimiter";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { validatePasswordStrength } from "../utils/passwordValidator";
import { compressPDF } from "../utils/pdfCompressor";
import { encryptText, decryptText } from "../utils/encryption";
import dotenv from "dotenv";
import mammoth from "mammoth";
import * as path from "path";
import fs from "fs";
import {
  hasQuizProtection,
  verifyQuizAnswer,
  hashQuizAnswer,
} from "../utils/accessControl";
import { deleteFromCloudinary } from "../utils/cloudinaryHelper";

dotenv.config();

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  8,
);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/* ------------------------ TEXT HTML RENDERER ------------------------ */
const generateTextHtml = (title: string | null, content: string) => {
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
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #111827;
      color: #e5e7eb;
      padding: 20px;
    }
    .container {
      background: #1f2937;
      padding: 24px;
      border-radius: 12px;
    }
    h1 {
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 10px;
    }
    .content {
      white-space: pre-wrap;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escape(title || "Untitled")}</h1>
    <div class="content">${escape(content)}</div>
  </div>
</body>
</html>`;
};

/* ------------------------ TYPE MAP ------------------------ */
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

/* ======================== CREATE ZAP ======================== */
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
      quizQuestion,
      quizAnswer,
      delayedAccessTime,
      compress,
    } = req.body;

    const file = req.file;

    if (!file && !originalUrl && !textContent) {
      res
        .status(400)
        .json(new ApiError(400, "File, URL, or text is required."));
      return;
    }

    /* 🔐 Password strength validation */
    if (password) {
      const result = validatePasswordStrength(password);
      if (!result.isValid) {
        res
          .status(400)
          .json(new ApiError(400, "Weak password", result.errors));
        return;
      }
    }

    // ── Input validation ──────────────────────────────────────────────────
    const parsedViewLimit =
      viewLimit !== undefined && viewLimit !== null && viewLimit !== ""
        ? parseInt(viewLimit, 10)
        : null;
    if (parsedViewLimit !== null && (isNaN(parsedViewLimit) || parsedViewLimit < 1)) {
      return res
        .status(400)
        .json(new ApiError(400, "viewLimit must be a positive integer."));
    }

    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) {
        return res
          .status(400)
          .json(new ApiError(400, "expiresAt must be a valid date string."));
      }
    }

    const shortId = nanoid();
    const zapId = nanoid();
    const deletionToken = customAlphabet(
      "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      32
    )();
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const quizAnswerHash =
      quizQuestion && quizAnswer ? await hashQuizAnswer(quizAnswer) : null;

    let unlockAt: Date | null = null;
    if (delayedAccessTime) {
      unlockAt = new Date(Date.now() + delayedAccessTime * 1000);
    }

    let cloudUrl: string | null = null;
    let contentToStore: string | null = null;

    /* ---------------- FILE HANDLING ---------------- */
    if (file) {
      let filePath = file.path;
      const ext = path.extname(file.originalname).toLowerCase();

      /* PDF Compression */
      if (ext === ".pdf" && compress) {
        const compressedPath = filePath.replace(".pdf", "_compressed.pdf");
        try {
          await compressPDF(filePath, compressedPath);
          filePath = compressedPath;
        } catch {
          /* fallback */
        }
      }

      const upload = await cloudinary.uploader.upload(filePath, {
        folder: "zaplink_folders",
        resource_type:
          type === "image" ? "image" : type === "video" ? "video" : "raw",
      } as any);

      cloudUrl = upload.secure_url;
      await fs.promises.unlink(filePath).catch(() => {});

      /* DOC / PPT text extraction */
      if (ext === ".docx") {
        const result = await mammoth.extractRawText({ path: filePath });
        contentToStore = `DOCX_CONTENT:${encryptText(result.value)}`;
      }
    }

    if (textContent) {
      contentToStore = `TEXT_CONTENT:${encryptText(textContent)}`;
    }

    if (originalUrl) {
      cloudUrl = originalUrl;
      contentToStore = originalUrl;
    }

    let validatedExpiresAt: Date | null = null;

    if (expiresAt !== undefined && expiresAt !== null) {
      const rawExpiresAt =
        typeof expiresAt === "string" ? expiresAt.trim() : String(expiresAt).trim();

      if (!rawExpiresAt) {
        return res
          .status(400)
          .json(new ApiError(400, "Invalid expiresAt format."));
      }

      const parsedExpiresAt = new Date(rawExpiresAt);

      if (Number.isNaN(parsedExpiresAt.getTime())) {
        return res
          .status(400)
          .json(new ApiError(400, "Invalid expiresAt format."));
      }

      if (parsedExpiresAt.getTime() <= Date.now()) {
        return res
          .status(400)
          .json(new ApiError(400, "expiresAt must be a future timestamp."));
      }

      validatedExpiresAt = parsedExpiresAt;
    }

    const zap = await prisma.zap.create({
      data: {
        type: mapTypeToPrismaEnum(type),
        name,
        cloudUrl,
        originalUrl: contentToStore,
        shortId,
        passwordHash: hashedPassword,
        viewLimit: viewLimit ? parseInt(viewLimit) : null,
        expiresAt: validatedExpiresAt,
        qrId: zapId,
        passwordHash,
        viewLimit: viewLimit ? Number(viewLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        deletionToken,
        quizQuestion,
        quizAnswerHash,
        unlockAt,
      },
    });

    const shortUrl = `${FRONTEND_URL}/zaps/${shortId}`;
    const qrCode = await QRCode.toDataURL(shortUrl);

    res.status(201).json(
      new ApiResponse(
        201,
        {
          zapId,
          shortUrl,
          qrCode,
          type,
          name,
          deletionToken,
          hasQuizProtection: !!quizQuestion,
          hasDelayedAccess: !!unlockAt,
        },
        "Zap created successfully",
      ),
    );
    return;
  } catch (err) {
    console.error("CreateZap Error:", err);
    res.status(500).json(new ApiError(500, "Internal server error"));
    return;
  }
};

/* ======================== GET ZAP ======================== */
export const getZapByShortId = async (req: Request, res: Response) => {
  try {
    const { shortId } = req.params;
    const quizAnswer = req.query.quizAnswer as string | undefined;

    const zap = await prisma.zap.findUnique({ where: { shortId } });

    if (!zap) {
      res.status(404).json(new ApiError(404, "Zap not found"));
      return;
    }

    /* Password check */
    if (zap.passwordHash) {
      const pwd = req.query.password as string;
      if (!pwd || !(await bcrypt.compare(pwd, zap.passwordHash))) {
        res.status(401).json(new ApiError(401, "Invalid password"));
        return;
      }
      clearZapPasswordAttemptCounter(req, shortId);
    }

    /* Quiz check */
    if (hasQuizProtection(zap)) {
      if (
        !quizAnswer ||
        !(await verifyQuizAnswer(quizAnswer, zap.quizAnswerHash!))
      ) {
        res
          .status(401)
          .json(new ApiError(401, "Quiz verification failed"));
        return;
      }
    }

    // Password-protected zaps require POST request with password in body
    if (zap.passwordHash) {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}`);
      }
      res.status(401).json(new ApiError(401, "Password required. Use POST /api/zaps/:shortId/access with password in request body."));
      return;
    }
    const updatedZap = await prisma.zap.update({
      where: { shortId },
      data: { viewCount: zap.viewCount + 1 },
    });

    if (
      updatedZap.viewLimit !== null &&
      updatedZap.viewCount > updatedZap.viewLimit
    ) {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=viewlimit`);
      }
      res.status(410).json(new ApiError(410, "Zap view limit reached."));
      return;
    }

    if (zap.originalUrl) {
      if (
        zap.originalUrl.startsWith("http://") ||
        zap.originalUrl.startsWith("https://")
      ) {
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          res.redirect(zap.originalUrl);
        } else {
          res.json({ url: zap.originalUrl, type: "redirect" });
        }
      } else if (zap.originalUrl.startsWith("TEXT_CONTENT:")) {
        const textContent = zap.originalUrl.substring(13); 

        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          const html = generateTextHtml(zap.name || "Untitled", textContent);
          res.set("Content-Type", "text/html");
          res.send(html);
        } else {
          res.json({ content: textContent, type: "text", name: zap.name });
        }
      } else if (
        zap.originalUrl.startsWith("DOCX_CONTENT:") ||
        zap.originalUrl.startsWith("PPTX_CONTENT:")
      ) {
        const textContent = zap.originalUrl.substring(13); 
        return res.status(401).json(new ApiError(401, "Password required."));
      }

      const isPasswordValid = await bcrypt.compare(
        providedPassword,
        zap.passwordHash,
      );

        if (req.headers.accept && req.headers.accept.includes("text/html")) {
    
          const html = generateTextHtml(zap.name || "Untitled", textContent);
          res.set("Content-Type", "text/html");
          res.send(html);
        } else {
          res.json({ content: textContent, type: "document", name: zap.name });
        }
      } else {
 
        const base64Data = zap.originalUrl;
        const matches = base64Data.match(
          /^data:(image\/[a-zA-Z]+);base64,(.+)$/
        );
        if (matches) {
          const mimeType = matches[1];
          const base64 = matches[2];
          const buffer = Buffer.from(base64, "base64");

          if (req.headers.accept && req.headers.accept.includes("text/html")) {
            res.set("Content-Type", mimeType);
            res.send(buffer);
          } else {
            res.json({ data: base64Data, type: "image", name: zap.name });
          }
        } else {
          res.status(400).json({ error: "Invalid base64 image data" });
        }
      }
    } else if (zap.cloudUrl) {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        res.redirect(zap.cloudUrl);
      } else {
        res.json({ url: zap.cloudUrl, type: "file" });
      }
    } else {
      res.status(500).json(new ApiError(500, "Zap content not found."));
    }
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

export const verifyZapPassword = async (req: Request, res: Response) => {
  try {
    const shortId: string = req.params.shortId as string;
    const { password } = req.body;

    const zap = await prisma.zap.findUnique({
      where: { shortId },
    });

    if (!zap) {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=notfound`);
          return res.redirect(
            `${FRONTEND_URL}/zaps/${shortId}?error=incorrect_password`,
          );
        }
        return res.status(401).json(new ApiError(401, "Incorrect password."));
      }
      res.status(404).json(new ApiError(404, "Zap not found."));
      return;
    }

    if (zap.expiresAt) {
      const expirationTime = new Date(zap.expiresAt);
      const currentTime = new Date();

      if (currentTime.getTime() > expirationTime.getTime()) {
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=expired`);
      }
    }

    if (zap.viewLimit !== null && zap.viewCount >= zap.viewLimit) {
      return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=viewlimit`);
    }

    if (!zap.passwordHash) {
      res.status(400).json(new ApiError(400, "This Zap is not password-protected."));
      return;
    }

    if (!password) {
      res.status(400).json(new ApiError(400, "Password is required in request body."));
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, zap.passwordHash);

    if (!isPasswordValid) {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.redirect(
          `${FRONTEND_URL}/zaps/${shortId}?error=incorrect_password`
        );
      }
      res.status(401).json(new ApiError(401, "Incorrect password."));
      return;
    }

    const updatedZap = await prisma.zap.update({
      where: { shortId },
      data: { viewCount: zap.viewCount + 1 },
    });

    const updateResult = await prisma.$executeRaw`
      UPDATE "Zap"
      SET "viewCount" = "viewCount" + 1, "updatedAt" = NOW()
      WHERE "shortId" = ${shortId}
        AND ("viewLimit" IS NULL OR "viewCount" < "viewLimit")
    `;

    if (updateResult === 0) {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=viewlimit`);
      }
      return res.status(410).json(new ApiError(410, "Zap view limit reached."));
    }

    if (zap.originalUrl) {
      if (
        zap.originalUrl.startsWith("http://") ||
        zap.originalUrl.startsWith("https://")
      ) {
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          return res.redirect(zap.originalUrl);
        } else {
          return res.json({ url: zap.originalUrl, type: "redirect" });
        }
      } else if (zap.originalUrl.startsWith("TEXT_CONTENT:")) {
        const textContent = zap.originalUrl.substring(13);
        try {
          const encryptedContent = zap.originalUrl.substring(13);
          // Decrypt text content before serving
          const textContent = decryptText(encryptedContent);

          if (req.headers.accept && req.headers.accept.includes("text/html")) {
            const html = generateTextHtml(zap.name || "Untitled", textContent);
            res.set("Content-Type", "text/html");
            return res.send(html);
          } else {
            return res.json({
              content: textContent,
              type: "text",
              name: zap.name,
            });
          }
        } catch (decryptError) {
          console.error("Failed to decrypt text content:", decryptError);
          return res
            .status(500)
            .json(
              new ApiError(
                500,
                "Failed to retrieve text content. Data may be corrupted.",
              ),
            );
        }
      } else if (
        zap.originalUrl.startsWith("DOCX_CONTENT:") ||
        zap.originalUrl.startsWith("PPTX_CONTENT:")
      ) {
        const textContent = zap.originalUrl.substring(13);

        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          const html = generateTextHtml(zap.name || "Untitled", textContent);
          res.set("Content-Type", "text/html");
          res.send(html);
        } else {
          res.json({ content: textContent, type: "document", name: zap.name });
        try {
          const encryptedContent = zap.originalUrl.substring(13);
          // Decrypt document content before serving
          const textContent = decryptText(encryptedContent);

          if (req.headers.accept && req.headers.accept.includes("text/html")) {
            const html = generateTextHtml(zap.name || "Untitled", textContent);
            res.set("Content-Type", "text/html");
            return res.send(html);
          } else {
            return res.json({
              content: textContent,
              type: "document",
              name: zap.name,
            });
          }
        } catch (decryptError) {
          console.error("Failed to decrypt document content:", decryptError);
          return res
            .status(500)
            .json(
              new ApiError(
                500,
                "Failed to retrieve document content. Data may be corrupted.",
              ),
            );
        }
      } else {
        const base64Data = zap.originalUrl;
        const matches = base64Data.match(
          /^data:(image\/[a-zA-Z]+);base64,(.+)$/,
        );
        if (matches) {
          const mimeType = matches[1];
          const base64 = matches[2];
          const buffer = Buffer.from(base64, "base64");

          if (req.headers.accept && req.headers.accept.includes("text/html")) {
            res.set("Content-Type", mimeType);
            return res.send(buffer);
          } else {
            return res.json({
              data: base64Data,
              type: "image",
              name: zap.name,
            });
          }
        } else {
          return res.status(400).json({ error: "Invalid base64 image data" });
        }
      }
    } else if (zap.cloudUrl) {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.redirect(zap.cloudUrl);
      } else {
        return res.json({ url: zap.cloudUrl, type: "file" });
      }
    } else {
      return res.status(500).json(new ApiError(500, "Zap content not found."));
    }
  } catch (error) {
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};
