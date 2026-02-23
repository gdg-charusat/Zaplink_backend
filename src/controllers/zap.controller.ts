import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import prisma from "../utils/prismClient";
import cloudinary from "../middlewares/cloudinary";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import dotenv from "dotenv";
import mammoth from "mammoth";
import * as path from "path";
dotenv.config();

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 6);

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://zaplink.krishnapaljadeja.com";

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Render a minimal HTML page for plain-text / DOCX-extracted content.
 */
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

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #e5e7eb;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #111827;
            min-height: 100vh;
        }
        .container {
            background: #1f2937;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            border: 1px solid #374151;
        }
        h1 {
            color: #f9fafb;
            margin-bottom: 20px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 10px;
            font-size: 2rem;
            font-weight: 600;
        }
        .content {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 16px;
            color: #d1d5db;
            line-height: 1.7;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #374151;
            text-align: center;
            color: #9ca3af;
            font-size: 14px;
        }
        @media (max-width: 768px) {
            body {
                padding: 15px;
            }
            .container {
                padding: 20px;
            }
            h1 {
                font-size: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${escapedName}</h1>
        <div class="content">${escapedContent}</div>
        <div class="footer">
            Powered by ZapLink
        </div>
    </div>
</body>
</html>`;
};

/**
 * Map user-facing type strings to Prisma ZapType enum values.
 */
const mapTypeToPrismaEnum = (
  type: string
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
    pdf: "PDF",
    image: "IMAGE",
    video: "VIDEO",
    audio: "AUDIO",
    archive: "ZIP",
    url: "URL",
    text: "TEXT",
    document: "WORD",
    presentation: "PPT",
    spreadsheet: "UNIVERSAL",
    URL: "URL",
    TEXT: "TEXT",
    DOCUMENT: "WORD",
    PRESENTATION: "PPT",
  };

  return typeMap[type.toLowerCase()] || "UNIVERSAL";
};

/**
 * Extract the Cloudinary public_id (including folder) from a full Cloudinary URL.
 * Example: https://res.cloudinary.com/.../zaplink_folders/abc123.pdf
 *       => zaplink_folders/abc123
 */
const extractCloudinaryPublicId = (cloudUrl: string): string => {
  try {
    const url = new URL(cloudUrl);
    const parts = url.pathname.split("/");
    // Path is typically /image/upload/v1234/folder/public_id.ext
    // Find the index after 'upload' and version
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return "";
    // Everything after upload/vXXX is the public_id path (without extension)
    const relevantParts = parts.slice(uploadIdx + 2); // skip 'upload' and version
    const fullPath = relevantParts.join("/");
    // Remove extension
    const dotIdx = fullPath.lastIndexOf(".");
    return dotIdx !== -1 ? fullPath.substring(0, dotIdx) : fullPath;
  } catch {
    return "";
  }
};

/**
 * Determine the Cloudinary resource_type from ZapType for correct API calls.
 */
const getResourceType = (
  zapType: string
): "image" | "video" | "raw" => {
  if (zapType === "IMAGE" || zapType === "PDF") return "image";
  if (zapType === "VIDEO") return "video";
  return "raw";
};

/**
 * Delete a Zap's Cloudinary file and then remove the DB record.
 * Silently logs errors so callers don't crash on cleanup failures.
 */
export const destroyZap = async (zap: {
  id: string;
  cloudUrl: string | null;
  type: string;
}): Promise<void> => {
  try {
    // 1. Delete from Cloudinary (if there's a file)
    if (zap.cloudUrl) {
      const publicId = extractCloudinaryPublicId(zap.cloudUrl);
      if (publicId) {
        const resourceType = getResourceType(zap.type);
        await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
        });
      }
    }
    // 2. Delete from database
    await prisma.zap.delete({ where: { id: zap.id } });
  } catch (err) {
    console.error("destroyZap cleanup error:", err);
  }
};

/**
 * Serve the Zap content back to the client (redirect, HTML, JSON).
 * Shared by both getZapByShortId and accessZap to avoid duplication.
 */
const serveZapContent = (
  req: Request,
  res: any,
  zap: {
    name: string | null;
    cloudUrl: string | null;
    originalUrl: string | null;
  }
) => {
  const isHtml =
    req.headers.accept && req.headers.accept.includes("text/html");

  if (zap.originalUrl) {
    if (
      zap.originalUrl.startsWith("http://") ||
      zap.originalUrl.startsWith("https://")
    ) {
      if (isHtml) {
        return res.redirect(zap.originalUrl);
      }
      return res.json({ url: zap.originalUrl, type: "redirect" });
    }

    if (zap.originalUrl.startsWith("TEXT_CONTENT:")) {
      const textContent = zap.originalUrl.substring(13);
      if (isHtml) {
        const html = generateTextHtml(zap.name || "Untitled", textContent);
        res.set("Content-Type", "text/html");
        return res.send(html);
      }
      return res.json({ content: textContent, type: "text", name: zap.name });
    }

    if (
      zap.originalUrl.startsWith("DOCX_CONTENT:") ||
      zap.originalUrl.startsWith("PPTX_CONTENT:")
    ) {
      const textContent = zap.originalUrl.substring(13);
      if (isHtml) {
        const html = generateTextHtml(zap.name || "Untitled", textContent);
        res.set("Content-Type", "text/html");
        return res.send(html);
      }
      return res.json({
        content: textContent,
        type: "document",
        name: zap.name,
      });
    }

    // Base64 image data
    const base64Data = zap.originalUrl;
    const matches = base64Data.match(
      /^data:(image\/[a-zA-Z]+);base64,(.+)$/
    );
    if (matches) {
      const mimeType = matches[1];
      const base64 = matches[2];
      const buffer = Buffer.from(base64, "base64");
      if (isHtml) {
        res.set("Content-Type", mimeType);
        return res.send(buffer);
      }
      return res.json({ data: base64Data, type: "image", name: zap.name });
    }

    return res.status(400).json(new ApiError(400, "Invalid content data."));
  }

  if (zap.cloudUrl) {
    if (isHtml) {
      return res.redirect(zap.cloudUrl);
    }
    return res.json({ url: zap.cloudUrl, type: "file" });
  }

  return res.status(500).json(new ApiError(500, "Zap content not found."));
};

// ────────────────────────────────────────────────────────────────────────────────
// Controllers
// ────────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/zaps/upload
 * Create a new Zap (file, URL, or text).
 */
export const createZap = async (req: Request, res: any) => {
  try {
    const {
      type,
      name,
      originalUrl,
      textContent,
      password,
      viewLimit,
      expiresAt,
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
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    let uploadedUrl: string | null = null;
    let contentToStore: string | null = null;

    if (file) {
      uploadedUrl = (file as any).path;

      if (type === "document" || type === "presentation") {
        try {
          const filePath = (file as any).path;
          const fileName = (file as any).originalname;
          const fileExtension = path.extname(fileName).toLowerCase();

          if (fileExtension === ".docx") {
            const result = await mammoth.extractRawText({ path: filePath });
            const extractedText = result.value;

            if (extractedText.length > 10000) {
              return res
                .status(400)
                .json(
                  new ApiError(
                    400,
                    "Extracted text is too long. Maximum 10,000 characters allowed."
                  )
                );
            }
            contentToStore = `DOCX_CONTENT:${extractedText}`;
          } else if (fileExtension === ".pptx") {
            contentToStore = `PPTX_CONTENT:This is a PowerPoint presentation. The file has been uploaded and can be downloaded from the cloud storage.`;
          }
        } catch (error) {
          console.error("Error extracting text from file:", error);
          contentToStore = null;
        }
      }
    } else if (originalUrl) {
      uploadedUrl = originalUrl;
      contentToStore = originalUrl;
    } else if (textContent) {
      if (textContent.length > 10000) {
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              "Text content is too long. Maximum 10,000 characters allowed."
            )
          );
      }
      contentToStore = `TEXT_CONTENT:${textContent}`;
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
        viewLimit: parsedViewLimit,
        expiresAt: parsedExpiresAt,
      },
    });
    const domain = process.env.BASE_URL || "https://api.krishnapaljadeja.com";
    const shortUrl = `${domain}/api/zaps/${shortId}`;

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
        },
        "Zap created successfully."
      )
    );
  } catch (err) {
    console.error("CreateZap Error:", err);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

/**
 * GET /api/zaps/:shortId
 *
 * Public access to a Zap. Handles:
 *  - Expiry check (with Cloudinary + DB cleanup)
 *  - Atomic viewCount increment (race-condition-safe)
 *  - Redirects password-protected Zaps to the frontend unlock page
 *
 * ⚠ Passwords are NO LONGER accepted via query parameters.
 *   Use POST /api/zaps/:shortId/access instead.
 */
export const getZapByShortId = async (req: Request, res: any) => {
  try {
    const shortId: string = req.params.shortId as string;
    const isHtml =
      req.headers.accept && req.headers.accept.includes("text/html");

    const zap = await prisma.zap.findUnique({ where: { shortId } });

    if (!zap) {
      if (isHtml) {
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=notfound`);
      }
      return res.status(404).json(new ApiError(404, "Zap not found."));
    }

    // ── Expiry check — clean up if expired ────────────────────────────────
    if (zap.expiresAt) {
      const now = new Date();
      if (now.getTime() > new Date(zap.expiresAt).getTime()) {
        // Asynchronous cleanup — don't block the response
        destroyZap(zap).catch(() => { });
        if (isHtml) {
          return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=expired`);
        }
        return res.status(410).json(new ApiError(410, "This Zap has expired."));
      }
    }

    // ── Password-protected? Redirect to frontend, require POST /access ────
    if (zap.passwordHash) {
      if (isHtml) {
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}`);
      }
      return res.status(401).json(new ApiError(401, "Password required. Use POST /api/zaps/:shortId/access with { \"password\": \"...\" } in the request body."));
    }

    // ── Atomic viewCount increment (Fix 2: race condition) ────────────────
    // Uses raw SQL so that both the check and increment happen in one
    // statement — concurrent requests cannot bypass the limit.
    if (zap.viewLimit !== null) {
      const result: any[] = await prisma.$queryRawUnsafe(
        `UPDATE "Zap"
           SET "viewCount" = "viewCount" + 1,
               "updatedAt" = NOW()
         WHERE "shortId" = $1
           AND ("maxViews" IS NULL OR "viewCount" < "maxViews")
         RETURNING *`,
        shortId
      );

      if (!result || result.length === 0) {
        // View limit reached — clean up
        destroyZap(zap).catch(() => { });
        if (isHtml) {
          return res.redirect(
            `${FRONTEND_URL}/zaps/${shortId}?error=viewlimit`
          );
        }
        return res
          .status(410)
          .json(new ApiError(410, "Zap view limit reached."));
      }
    } else {
      // No view limit — just increment the counter normally
      await prisma.zap.update({
        where: { shortId },
        data: { viewCount: { increment: 1 } },
      });
    }

    // ── Serve content ─────────────────────────────────────────────────────
    return serveZapContent(req, res, zap);
  } catch (error) {
    console.error("getZapByShortId Error:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

/**
 * POST /api/zaps/:shortId/access
 *
 * Secure access for password-protected Zaps.
 * Password is sent in the request body — never in the URL.
 *
 * Body: { "password": "..." }
 */
export const accessZap = async (req: Request, res: any) => {
  try {
    const shortId: string = req.params.shortId as string;
    const { password } = req.body;
    const isHtml =
      req.headers.accept && req.headers.accept.includes("text/html");

    if (!password || typeof password !== "string") {
      return res
        .status(400)
        .json(new ApiError(400, "Password is required in the request body."));
    }

    const zap = await prisma.zap.findUnique({ where: { shortId } });

    if (!zap) {
      if (isHtml) {
        return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=notfound`);
      }
      return res.status(404).json(new ApiError(404, "Zap not found."));
    }

    // ── Expiry check — clean up if expired ────────────────────────────────
    if (zap.expiresAt) {
      const now = new Date();
      if (now.getTime() > new Date(zap.expiresAt).getTime()) {
        destroyZap(zap).catch(() => { });
        if (isHtml) {
          return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=expired`);
        }
        return res.status(410).json(new ApiError(410, "This Zap has expired."));
      }
    }

    // ── Password verification ─────────────────────────────────────────────
    if (!zap.passwordHash) {
      // Not password-protected — just serve normally
      // (but still go through viewLimit logic below)
    } else {
      const isPasswordValid = await bcrypt.compare(password, zap.passwordHash);
      if (!isPasswordValid) {
        if (isHtml) {
          return res.redirect(
            `${FRONTEND_URL}/zaps/${shortId}?error=incorrect_password`
          );
        }
        return res.status(401).json(new ApiError(401, "Incorrect password."));
      }
    }

    // ── Atomic viewCount increment (Fix 2: race condition) ────────────────
    if (zap.viewLimit !== null) {
      const result: any[] = await prisma.$queryRawUnsafe(
        `UPDATE "Zap"
           SET "viewCount" = "viewCount" + 1,
               "updatedAt" = NOW()
         WHERE "shortId" = $1
           AND ("maxViews" IS NULL OR "viewCount" < "maxViews")
         RETURNING *`,
        shortId
      );

      if (!result || result.length === 0) {
        destroyZap(zap).catch(() => { });
        if (isHtml) {
          return res.redirect(
            `${FRONTEND_URL}/zaps/${shortId}?error=viewlimit`
          );
        }
        return res
          .status(410)
          .json(new ApiError(410, "Zap view limit reached."));
      }
    } else {
      await prisma.zap.update({
        where: { shortId },
        data: { viewCount: { increment: 1 } },
      });
    }

    // ── Serve content ─────────────────────────────────────────────────────
    return serveZapContent(req, res, zap);
  } catch (error) {
    console.error("accessZap Error:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};
