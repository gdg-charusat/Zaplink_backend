import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import prisma from "../utils/prismClient";
import cloudinary from "../middlewares/cloudinary";
import {
  clearZapPasswordAttemptCounter,
} from "../middlewares/rateLimiter";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { validatePasswordStrength } from "../utils/passwordValidator";
import { compressPDF } from "../utils/pdfCompressor";
import { encryptText, decryptText } from "../utils/encryption";
import dotenv from "dotenv";
import mammoth from "mammoth";
<<<<<<< HEAD
import FileType from "file-type"; // Team T066 Security Import
import * as path from "path";
<<<<<<< HEAD

=======
=======
import * as path from "path";
import {
  hasQuizProtection,
  verifyQuizAnswer,
  hashQuizAnswer,
  validateFileAccess,
} from "../utils/accessControl";
>>>>>>> upstream/main
import * as os from "os";
import { deleteFromCloudinary } from "../utils/cloudinaryHelper";
>>>>>>> upstream/main
dotenv.config();

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  8,
);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/* ------------------------ TEXT HTML RENDERER ------------------------ */
<<<<<<< HEAD
const generateTextHtml = (title: string, content: string) => {
  const escapedContent = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const escapedName = (title || "Untitled")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
=======
const generateTextHtml = (title: string | null, content: string) => {
  const escape = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
>>>>>>> upstream/main

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedName}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #e5e7eb; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #111827; }
        .container { background: #1f2937; padding: 30px; border-radius: 12px; border: 1px solid #374151; }
        h1 { color: #f9fafb; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
        .content { white-space: pre-wrap; color: #d1d5db; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${escapedName}</h1>
        <div class="content">${escapedContent}</div>
    </div>
</body>
</html>`;
};
<<<<<<< HEAD

const mapTypeToPrismaEnum = (type: string) => {
  const typeMap: any = {
=======
const mapTypeToPrismaEnum = (
  type: string,
):
  | "PDF"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "ZIP"
  | "URL"
  | "TEXT"
  | "WORD"
  | "PPT"
  | "UNIVERSAL" => {
  const typeMap: Record<
    string,
    | "PDF"
    | "IMAGE"
    | "VIDEO"
    | "AUDIO"
    | "ZIP"
    | "URL"
    | "TEXT"
    | "WORD"
    | "PPT"
    | "UNIVERSAL"
  > = {
>>>>>>> upstream/main
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

  return typeMap[type.toLowerCase()] || "UNIVERSAL";
};

<<<<<<< HEAD
export const createZap = async (req: Request, res: Response): Promise<void> => {
=======
export const createZap = async (req: Request, res: any): Promise<any> => {
>>>>>>> upstream/main
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
<<<<<<< HEAD
<<<<<<< HEAD
       res.status(400).json(new ApiError(400, "Either a file, URL, or text content must be provided."));
       return;
=======
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "Either a file, URL, or text content must be provided.",
          ),
        );
>>>>>>> upstream/main
    }
    const shortId = nanoid();
    const zapId = nanoid();
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const hashedQuizAnswer = quizQuestion && quizAnswer
      ? await hashQuizAnswer(quizAnswer)
      : null;

=======
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

>>>>>>> upstream/main
    let unlockAt: Date | null = null;
    if (delayedAccessTime && delayedAccessTime > 0) {
      unlockAt = new Date(Date.now() + delayedAccessTime * 1000);
    }

    let cloudUrl: string | null = null;
    let contentToStore: string | null = null;

    /* ---------------- FILE HANDLING ---------------- */
    if (file) {
<<<<<<< HEAD
      // --- TEAM T066: MAGIC BYTE SECURITY VALIDATION START ---
      const detectedType = await FileType.fromBuffer(file.buffer);
      const providedExt = file.originalname.split('.').pop()?.toLowerCase() || "";

      if (!detectedType) {
        res.status(415).json(new ApiError(415, "Security Alert: Unknown file signature. Upload blocked."));
        return;
      }

      const actualExt = detectedType.ext as string;
      const claimExt = providedExt as string;

      const isJpeg = (actualExt === 'jpg' || actualExt === 'jpeg') && (claimExt === 'jpg' || claimExt === 'jpeg');
      
      if (actualExt !== claimExt && !isJpeg) {
        res.status(400).json(new ApiError(400, `MIME Spoofing Detected! Content is actually ${actualExt}, but extension claims ${claimExt}.`));
        return;
      }
      // --- TEAM T066: SECURITY VALIDATION END ---

      const cloudinaryResponse: any = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "zaplink_folders", resource_type: "auto" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(file.buffer);
      });

      uploadedUrl = cloudinaryResponse.secure_url;
=======
      let filePath = (file as any).path;
      const fileName = (file as any).originalname;
      const fileExtension = path.extname(fileName).toLowerCase();
>>>>>>> upstream/main

      // Compress PDF if requested
      const shouldCompress = compress === true || compress === "true" || compress === "1";
      if (fileExtension === ".pdf" && shouldCompress) {
        try {
          const compressedPath = path.join(
            path.dirname(filePath),
            `${path.basename(filePath, ".pdf")}_compressed.pdf`
          );
          await compressPDF(filePath, compressedPath);
          const compressedStats = await fs.promises.stat(compressedPath);
          if (compressedStats.size > 0) {
            filePath = compressedPath;
            console.log(`PDF compressed successfully`);
          }
        } catch (err) {
          console.error("Compression error, continuing with original:", err);
        }
      }

      // Upload to Cloudinary
      try {
        let resource_type = "raw";
        if (type === "image") {
          resource_type = "image";
        } else if (type === "video") {
          resource_type = "video";
        }

        const uploadResult = await cloudinary.uploader.upload(filePath, {
          folder: 'zaplink_folders',
          resource_type: resource_type as "raw" | "image" | "video",
        } as any);
        
        uploadedUrl = uploadResult.secure_url;
        console.log('File uploaded to Cloudinary:', uploadedUrl);
        
        // Clean up local file after successful upload
        try {
          await fs.promises.unlink(filePath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup local file:', cleanupError);
        }
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        // Fall back to local file path if upload fails
        uploadedUrl = filePath;
      }

      // Extract text from documents BEFORE uploading to Cloudinary
      if (type === "document" || type === "presentation") {
<<<<<<< HEAD
        if (claimExt === "docx") {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          contentToStore = `DOCX_CONTENT:${result.value}`;
        } else if (claimExt === "pptx") {
          contentToStore = `PPTX_CONTENT:PowerPoint uploaded to cloud storage.`;
=======
        try {
          if (fileExtension === ".docx") {
            const result = await mammoth.extractRawText({ path: filePath });
            const extractedText = result.value;

            if (extractedText.length > 10000) {
              return res
                .status(400)
                .json(
                  new ApiError(
                    400,
                    "Extracted text is too long. Maximum 10,000 characters allowed.",
                  ),
                );
            }

            // Encrypt the extracted text before storing
            const encryptedText = encryptText(extractedText);
            contentToStore = `DOCX_CONTENT:${encryptedText}`;
          } else if (fileExtension === ".pptx") {
            const pptxMessage =
              "This is a PowerPoint presentation. The file has been uploaded and can be downloaded from the cloud storage.";
            const encryptedText = encryptText(pptxMessage);
            contentToStore = `PPTX_CONTENT:${encryptedText}`;
          }
        } catch (error) {
          console.error("Error extracting text from file:", error);
          contentToStore = null;
>>>>>>> upstream/main
        }
      }
    } else if (originalUrl) {
      uploadedUrl = originalUrl;
      contentToStore = originalUrl;
    } else if (textContent) {
      if (textContent.length > 10000) {
<<<<<<< HEAD
        res.status(400).json(new ApiError(400, "Text content is too long."));
        return;
=======
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              "Text content is too long. Maximum 10,000 characters allowed.",
            ),
          );
>>>>>>> upstream/main
      }
      // Encrypt text content before storing
      const encryptedText = encryptText(textContent);
      contentToStore = `TEXT_CONTENT:${encryptedText}`;
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
        type: mapTypeToPrismaEnum(type || "UNIVERSAL"),
        name: name || "Untitled Zap",
        cloudUrl: uploadedUrl,
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
<<<<<<< HEAD
=======
    const domain = process.env.FRONTEND_URL || "https://zaplink.krishnapaljadeja.com";
    const shortUrl = `${domain}/zaps/${shortId}`;
>>>>>>> upstream/main

    const domain = process.env.BASE_URL || "http://localhost:5000";
    const shortUrl = `${domain}/api/zaps/${shortId}`;
    const qrCode = await QRCode.toDataURL(shortUrl);

<<<<<<< HEAD
<<<<<<< HEAD
    res.status(201).json(
      new ApiResponse(201, { zapId, shortUrl, qrCode, type, name: zap.name }, "Zap created successfully.")
=======
    return res.status(201).json(
=======
    res.status(201).json(
>>>>>>> upstream/main
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
<<<<<<< HEAD
        "Zap created successfully.",
      ),
>>>>>>> upstream/main
    );
  } catch (err: any) {
    console.error("CreateZap Error:", err);
    res.status(500).json(new ApiError(500, "Internal server error"));
=======
        "Zap created successfully",
      ),
    );
    return;
  } catch (err) {
    console.error("CreateZap Error:", err);
    res.status(500).json(new ApiError(500, "Internal server error"));
    return;
>>>>>>> upstream/main
  }
};

export const getZapByShortId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shortId } = req.params;
    const zap = await prisma.zap.findUnique({ where: { shortId } });

    if (!zap) {
<<<<<<< HEAD
        res.status(404).json(new ApiError(404, "Zap not found."));
        return;
    }

    if (zap.expiresAt && new Date() > new Date(zap.expiresAt)) {
        res.status(410).json(new ApiError(410, "Zap has expired."));
        return;
    }

    if (zap.viewLimit !== null && zap.viewCount >= zap.viewLimit) {
        res.status(410).json(new ApiError(410, "View limit reached."));
        return;
=======
      res.status(404).json(new ApiError(404, "Zap not found"));
      return;
>>>>>>> upstream/main
    }

    if (zap.passwordHash) {
<<<<<<< HEAD
      const password = req.query.password as string;
      if (!password || !(await bcrypt.compare(password, zap.passwordHash))) {
        res.status(401).json(new ApiError(401, "Invalid or missing password."));
=======
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
>>>>>>> upstream/main
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
      data: { viewCount: { increment: 1 } },
    });

    res.json(new ApiResponse(200, zap, "Zap retrieved successfully."));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};
=======
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

export const getZapByShortId = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const shortId: string = req.params.shortId as string;
    const quizAnswer = req.query.quizAnswer as string | undefined;

    const zap = await prisma.zap.findUnique({
      where: { shortId },
    });

    const now = new Date();
    if (!zap) {
      res.status(404).json(new ApiError(404, "Zap not found."));
      return;
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=notfound`);
      }
      return res.status(404).json(new ApiError(404, "Zap not found."));
    }

    if (zap.expiresAt) {
      const expirationTime = new Date(zap.expiresAt);
      const currentTime = new Date();

      // Compare timestamps to avoid timezone issues
      if (currentTime.getTime() > expirationTime.getTime()) {
        res.status(410).json(new ApiError(410, "This link has expired."));
        return;
        if (zap.cloudUrl) {
          await deleteFromCloudinary(zap.cloudUrl);
        }
        await prisma.zap.delete({ where: { id: zap.id } });
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=expired`);
      }
    }

    if (zap.viewLimit !== null && zap.viewCount >= zap.viewLimit) {
      res.status(403).json(new ApiError(403, "View limit exceeded."));
      return;
      if (zap.cloudUrl) {
        await deleteFromCloudinary(zap.cloudUrl);
      }
      await prisma.zap.delete({ where: { id: zap.id } });
      return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=viewlimit`);
    }

    // Check Delayed Access 
    if (zap.unlockAt) {
      const now = new Date();
      const unlockTime = new Date(zap.unlockAt);
      if (now.getTime() < unlockTime.getTime()) {
        // File is still locked by delayed access
        const remainingMs = unlockTime.getTime() - now.getTime();
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          return res.redirect(
            `${FRONTEND_URL}/zaps/${shortId}?error=delayed_access&unlockTime=${unlockTime.toISOString()}`
          );
        }
        res.status(423).json(
          new ApiError(
            423,
            "This file is temporarily locked and will be available at " +
              unlockTime.toISOString()
          )
        );
        return;
      }
    }

    // ── Check Quiz Protection ─────────────────────────────────────────────────────
    if (hasQuizProtection(zap)) {
      if (!quizAnswer) {
        // Quiz answer not provided
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          return res.redirect(
            `${FRONTEND_URL}/zaps/${shortId}?error=quiz_required&question=${encodeURIComponent(
              zap.quizQuestion || ""
            )}`
          );
        }
        res.status(423).json({
          error: "quiz_required",
          message: "This file is protected by a quiz.",
          question: zap.quizQuestion,
        });
        return;
      }

      // Verify the quiz answer
      const isCorrect = await verifyQuizAnswer(
        quizAnswer,
        zap.quizAnswerHash!
      );

      if (!isCorrect) {
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          return res.redirect(
            `${FRONTEND_URL}/zaps/${shortId}?error=quiz_incorrect&question=${encodeURIComponent(
              zap.quizQuestion || ""
            )}`
          );
        }
        res.status(401).json(
          new ApiError(401, "Incorrect quiz answer. Please try again.")
        );
        return;
      }
    }

    // ── Check Password Protection ─────────────────────────────────────────────────
    if (zap.passwordHash) {
      const providedPassword = req.query.password as string;

      if (!providedPassword) {
        res.status(401).json(new ApiError(401, "Password required."));
        return;
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          return res.redirect(`${FRONTEND_URL}/zaps/${shortId}`);
        }
        return res.status(401).json(new ApiError(401, "Password required."));
      }

      const isPasswordValid = await bcrypt.compare(
        providedPassword,
        zap.passwordHash,
      );

      if (!isPasswordValid) {
        res.status(401).json(new ApiError(401, "Incorrect password."));
        return;
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          return res.redirect(
            `${FRONTEND_URL}/zaps/${shortId}?error=incorrect_password`,
          );
        }
        return res.status(401).json(new ApiError(401, "Incorrect password."));
      }

      clearZapPasswordAttemptCounter(req, shortId);
    }

    const updatedZap = await prisma.zap.update({
      where: { shortId },
      data: { viewCount: zap.viewCount + 1 },
    });

