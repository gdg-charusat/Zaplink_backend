import express from "express";
import upload from "../middlewares/upload";
import {
  createZap,
  getZapByShortId,
  getZapMetadata,
  verifyQuizForZap,
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
 * Prevents bulk scraping / automated mass-download of shared content.
 */
router.get("/:shortId", downloadLimiter, getZapByShortId);

// router.post("/shorten", (req, res) => shortenUrl(req, res));

export default router;
