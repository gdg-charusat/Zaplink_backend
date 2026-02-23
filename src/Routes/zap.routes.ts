import express from "express";
import upload from "../middlewares/upload";
import {
  createZap,
  getZapByShortId,
  accessZap,
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
 * Public access — serves non-password-protected Zaps.
 * Password-protected Zaps return 401 and require POST /:shortId/access.
 */
router.get("/:shortId", downloadLimiter, getZapByShortId);

/**
 * POST /api/zaps/:shortId/access
 * Rate limit: 30 requests / min per IP  (downloadLimiter)
 * Secure access for password-protected Zaps.
 * Password is sent in the request body — never in the URL.
 * Body: { "password": "..." }
 */
router.post("/:shortId/access", downloadLimiter, accessZap);

export default router;
