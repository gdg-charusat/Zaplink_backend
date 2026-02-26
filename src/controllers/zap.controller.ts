import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import prisma from "../utils/prismClient";
import cloudinary from "../middlewares/cloudinary";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { encryptText, decryptText } from "../utils/encryption";
import { hasQuizProtection, verifyQuizAnswer, hashQuizAnswer } from "../utils/accessControl";
import { clearZapPasswordAttemptCounter } from "../middlewares/rateLimiter";
import dotenv from "dotenv";
import mammoth from "mammoth";
import { fileTypeFromBuffer } from "file-type"; // T066 Security
import * as path from "path";
import UAParser from "ua-parser-js";
import { maskIPAddress, aggregateAnalyticsData } from "../utils/ipMasking";

dotenv.config();

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 8);

const mapTypeToPrismaEnum = (type: string): any => {
  const typeMap: any = { pdf: "PDF", image: "IMAGE", video: "VIDEO", audio: "AUDIO", archive: "ZIP", url: "URL", text: "TEXT", document: "WORD", presentation: "PPT" };
  return typeMap[type?.toLowerCase()] || "UNIVERSAL";
};

export const createZap = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, name, originalUrl, textContent, password, viewLimit, expiresAt, quizQuestion, quizAnswer, delayedAccessTime } = req.body;
    const file = req.file;

    if (!file && !originalUrl && !textContent) {
      res.status(400).json(new ApiError(400, "Provide a file, URL, or text."));
      return;
    }

    const shortId = nanoid();
    const zapId = nanoid();
    const deletionToken = nanoid();
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const hashedQuizAnswer = quizQuestion && quizAnswer ? await hashQuizAnswer(quizAnswer) : null;

    let unlockAt: Date | null = null;
    if (delayedAccessTime) {
      unlockAt = new Date(Date.now() + Number(delayedAccessTime) * 1000);
    }

    let uploadedUrl: string | null = null;
    let contentToStore: string | null = null;

    if (file) {
      // --- TEAM T066: SECURITY VALIDATION ---
      const detectedType = await fileTypeFromBuffer(file.buffer);
      const providedExt = file.originalname.split('.').pop()?.toLowerCase() || "";

      if (!detectedType) {
        res.status(415).json(new ApiError(415, "Unknown file signature. Upload blocked."));
        return;
      }

      const actualExt = detectedType.ext as string;
      const claimExt = providedExt as string;
      const isJpeg = (actualExt === 'jpg' || actualExt === 'jpeg') && (claimExt === 'jpg' || claimExt === 'jpeg');
      
      if (actualExt !== claimExt && !isJpeg) {
        res.status(400).json(new ApiError(400, `MIME Spoofing Detected! Content is ${actualExt}, claims ${providedExt}.`));
        return;
      }

      // --- SECURE CLOUDINARY UPLOAD ---
      const cloudinaryResponse: any = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "zaplink_folders", resource_type: "auto" },
          (error, result) => { if (error) reject(error); else resolve(result); }
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
    
    res.status(201).json(new ApiResponse(201, { 
      zapId, 
      shortUrl: `${domain}/api/zaps/${shortId}`,
      deletionToken 
    }, "Zap created."));
  } catch (err) {
    res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const verifyZapPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
}

export const destroyZap = async (shortIds: string[]) => {
  try{
    await prisma.zap.deleteMany({
      where: {
        shortId: { in: shortIds },
      },
    })
  }catch (err){
    console.error("DestroyZap Error:", err);
    throw new Error("Failed to destroy Zap");
  }
}


