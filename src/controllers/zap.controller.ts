import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import prisma from "../utils/prismClient";
import cloudinary from "../middlewares/cloudinary";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { encryptText, decryptText } from "../utils/encryption";
import {
  hasQuizProtection,
  verifyQuizAnswer,
  hashQuizAnswer,
} from "../utils/accessControl";
import { clearZapPasswordAttemptCounter } from "../middlewares/rateLimiter";
import dotenv from "dotenv";
import mammoth from "mammoth";
import { fileTypeFromBuffer } from "file-type"; // T066 Security
import { validatePasswordStrength } from "../utils/passwordValidator";
import {
  sanitizeText,
  sanitizeUrl,
  sanitizeQuizInput,
  sanitizeFileName,
  isSuspiciousInput,
} from "../utils/sanitizer";

dotenv.config();

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  8,
);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const mapTypeToPrismaEnum = (type: string): any => {
  const typeMap: any = {
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
  return typeMap[type?.toLowerCase()] || "UNIVERSAL";
};

export const createZap = async (req: Request, res: Response): Promise<void> => {
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
    } = req.body;
    const file = req.file;

    if (!file && !originalUrl && !textContent) {
      res.status(400).json(new ApiError(400, "Provide a file, URL, or text."));
      return;
    }

    // INPUT SANITIZATION
    if (
      isSuspiciousInput(name) ||
      isSuspiciousInput(quizQuestion) ||
      isSuspiciousInput(textContent)
    ) {
      res
        .status(400)
        .json(
          new ApiError(400, "Input contains potentially malicious content."),
        );
      return;
    }

    // Sanitize text inputs
    const sanitizedName = name ? sanitizeText(name) : "Untitled Zap";
    const sanitizedQuizQuestion = quizQuestion
      ? sanitizeQuizInput(quizQuestion)
      : null;
    const sanitizedQuizAnswer = quizAnswer
      ? sanitizeQuizInput(quizAnswer)
      : null;
    const sanitizedTextContent = textContent
      ? sanitizeText(textContent)
      : null;
    const sanitizedUrl = originalUrl ? sanitizeUrl(originalUrl) : null;

    // Validate sanitized inputs
    if (
      originalUrl &&
      !sanitizedUrl
    ) {
      res
        .status(400)
        .json(new ApiError(400, "Invalid or unsafe URL provided."));
      return;
    }

    if (quizQuestion && !sanitizedQuizQuestion) {
      res
        .status(400)
        .json(new ApiError(400, "Invalid quiz question."));
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

    const parsedViewLimit =
      viewLimit !== undefined && viewLimit !== null && viewLimit !== ""
        ? parseInt(viewLimit, 10)
        : null;
    if (parsedViewLimit !== null && (isNaN(parsedViewLimit) || parsedViewLimit < 1)) {
      res
        .status(400)
        .json(new ApiError(400, "viewLimit must be a positive integer."));
      return;
    }

    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) {
        res
          .status(400)
          .json(new ApiError(400, "Invalid expiresAt format."));
        return;
      }
      // Ensure expiresAt is in the future
      if (parsedExpiresAt.getTime() <= Date.now()) {
        res
          .status(400)
          .json(new ApiError(400, "expiresAt must be a future timestamp."));
        return;
      }
    }

    const shortId = nanoid();
    const zapId = nanoid();
    const deletionToken = nanoid();
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const hashedQuizAnswer =
      sanitizedQuizQuestion && sanitizedQuizAnswer
        ? await hashQuizAnswer(sanitizedQuizAnswer)
        : null;

    let unlockAt: Date | null = null;
    if (delayedAccessTime) {
      unlockAt = new Date(Date.now() + Number(delayedAccessTime) * 1000);
    }

    let uploadedUrl: string | null = null;
    let contentToStore: string | null = null;

    if (file) {
      // --- TEAM T066: SECURITY VALIDATION ---
      const detectedType = await fileTypeFromBuffer(file.buffer);
      const providedExt =
        file.originalname.split(".").pop()?.toLowerCase() || "";

      if (!detectedType) {
        res
          .status(415)
          .json(new ApiError(415, "Unknown file signature. Upload blocked."));
        return;
      }

      const actualExt = detectedType.ext as string;
      const claimExt = providedExt as string;
      const isJpeg =
        (actualExt === "jpg" || actualExt === "jpeg") &&
        (claimExt === "jpg" || claimExt === "jpeg");

      if (actualExt !== claimExt && !isJpeg) {
        res
          .status(400)
          .json(
            new ApiError(
              400,
              `MIME Spoofing Detected! Content is ${actualExt}, claims ${providedExt}.`,
            ),
          );
        return;
      }

      const sanitizedFileName = sanitizeFileName(file.originalname);

      // --- SECURE CLOUDINARY UPLOAD ---
      const cloudinaryResponse: any = await new Promise((resolve, reject) => {
        const uniquePublicId = `${sanitizedFileName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "zaplink_folders",
            resource_type: "auto",
            public_id: uniquePublicId,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        uploadStream.end(file.buffer);
      });
      uploadedUrl = cloudinaryResponse.secure_url;

      if (type === "document" && providedExt === "docx") {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        contentToStore = `DOCX_CONTENT:${encryptText(result.value)}`;
      }
    } else if (sanitizedUrl) {
      uploadedUrl = sanitizedUrl;
      contentToStore = sanitizedUrl;
    } else if (sanitizedTextContent) {
      contentToStore = `TEXT_CONTENT:${encryptText(sanitizedTextContent)}`;
    }

    const zap = await prisma.zap.create({
      data: {
        type: mapTypeToPrismaEnum(type),
        name: sanitizedName,
        cloudUrl: uploadedUrl,
        originalUrl: contentToStore,
        qrId: zapId,
        shortId,
        deletionToken,
        passwordHash: hashedPassword,
        viewLimit: viewLimit ? parseInt(viewLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        quizQuestion: sanitizedQuizQuestion,
        quizAnswerHash: hashedQuizAnswer,
        unlockAt: unlockAt,
      },
    });

    const domain = process.env.BASE_URL || "http://localhost:5000";
    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { zapId, shortUrl: `${domain}/api/zaps/${shortId}` },
          "Zap created.",
        ),
      );
  } catch (err) {
    console.error("createZap error:", err);
    res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const verifyZapPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

export const destroyZap = async (shortIds: string[]) => {
  try {
    await prisma.zap.deleteMany({
      where: {
        shortId: { in: shortIds },
      },
    });
  } catch (err) {
    console.error("DestroyZap Error:", err);
    throw new Error("Failed to destroy Zap");
  }
};

export const getZapByShortId = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { shortId } = req.params;
    const { password, quizAnswer } = req.query;
    const zap = await prisma.zap.findUnique({ where: { shortId } });

    if (!zap) {
      res.status(404).json(new ApiError(404, "Zap not found."));
      return;
    }

    if (zap.unlockAt && new Date() < new Date(zap.unlockAt)) {
      res.status(423).json(new ApiError(423, "File is currently locked."));
      return;
    }
    if (hasQuizProtection(zap)) {
      if (
        !quizAnswer ||
        !(await verifyQuizAnswer(quizAnswer as string, zap.quizAnswerHash!))
      ) {
        res.status(401).json(new ApiError(401, "Incorrect quiz answer."));
        return;
      }
    }
    if (zap.passwordHash) {
      if (
        !password ||
        !(await verifyZapPassword(password as string, zap.passwordHash))
      ) {
        res.status(401).json(new ApiError(401, "Invalid password."));
        return;
      }
      clearZapPasswordAttemptCounter(req, shortId);
    }

    await prisma.zap.update({
      where: { shortId },
      data: { viewCount: { increment: 1 } },
    });
    res.json(new ApiResponse(200, zap, "Success"));
  } catch (error) {
    console.error("verifyQuizForZap Error:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

export const shortenUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;

    // Validate URL presence
    if (!url || typeof url !== "string") {
      res.status(400).json(new ApiError(400, "URL is required."));
      return;
    }

    // Validate URL format - allow http, https, data URIs and other common schemes
    const urlPattern = /^(https?:\/\/|data:|ftp:\/\/|ftps:\/\/|mailto:|tel:|file:\/\/)/i;
    if (!urlPattern.test(url.trim())) {
      res.status(400).json(new ApiError(400, "Invalid URL format. URL must start with http://, https://, data:, or other valid scheme."));
      return;
    }

    // Check URL length to prevent abuse
    if (url.length > 10000) {
      res.status(400).json(new ApiError(400, "URL is too long. Maximum length is 10000 characters."));
      return;
    }

    // Generate unique short ID
    const shortId = nanoid();
    const zapId = nanoid();

    // Create Zap with URL type
    const zap = await prisma.zap.create({
      data: {
        type: "URL",
        name: url.length > 50 ? url.substring(0, 47) + "..." : url,
        cloudUrl: url,
        originalUrl: url,
        shortId,
        qrId: zapId,
        passwordHash: null,
        viewLimit: null,
        expiresAt: null,
        quizQuestion: null,
        quizAnswerHash: null,
        unlockAt: null,
      },
    });

    // Generate short URL and QR code
    const shortUrl = `${FRONTEND_URL}/zaps/${shortId}`;
    const qrCode = await QRCode.toDataURL(shortUrl);

    res.status(201).json(
      new ApiResponse(
        201,
        {
          zapId,
          shortUrl,
          qrCode,
          originalUrl: url,
          shortId,
        },
        "URL shortened successfully",
      ),
    );
  } catch (error) {
    console.error("shortenUrl Error:", error);
    res.status(500).json(new ApiError(500, "Failed to shorten URL. Please try again."));
  } 
};

export const getZapMetadata = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const zap = await prisma.zap.findUnique({
      where: { shortId: req.params.shortId },
    });
    if (!zap) {
      res.status(404).json(new ApiError(404, "Not found"));
      return;
    }
    res.json(
      new ApiResponse(
        200,
        {
          name: zap.name,
          quizQuestion: zap.quizQuestion,
          hasPassword: !!zap.passwordHash,
        },
        "Success",
      ),
    );
  } catch (e) {
    res.status(500).json(new ApiError(500, "Error"));
  }
};

export const verifyQuizForZap = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { shortId } = req.params;
    const { answer } = req.body;
    const zap = await prisma.zap.findUnique({ where: { shortId } });
    if (!zap || !zap.quizAnswerHash) {
      res.status(404).json(new ApiError(404, "No quiz"));
      return;
    }
    const isCorrect = await verifyQuizAnswer(answer, zap.quizAnswerHash);
    res.json(
      new ApiResponse(
        isCorrect ? 200 : 401,
        { verified: isCorrect },
        isCorrect ? "Correct" : "Incorrect",
      ),
    );
  } catch (e) {
    res.status(500).json(new ApiError(500, "Error"));
  }
};
