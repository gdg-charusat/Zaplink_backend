import express from "express";
import upload from "../middlewares/upload";
import {
  createZap,
  getZapByShortId,
  accessZap,
  getZapMetadata,
  verifyQuizForZap,
  // shortenUrl,
} from "../controllers/zap.controller";
import rateLimit from "express-rate-limit";
import {
  uploadLimiter,
  downloadLimiter,
} from "../middlewares/rateLimiter";

const notFoundLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // allow 20 invalid IDs per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip ?? "unknown",

    // Count ONLY failed (404) responses
    requestWasSuccessful: (_req, res) => {
        return res.statusCode !== 404;
    },

    message: {
        error: "Too many invalid Zap IDs. Slow down.",
    },
});

const router = express.Router();

/**
 * POST /api/zaps/upload
 * Rate limit: 10 requests / min per IP  (uploadLimiter)
 * Also triggers QR code generation — compute-heavy, kept strict.
 */
router.post("/upload", uploadLimiter, upload.single("file"), createZap);

/**
 * GET /api/zaps/:shortId/metadata
 * Rate limit: 30 requests / min per IP (downloadLimiter)
 * Get metadata about a Zap without accessing file content
 */
router.get("/:shortId/metadata", downloadLimiter, getZapMetadata);

/**
 * POST /api/zaps/:shortId/verify-quiz
 * Rate limit: 30 requests / min per IP (downloadLimiter) 
 * Verify quiz answer
 */
router.post("/:shortId/verify-quiz", downloadLimiter, verifyQuizForZap);

/**
 * GET /api/zaps/:shortId
 * Rate limit: 30 requests / min per IP  (downloadLimiter)
 * Public access — serves non-password-protected Zaps.
 * Password-protected Zaps return 401 and require POST /:shortId/access.
 */
router.get("/:shortId", downloadLimiter, notFoundLimiter, getZapByShortId);

/**
 * POST /api/zaps/:shortId/access
 * Rate limit: 30 requests / min per IP  (downloadLimiter)
 * Secure access for password-protected Zaps.
 * Password is sent in the request body — never in the URL.
 * Body: { "password": "..." }
 */
router.post("/:shortId/access", downloadLimiter, accessZap);

export default router;
