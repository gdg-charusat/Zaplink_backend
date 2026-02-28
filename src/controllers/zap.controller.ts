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
import * as path from "path";
import { validatePasswordStrength } from "../utils/passwordValidator";
import { logAccess } from "../services/analytics.service";

dotenv.config();

// ── TypeScript Interfaces ──────────────────────────────────────────────────
interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format: string;
  [key: string]: any;
}

interface TypeMap {
  [key: string]: "PDF" | "IMAGE" | "VIDEO" | "AUDIO" | "ZIP" | "URL" | "TEXT" | "WORD" | "PPT" | "UNIVERSAL";
}

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  8,
);

/**
 * Generate a unique ID with retry logic to prevent collisions
 * @param fieldName - The database field to check ('shortId' or 'qrId')
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @returns A unique ID string
 * @throws Error if unable to generate unique ID after max retries
 */
const generateUniqueId = async (
  fieldName: "shortId" | "qrId",
  maxRetries: number = 5
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const id = nanoid();

    // Check if this ID already exists in the database
    const existingZap = await prisma.zap.findUnique({
      where: fieldName === "shortId" ? { shortId: id } : { qrId: id },
      select: { id: true }, // Only select the ID field for efficiency
    });

    if (!existingZap) {
      return id; // ID is unique, return it
    }

    console.warn(
      `Collision detected for ${fieldName}: ${id} (attempt ${attempt}/${maxRetries})`
    );
  }

  // If we've exhausted all retries, throw an error
  throw new Error(
    `Failed to generate unique ${fieldName} after ${maxRetries} attempts. Service temporarily unavailable.`
  );
};

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Maps user-friendly type strings to Prisma ZapType enum values.
 * @param type - The type string to map (e.g., "pdf", "image", "document")
 * @returns The corresponding Prisma ZapType enum value
 */
