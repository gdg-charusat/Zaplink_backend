"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getZapByShortId = exports.createZap = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const nanoid_1 = require("nanoid");
const qrcode_1 = __importDefault(require("qrcode"));
const prismClient_1 = __importDefault(require("../utils/prismClient"));
const ApiError_1 = require("../utils/ApiError");
const ApiResponse_1 = require("../utils/ApiResponse");
const dotenv_1 = __importDefault(require("dotenv"));
const mammoth_1 = __importDefault(require("mammoth"));
const path = __importStar(require("path"));
dotenv_1.default.config();
const nanoid = (0, nanoid_1.customAlphabet)("1234567890abcdefghijklmnopqrstuvwxyz", 6);
const FRONTEND_URL = process.env.FRONTEND_URL || "https://zaplink.krishnapaljadeja.com";
const generateTextHtml = (title, content) => {
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
const mapTypeToPrismaEnum = (type) => {
    const typeMap = {
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
const createZap = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { type, name, originalUrl, textContent, password, viewLimit, expiresAt, } = req.body;
        const file = req.file;
        if (!file && !originalUrl && !textContent) {
            return res
                .status(400)
                .json(new ApiError_1.ApiError(400, "Either a file, URL, or text content must be provided."));
        }
        const shortId = nanoid();
        const zapId = nanoid();
        const hashedPassword = password ? yield bcrypt_1.default.hash(password, 10) : null;
        let uploadedUrl = null;
        let contentToStore = null;
        if (file) {
            uploadedUrl = file.path;
            if (type === "document" || type === "presentation") {
                try {
                    const filePath = file.path;
                    const fileName = file.originalname;
                    const fileExtension = path.extname(fileName).toLowerCase();
                    if (fileExtension === ".docx") {
                        // Extract text from DOCX
                        const result = yield mammoth_1.default.extractRawText({ path: filePath });
                        const extractedText = result.value;
                        if (extractedText.length > 10000) {
                            return res
                                .status(400)
                                .json(new ApiError_1.ApiError(400, "Extracted text is too long. Maximum 10,000 characters allowed."));
                        }
                        contentToStore = `DOCX_CONTENT:${extractedText}`;
                    }
                    else if (fileExtension === ".pptx") {
                        contentToStore = `PPTX_CONTENT:This is a PowerPoint presentation. The file has been uploaded and can be downloaded from the cloud storage.`;
                    }
                }
                catch (error) {
                    console.error("Error extracting text from file:", error);
                    // If text extraction fails, fall back to regular file handling
                    contentToStore = null;
                }
            }
        }
        else if (originalUrl) {
            uploadedUrl = originalUrl;
            contentToStore = originalUrl;
        }
        else if (textContent) {
            if (textContent.length > 10000) {
                return res
                    .status(400)
                    .json(new ApiError_1.ApiError(400, "Text content is too long. Maximum 10,000 characters allowed."));
            }
            contentToStore = `TEXT_CONTENT:${textContent}`;
        }
        const zap = yield prismClient_1.default.zap.create({
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
        const domain = process.env.BASE_URL || "https://api.krishnapaljadeja.com";
        const shortUrl = `${domain}/api/zaps/${shortId}`;
        const qrCode = yield qrcode_1.default.toDataURL(shortUrl);
        return res.status(201).json(new ApiResponse_1.ApiResponse(201, {
            zapId,
            shortUrl,
            qrCode,
            type,
            name,
        }, "Zap created successfully."));
    }
    catch (err) {
        console.error("CreateZap Error:", err);
        return res.status(500).json(new ApiError_1.ApiError(500, "Internal server error"));
    }
});
exports.createZap = createZap;
const getZapByShortId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const shortId = req.params.shortId;
        const zap = yield prismClient_1.default.zap.findUnique({
            where: { shortId },
        });
        const now = new Date();
        if (!zap) {
            if (req.headers.accept && req.headers.accept.includes("text/html")) {
                return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=notfound`);
            }
            res.status(404).json(new ApiError_1.ApiError(404, "Zap not found."));
            return;
        }
        if (zap.expiresAt) {
            const expirationTime = new Date(zap.expiresAt);
            const currentTime = new Date();
            // Compare timestamps to avoid timezone issues
            if (currentTime.getTime() > expirationTime.getTime()) {
                return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=expired`);
            }
        }
        if (zap.viewLimit !== null && zap.viewCount >= zap.viewLimit) {
            return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=viewlimit`);
        }
        if (zap.passwordHash) {
            const providedPassword = req.query.password;
            if (!providedPassword) {
                if (req.headers.accept && req.headers.accept.includes("text/html")) {
                    return res.redirect(`${FRONTEND_URL}/zaps/${shortId}`);
                }
                res.status(401).json(new ApiError_1.ApiError(401, "Password required."));
                return;
            }
            const isPasswordValid = yield bcrypt_1.default.compare(providedPassword, zap.passwordHash);
            if (!isPasswordValid) {
                if (req.headers.accept && req.headers.accept.includes("text/html")) {
                    return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=incorrect_password`);
                }
                res.status(401).json(new ApiError_1.ApiError(401, "Incorrect password."));
                return;
            }
        }
        const updatedZap = yield prismClient_1.default.zap.update({
            where: { shortId },
            data: { viewCount: zap.viewCount + 1 },
        });
        if (updatedZap.viewLimit !== null &&
            updatedZap.viewCount > updatedZap.viewLimit) {
            if (req.headers.accept && req.headers.accept.includes("text/html")) {
                return res.redirect(`${FRONTEND_URL}/zaps/${shortId}?error=viewlimit`);
            }
            res.status(410).json(new ApiError_1.ApiError(410, "Zap view limit reached."));
            return;
        }
        if (zap.originalUrl) {
            if (zap.originalUrl.startsWith("http://") ||
                zap.originalUrl.startsWith("https://")) {
                if (req.headers.accept && req.headers.accept.includes("text/html")) {
                    res.redirect(zap.originalUrl);
                }
                else {
                    res.json({ url: zap.originalUrl, type: "redirect" });
                }
            }
            else if (zap.originalUrl.startsWith("TEXT_CONTENT:")) {
                const textContent = zap.originalUrl.substring(13);
                if (req.headers.accept && req.headers.accept.includes("text/html")) {
                    const html = generateTextHtml(zap.name || "Untitled", textContent);
                    res.set("Content-Type", "text/html");
                    res.send(html);
                }
                else {
                    res.json({ content: textContent, type: "text", name: zap.name });
                }
            }
            else if (zap.originalUrl.startsWith("DOCX_CONTENT:") ||
                zap.originalUrl.startsWith("PPTX_CONTENT:")) {
                const textContent = zap.originalUrl.substring(13);
                if (req.headers.accept && req.headers.accept.includes("text/html")) {
                    const html = generateTextHtml(zap.name || "Untitled", textContent);
                    res.set("Content-Type", "text/html");
                    res.send(html);
                }
                else {
                    res.json({ content: textContent, type: "document", name: zap.name });
                }
            }
            else {
                const base64Data = zap.originalUrl;
                const matches = base64Data.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
                if (matches) {
                    const mimeType = matches[1];
                    const base64 = matches[2];
                    const buffer = Buffer.from(base64, "base64");
                    if (req.headers.accept && req.headers.accept.includes("text/html")) {
                        res.set("Content-Type", mimeType);
                        res.send(buffer);
                    }
                    else {
                        res.json({ data: base64Data, type: "image", name: zap.name });
                    }
                }
                else {
                    res.status(400).json({ error: "Invalid base64 image data" });
                }
            }
        }
        else if (zap.cloudUrl) {
            if (req.headers.accept && req.headers.accept.includes("text/html")) {
                res.redirect(zap.cloudUrl);
            }
            else {
                res.json({ url: zap.cloudUrl, type: "file" });
            }
        }
        else {
            res.status(500).json(new ApiError_1.ApiError(500, "Zap content not found."));
        }
    }
    catch (error) {
        res.status(500).json(new ApiError_1.ApiError(500, "Internal server error"));
    }
});
exports.getZapByShortId = getZapByShortId;
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
