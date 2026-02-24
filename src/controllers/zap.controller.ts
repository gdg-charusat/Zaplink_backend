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

    res.status(201).json(
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

    await prisma.zap.update({
      where: { shortId },
      data: { viewCount: zap.viewCount + 1 },
    });

    if (zap.originalUrl?.startsWith("TEXT_CONTENT:")) {
      const text = decryptText(zap.originalUrl.substring(13));
      if (req.headers.accept?.includes("text/html")) {
        res.send(generateTextHtml(zap.name, text));
        return;
      }
      res.json({ content: text, type: "text" });
      return;
    }

    if (zap.cloudUrl) {
      res.redirect(zap.cloudUrl);
      return;
    }

    res.status(500).json(new ApiError(500, "Zap content missing"));
    return;
  } catch (err) {
    res.status(500).json(new ApiError(500, "Internal server error"));
    return;
  }
};

export const getZapMetadata = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const shortId: string = req.params.shortId as string;

    const zap = await prisma.zap.findUnique({
      where: { shortId },
      select: {
        name: true,
        type: true,
        quizQuestion: true,
        unlockAt: true,
        passwordHash: true,
        viewCount: true,
        viewLimit: true,
        expiresAt: true,
      },
    });

    if (!zap) {
      res.status(404).json(new ApiError(404, "Zap not found."));
      return;
    }

    const now = new Date();

    // Check if expired
    if (zap.expiresAt && now.getTime() > new Date(zap.expiresAt).getTime()) {
      res.status(410).json(new ApiError(410, "This Zap has expired."));
      return;
    }

    // Check if view limit exceeded
    if (zap.viewLimit && zap.viewCount >= zap.viewLimit) {
      res
        .status(410)
        .json(new ApiError(410, "View limit for this Zap has been exceeded."));
      return;
    }

    res.status(200).json(
      new ApiResponse(
        200,
        {
          name: zap.name,
          type: zap.type,
          hasQuizProtection: !!zap.quizQuestion,
          quizQuestion: zap.quizQuestion || undefined,
          hasDelayedAccess: !!zap.unlockAt,
          isDelayedLocked: zap.unlockAt
            ? now.getTime() < new Date(zap.unlockAt).getTime()
            : false,
          unlockAt: zap.unlockAt,
          hasPasswordProtection: !!zap.passwordHash,
          viewsRemaining: zap.viewLimit
            ? Math.max(0, zap.viewLimit - zap.viewCount)
            : null,
        },
        "Zap metadata retrieved successfully.",
      ),
    );
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

/**
 * Verify quiz answer for a Zap
 * Returns a token if correct, which can be used in subsequent requests
 */
export const verifyQuizForZap = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const shortId: string = req.params.shortId as string;
    const { answer } = req.body;

    if (!answer || typeof answer !== "string") {
      res.status(400).json(new ApiError(400, "Answer is required."));
      return;
    }

    const zap = await prisma.zap.findUnique({
      where: { shortId },
      select: {
        quizQuestion: true,
        quizAnswerHash: true,
      },
    });

    if (!zap) {
      res.status(404).json(new ApiError(404, "Zap not found."));
      return;
    }

    if (!zap.quizQuestion || !zap.quizAnswerHash) {
      res
        .status(400)
        .json(new ApiError(400, "This Zap does not have quiz protection."));
      return;
    }

    const isCorrect = await verifyQuizAnswer(answer, zap.quizAnswerHash);

    if (!isCorrect) {
      res
        .status(401)
        .json(new ApiError(401, "Incorrect answer. Please try again."));
      return;
    }

    // Return success with quiz verified flag
    res.status(200).json(
      new ApiResponse(
        200,
        {
          verified: true,
          quizCorrect: true,
        },
        "Quiz answer verified successfully.",
      ),
    );
  } catch (error) {
    console.error("verifyQuizForZap Error:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};
