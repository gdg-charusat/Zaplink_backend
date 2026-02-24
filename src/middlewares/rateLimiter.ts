import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

type ZapPasswordAttemptRecord = {
    count: number;
    resetAt: number;
};

const zapPasswordAttemptStore = new Map<string, ZapPasswordAttemptRecord>();

const toPositiveIntOrDefault = (value: string | undefined, fallback: number) => {
    const parsed = parseInt(value || "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getZapPasswordAttemptConfig = () => ({
    windowMs: toPositiveIntOrDefault(
        process.env.ZAP_PASSWORD_ATTEMPT_WINDOW_MS,
        15 * 60 * 1000
    ),
    max: toPositiveIntOrDefault(process.env.ZAP_PASSWORD_ATTEMPT_MAX, 5),
});

const getZapPasswordAttemptKey = (req: Request, shortId: string) => {
    return `${req.ip}:${shortId}`;
};

export const registerInvalidZapPasswordAttempt = (
    req: Request,
    shortId: string
) => {
    const now = Date.now();
    const { windowMs, max } = getZapPasswordAttemptConfig();
    const key = getZapPasswordAttemptKey(req, shortId);

    let record = zapPasswordAttemptStore.get(key);

    if (!record || record.resetAt <= now) {
        record = { count: 0, resetAt: now + windowMs };
    }

    record.count += 1;
    zapPasswordAttemptStore.set(key, record);

    return {
        isBlocked: record.count > max,
        retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
        attempts: record.count,
        max,
    };
};

export const clearZapPasswordAttemptCounter = (req: Request, shortId: string) => {
    const key = getZapPasswordAttemptKey(req, shortId);
    zapPasswordAttemptStore.delete(key);
};

/**
 * Builds a consistent 429 Too Many Requests JSON response
 * using the same ApiError shape used throughout the project.
 */
const tooManyRequestsHandler = (
    req: Request,
    res: Response,
    _next: Function,
    options: { message: string }
) => {
    res.status(429).json({
        statusCode: 429,
        message: options.message,
        success: false,
        errors: [],
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// Global API limiter
// Applied to every /api/* route as a baseline.
// Config: RATE_LIMIT_WINDOW_MS  (default: 15 min)
//         RATE_LIMIT_MAX        (default: 100 requests)
// ─────────────────────────────────────────────────────────────────────────────
export const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "") || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || "") || 100,
    standardHeaders: true,   // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,    // Disable X-RateLimit-* legacy headers
    message: "Too many requests. Please try again later.",
    handler: tooManyRequestsHandler,
    skip: (req) =>
        req.path === "/favicon.ico" ||
        req.path === "/" ||
        req.path === "/health",
});

// ─────────────────────────────────────────────────────────────────────────────
// Upload & QR generation limiter  (POST /api/zaps/upload)
// Stricter because each request hits Cloudinary and generates a QR code.
// Config: UPLOAD_RATE_LIMIT_WINDOW_MS  (default: 1 min)
//         UPLOAD_RATE_LIMIT_MAX        (default: 10 requests)
// ─────────────────────────────────────────────────────────────────────────────
export const uploadLimiter = rateLimit({
    windowMs:
        parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || "") || 1 * 60 * 1000,
    max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || "") || 10,
    standardHeaders: true,
    legacyHeaders: false,
    message:
        "Upload limit exceeded. You can upload at most 10 files per minute. Please wait and try again.",
    handler: tooManyRequestsHandler,
});

// ─────────────────────────────────────────────────────────────────────────────
// Download / Zap-access limiter  (GET /api/zaps/:shortId)
// Prevents bulk scraping / automated mass-download of shared content.
// Config: DOWNLOAD_RATE_LIMIT_WINDOW_MS  (default: 1 min)
//         DOWNLOAD_RATE_LIMIT_MAX        (default: 30 requests)
// ─────────────────────────────────────────────────────────────────────────────
export const downloadLimiter = rateLimit({
    windowMs:
        parseInt(process.env.DOWNLOAD_RATE_LIMIT_WINDOW_MS || "") || 1 * 60 * 1000,
    max: parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX || "") || 30,
    standardHeaders: true,
    legacyHeaders: false,
    message:
        "Too many download requests from this IP. Please slow down and try again in a minute.",
    handler: tooManyRequestsHandler,
});