export const getZapByShortId = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shortId } = req.params;
        const { password, quizAnswer } = req.query;
        const zap = await prisma.zap.findUnique({ where: { shortId } });

        if (!zap) { res.status(404).json(new ApiError(404, "Zap not found.")); return; }
        if (zap.unlockAt && new Date() < new Date(zap.unlockAt)) {
            res.status(423).json(new ApiError(423, "File is currently locked.")); return;
        }
        if (hasQuizProtection(zap)) {
            if (!quizAnswer || !(await verifyQuizAnswer(quizAnswer as string, zap.quizAnswerHash!))) {
                res.status(401).json(new ApiError(401, "Incorrect quiz answer.")); return;
            }
        }
        if (zap.passwordHash) {
            if (!password || !(await verifyZapPassword(password as string, zap.passwordHash))) {
                res.status(401).json(new ApiError(401, "Invalid password.")); return;
            }
            clearZapPasswordAttemptCounter(req, shortId);
        }

        await prisma.zap.update({ where: { shortId }, data: { viewCount: { increment: 1 } } });

        const userAgent = req.get("user-agent") || "unknown";
        const parser = new UAParser(userAgent);
        const uaResult = parser.getResult();
        const deviceType = uaResult.device.type || "desktop";
        const browserName = uaResult.browser.name || "unknown";
        const osName = uaResult.os.name || "unknown";
        const referer = req.get("referer") || null;
        const rawIP = req.ip || "unknown";
        const maskedIP = maskIPAddress(rawIP);

        try {
          await prisma.zapAnalytics.create({
            data: {
              zapId: zap.id,
              ipAddress: maskedIP,
              userAgent,
              device: deviceType,
              browser: browserName,
              os: osName,
              referer,
            },
          });
        } catch (err) {
          console.error("Zap analytics logging failed:", err);
        }

        res.json(new ApiResponse(200, zap, "Success"));
    } catch (e) { res.status(500).json(new ApiError(500, "Error")); }
};

    export const getZapAnalytics = async (req: Request, res: Response): Promise<void> => {
      try {
        const { shortId } = req.params;
        const { token } = req.query;
        
        // Validate token parameter
        if (!token || typeof token !== "string") {
          res.status(401).json(new ApiError(401, "Analytics token required."));
          return;
        }

        const zap = await prisma.zap.findUnique({ where: { shortId } });
        if (!zap) { 
          res.status(404).json(new ApiError(404, "Zap not found.")); 
          return; 
        }

        // Verify deletion token
        if (token !== zap.deletionToken) {
          res.status(403).json(new ApiError(403, "Invalid analytics token."));
          return;
        }

        const [totalViews, uniqueIPsData, rawAnalytics] = await Promise.all([
          prisma.zapAnalytics.count({ where: { zapId: zap.id } }),
          prisma.zapAnalytics.groupBy({
            by: ['ipAddress'],
            where: { zapId: zap.id },
          }),
          prisma.zapAnalytics.findMany({
            where: { zapId: zap.id },
            orderBy: { accessedAt: "desc" },
            select: {
              device: true,
              browser: true,
              os: true,
              referer: true,
              accessedAt: true,
            },
          }),
        ]);

        const uniqueVisitors = uniqueIPsData.length;
        
        // Aggregate and mask analytics data
        const aggregatedAnalytics = aggregateAnalyticsData(rawAnalytics);

        res.json(new ApiResponse(200, { 
          totalViews, 
          uniqueVisitors, 
          aggregatedAnalytics,
          lastUpdated: new Date().toISOString()
        }, "Analytics fetched successfully"));
      } catch (e) { res.status(500).json(new ApiError(500, "Error")); }
    };

export const getZapMetadata = async (req: Request, res: Response): Promise<void> => {
  try {
    const zap = await prisma.zap.findUnique({ where: { shortId: req.params.shortId } });
    if (!zap) { res.status(404).json(new ApiError(404, "Not found")); return; }
    res.json(new ApiResponse(200, { name: zap.name, quizQuestion: zap.quizQuestion, hasPassword: !!zap.passwordHash }, "Success"));
  } catch (e) { res.status(500).json(new ApiError(500, "Error")); }
};

export const verifyQuizForZap = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shortId } = req.params;
        const { answer } = req.body;
        const zap = await prisma.zap.findUnique({ where: { shortId } });
        if (!zap || !zap.quizAnswerHash) { res.status(404).json(new ApiError(404, "No quiz")); return; }
        const isCorrect = await verifyQuizAnswer(answer, zap.quizAnswerHash);
        res.json(new ApiResponse(isCorrect ? 200 : 401, { verified: isCorrect }, isCorrect ? "Correct" : "Incorrect"));
    } catch (e) { res.status(500).json(new ApiError(500, "Error")); }
};