const mapTypeToPrismaEnum = (type: string): "PDF" | "IMAGE" | "VIDEO" | "AUDIO" | "ZIP" | "URL" | "TEXT" | "WORD" | "PPT" | "UNIVERSAL" => {
  const typeMap: TypeMap = {
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

/**
 * Creates a new Zap (file/URL/text share) with optional security features.
 * 
 * @param req - Express request containing file, URL, or text content
 * @param res - Express response
 * 
 * Security Features:
 * - Password protection with strength validation
 * - View limit enforcement
 * - Expiration timestamps
 * - Quiz-based access control
 * - Delayed access (unlockAt)
 * - MIME type validation to prevent spoofing (T066)
 * 
 * @returns 201 with zapId and shortUrl on success, or appropriate error status
 */
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

    // Generate unique IDs with collision detection and retry logic
    let shortId: string;
    let zapId: string;
    
    try {
      shortId = await generateUniqueId("shortId");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Service temporarily unavailable")) {
        res.status(503).json(new ApiError(503, error.message));
        return;
      }
      throw error;
    }
    
    try {
      zapId = await generateUniqueId("qrId");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Service temporarily unavailable")) {
        res.status(503).json(new ApiError(503, error.message));
        return;
      }
      throw error;
    }
    
    const deletionToken = nanoid();

    if (password) {
      const validation = validatePasswordStrength(password);
      if (!validation.isValid) {
        res.status(400).json(
          new ApiError(400, "Password validation failed", validation.errors)
        );
        return;
      }
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const hashedQuizAnswer =
      quizQuestion && quizAnswer ? await hashQuizAnswer(quizAnswer) : null;

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

      // --- SECURE CLOUDINARY UPLOAD ---
      const cloudinaryResponse = await new Promise<CloudinaryUploadResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "zaplink_folders", resource_type: "auto" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result as CloudinaryUploadResponse);
          },
        );
        uploadStream.end(file.buffer);
      });
      uploadedUrl = cloudinaryResponse.secure_url;

      if (type === "document" && providedExt === "docx") {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        contentToStore = `DOCX_CONTENT:${encryptText(result.value)}`;
      }
    } else if (originalUrl) {
      uploadedUrl = originalUrl;
      contentToStore = originalUrl;
    } else if (textContent) {
      contentToStore = `TEXT_CONTENT:${encryptText(textContent)}`;
    }

    const zap = await prisma.zap.create({
      data: {
        type: mapTypeToPrismaEnum(type),
        name: name || "Untitled Zap",
        cloudUrl: uploadedUrl,
        originalUrl: contentToStore,
        qrId: zapId,
        shortId,
        deletionToken,
        passwordHash: hashedPassword,
        viewLimit: viewLimit ? parseInt(viewLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        quizQuestion: quizQuestion || null,
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
          {
            zapId,
            shortUrl: `${domain}/api/zaps/${shortId}`,
            deletionToken,
          },
          "Zap created.",
        ),
      );
  } catch (error) {
    console.error("Error in createZap:", error);
    
    // Handle Prisma unique constraint violations (P2002)
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      res.status(409).json(
        new ApiError(409, "Resource with this ID already exists. Please try again.")
      );
      return;
    }
    
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

/**
 * Verifies a password against its bcrypt hash.
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns True if password matches, false otherwise
 */
const verifyZapPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

/**
 * Permanently deletes Zaps by their shortIds.
 * Used by cleanup jobs for expired or view-limited Zaps.
 * 
 * @param shortIds - Array of shortId strings to delete
 * @throws Error if deletion fails
 */
export const destroyZap = async (shortIds: string[]) => {
  try {
    await prisma.zap.deleteMany({
      where: {
        shortId: { in: shortIds },
      },
    });
  } catch (error) {
    console.error("Error in destroyZap:", error);
    throw new Error("Failed to destroy Zap");
  }
};

/**
 * Retrieves a Zap by its shortId with full access control validation.
 * 
 * @param req - Express request with shortId param and optional password/quizAnswer query params
 * @param res - Express response
 * 
 * Access Controls (checked in order):
 * 1. Zap existence
 * 2. Expiration timestamp
 * 3. View limit (before increment to prevent over-limit access)
 * 4. Unlock timestamp (delayed access)
 * 5. Quiz answer validation
 * 6. Password verification
 * 
 * The view count is incremented atomically using a transaction to handle
 * concurrent requests safely and prevent race conditions.
 * 
 * @returns 200 with Zap data on success, or appropriate error status
 */
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

    // Check expiration
    if (zap.expiresAt && new Date() > zap.expiresAt) {
      res.status(410).json(new ApiError(410, "Zap has expired."));
      return;
    }

    // Check view limit BEFORE incrementing (prevents over-limit access)
    if (zap.viewLimit !== null && zap.viewCount >= zap.viewLimit) {
      res.status(410).json(new ApiError(410, "View limit exceeded."));
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

    // Atomic increment with concurrent-safe view limit check
    // Use a transaction to ensure atomicity under concurrent requests
    let updatedZap;
    try {
      updatedZap = await prisma.$transaction(async (tx) => {
        // Re-fetch to get the latest viewCount (handles concurrent requests)
        const currentZap = await tx.zap.findUnique({
          where: { shortId },
        });

        if (!currentZap) {
          throw new Error("ZAP_NOT_FOUND");
        }

        // Check view limit with the latest data (prevents race conditions)
        if (
          currentZap.viewLimit !== null &&
          currentZap.viewCount >= currentZap.viewLimit
        ) {
          throw new Error("VIEW_LIMIT_EXCEEDED");
        }

        // Increment view count atomically
        return await tx.zap.update({
          where: { shortId },
          data: { viewCount: { increment: 1 } },
        });
      });
    } catch (txError: any) {
      if (txError.message === "ZAP_NOT_FOUND") {
        res.status(404).json(new ApiError(404, "Zap not found."));
        return;
      }
      if (txError.message === "VIEW_LIMIT_EXCEEDED") {
        res.status(410).json(new ApiError(410, "View limit exceeded."));
        return;
      }
      if (txError.message === "ZAP_NOT_FOUND") {
        res.status(404).json(new ApiError(404, "Zap not found."));
        return;
      }
      throw txError; // Re-throw unexpected errors
    }

    res.json(new ApiResponse(200, updatedZap, "Success"));

    // Non-blocking analytics logging
    logAccess(zap.id, req).catch((err) =>
      console.error("[analytics] async logging failed:", err),
    );
  } catch (error) {
    console.error("Error in getZapByShortId:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

/**
 * Shortens a URL and generates a QR code for quick sharing.
 * 
 * @param req - Express request with url in body
 * @param res - Express response
 * 
 * @returns 201 with zapId, shortUrl, qrCode, and originalUrl
 */
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
    const deletionToken = nanoid();

    // Create Zap with URL type
    await prisma.zap.create({
      data: {
        type: "URL",
        name: url.length > 50 ? url.substring(0, 47) + "..." : url,
        cloudUrl: url,
        originalUrl: url,
        shortId,
        qrId: zapId,
        deletionToken,
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
          deletionToken,
        },
        "URL shortened successfully",
      ),
    );
  } catch (err: any) {
    console.error("CreateZap Error:", err);
    
    // Handle ID generation collision exhaustion specifically
    if (err.message && err.message.includes("Failed to generate unique")) {
      res
        .status(503)
        .json(
          new ApiError(
            503,
            "Service temporarily unavailable due to high load. Please try again."
          )
        );
      return;
    }
    
    // Handle Prisma unique constraint violations
    if (err.code === "P2002") {
      res
        .status(409)
        .json(
          new ApiError(
            409,
            "A resource with this identifier already exists. Please try again."
          )
        );
      return;
    }
    
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

/**
 * Retrieves metadata about a Zap without incrementing view count.
 * Used by clients to display file information before authentication.
 * 
 * @param req - Express request with shortId param
 * @param res - Express response
 * 
 * @returns 200 with name, quizQuestion, and hasPassword fields
 */
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
  } catch (error) {
    console.error("Error in getZapMetadata:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
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
  } catch (error) {
    console.error("Error in verifyQuizForZap:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};
