import express from "express";
import upload from "../middlewares/upload";
import {
  createZap,
  getZapByShortId,
  verifyZapPassword,
  // shortenUrl,
} from "../controllers/zap.controller";
import {
  uploadLimiter,
  downloadLimiter,
} from "../middlewares/rateLimiter";

const router = express.Router();

/**
 * POST /api/zaps/upload
 * Rate limit: 10 requests / min per IP  (uploadLimiter)
 * Also triggers QR code generation — compute-heavy, kept strict.
 */
router.post("/upload", uploadLimiter, upload.single("file"), createZap);

/**
 * GET /api/zaps/:shortId
 * Rate limit: 30 requests / min per IP  (downloadLimiter)
 * Prevents bulk scraping / automated mass-download of shared content.
 */
router.get("/:shortId", downloadLimiter, getZapByShortId);

/**
 * POST /api/zaps/:shortId/access
 * Rate limit: 30 requests / min per IP  (downloadLimiter)
 * Secure password verification for password-protected Zaps.
 * Password sent via request body instead of URL query parameters.
 */
router.post("/:shortId/access", downloadLimiter, verifyZapPassword);

// router.post("/shorten", (req, res) => shortenUrl(req, res));

export default router;