<<<<<<< HEAD
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
=======
    if (
      updatedZap.viewLimit !== null &&
      updatedZap.viewCount > updatedZap.viewLimit
    ) {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=viewlimit`);
      }
      res.status(410).json(new ApiError(410, "Zap view limit reached."));
      return;
>>>>>>> upstream/main
    }

    if (zap.originalUrl) {
      if (
        zap.originalUrl.startsWith("http://") ||
        zap.originalUrl.startsWith("https://")
      ) {
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
<<<<<<< HEAD
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

=======
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

>>>>>>> upstream/main
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
<<<<<<< HEAD


/**
 * Get metadata about a Zap (quiz question, locked status, etc.)
 * Does not require access to the file content
 */
export const getZapMetadata = async (
  req: Request,
  res: Response
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
      res.status(410).json(
        new ApiError(410, "View limit for this Zap has been exceeded.")
      );
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
        "Zap metadata retrieved successfully."
      )
    );
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};
<<<<<<< HEAD
>>>>>>> upstream/main
=======

/**
 * Verify quiz answer for a Zap
 * Returns a token if correct, which can be used in subsequent requests
 */
export const verifyQuizForZap = async (
  req: Request,
  res: Response
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
      res.status(401).json(
        new ApiError(401, "Incorrect answer. Please try again.")
      );
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
        "Quiz answer verified successfully."
      )
    );
  } catch (error) {
    console.error("verifyQuizForZap Error:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

// export const shortenUrl = async (req: Request, res: Response) => {

//   try {
//     const { url, name } = req.body;
//     if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) {
//       return res
//         .status(400)
//         .json(new ApiError(400, "A valid URL is required."));
//     }
//     const shortId = nanoid();
//     const zapId = nanoid();
//     const zap = await prisma.zap.create({
//       data: {
//         type: "URL",
//         name: name || "Shortened URL",
//         cloudUrl: url,
//         originalUrl: url,
//         qrId: zapId,
//         shortId,
//       },
//     });
//     const domain = process.env.BASE_URL || "https://api.krishnapaljadeja.com";
//     const shortUrl = `${domain}/api/zaps/${shortId}`;
//     const qrCode = await QRCode.toDataURL(shortUrl);
//     return res
//       .status(201)
//       .json(
//         new ApiResponse(
//           201,
//           { zapId, shortUrl, qrCode, type: "URL", name: zap.name },
//           "Short URL created successfully."
//         )
//       );
//   } catch (err) {
//     console.error("shortenUrl Error:", err);
//     return res.status(500).json(new ApiError(500, "Internal server error"));
//   }
// };
>>>>>>> upstream/main
=======
>>>>>>> upstream/main
