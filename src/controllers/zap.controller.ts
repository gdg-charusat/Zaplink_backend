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
  8
);

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

/* ------------------------ TEXT HTML RENDERER ------------------------ */
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
      return res
        .status(400)
        .json(new ApiError(400, "File, URL, or text is required."));
    }

    /* 🔐 Password strength validation */
    if (password) {
      const result = validatePasswordStrength(password);
      if (!result.isValid) {
        return res
          .status(400)
          .json(new ApiError(400, "Weak password", result.errors));
      }
    }

    const shortId = nanoid();
    const zapId = nanoid();

    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : null;

    const quizAnswerHash =
      quizQuestion && quizAnswer
        ? await hashQuizAnswer(quizAnswer)
        : null;

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

    const zap = await prisma.zap.create({
      data: {
        type: mapTypeToPrismaEnum(type),
        name,
        cloudUrl,
        originalUrl: contentToStore,
        shortId,
        qrId: zapId,
        passwordHash,
        viewLimit: viewLimit ? Number(viewLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        quizQuestion,
        quizAnswerHash,
        unlockAt,
      },
    });

    const shortUrl = `${FRONTEND_URL}/zaps/${shortId}`;
    const qrCode = await QRCode.toDataURL(shortUrl);

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          zapId,
          shortUrl,
          qrCode,
          type,
          name,
          hasQuizProtection: !!quizQuestion,
          hasDelayedAccess: !!unlockAt,
        },
        "Zap created successfully"
      )
    );
  } catch (err) {
    console.error("CreateZap Error:", err);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

/* ======================== GET ZAP ======================== */
export const getZapByShortId = async (req: Request, res: Response) => {
  try {
    const { shortId } = req.params;
    const quizAnswer = req.query.quizAnswer as string | undefined;

    const zap = await prisma.zap.findUnique({ where: { shortId } });

    if (!zap) {
      return res.status(404).json(new ApiError(404, "Zap not found"));
    }

    /* Password check */
    if (zap.passwordHash) {
      const pwd = req.query.password as string;
      if (!pwd || !(await bcrypt.compare(pwd, zap.passwordHash))) {
        return res.status(401).json(new ApiError(401, "Invalid password"));
      }
      clearZapPasswordAttemptCounter(req, shortId);
    }

    /* Quiz check */
    if (hasQuizProtection(zap)) {
      if (!quizAnswer || !(await verifyQuizAnswer(quizAnswer, zap.quizAnswerHash!))) {
        return res.status(401).json(new ApiError(401, "Quiz verification failed"));
      }
    }

    await prisma.zap.update({
      where: { shortId },
      data: { viewCount: zap.viewCount + 1 },
    });

    if (zap.originalUrl?.startsWith("TEXT_CONTENT:")) {
      const text = decryptText(zap.originalUrl.substring(13));
      if (req.headers.accept?.includes("text/html")) {
        return res.send(generateTextHtml(zap.name, text));
      }
      return res.json({ content: text, type: "text" });
    }

    if (zap.cloudUrl) {
      return res.redirect(zap.cloudUrl);
    }

    return res.status(500).json(new ApiError(500, "Zap content missing"));
  } catch (err) {
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};