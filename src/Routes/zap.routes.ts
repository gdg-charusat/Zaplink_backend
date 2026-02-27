import express from "express";
import upload from "../middlewares/upload";
import {
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
} from "../middlewares/sanitizeInput";
import {
  createZap,
  getZapByShortId,
  getZapMetadata,
  verifyQuizForZap,
  shortenUrl,
} from "../controllers/zap.controller";
import rateLimit from "express-rate-limit";
import {
  uploadLimiter,
  downloadLimiter,
} from "../middlewares/rateLimiter";
import { validate } from "../middlewares/validate.middleware";
import {
  createZapSchema,
  getZapMetadataSchema,
  verifyQuizForZapSchema,
  getZapByShortIdSchema,
} from "../validations/zap.validation";

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
 * @swagger
 * /api/zaps/upload:
 *   post:
 *     summary: Create a new Zap (file/URL/text)
 *     tags: [Zaps]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               type:
 *                 type: string
 *                 enum: [pdf, image, video, audio, archive, url, text, document, presentation, spreadsheet]
 *               name:
 *                 type: string
 *               originalUrl:
 *                 type: string
 *               textContent:
 *                 type: string
 *               password:
 *                 type: string
 *               viewLimit:
 *                 type: integer
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Zap created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZapResponse'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/zaps/{shortId}:
 *   get:
 *     summary: Get Zap by short ID
 *     tags: [Zaps]
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *         example: abc123
 *       - in: query
 *         name: password
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                 name:
 *                   type: string
 *                 cloudUrl:
 *                   type: string
 *                 originalUrl:
 *                   type: string
 *                 viewCount:
 *                   type: integer
 *                 viewLimit:
 *                   type: integer
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Invalid password
 *       404:
 *         description: Not found
 *       410:
 *         description: Expired or view limit exceeded
 *       500:
 *         description: Server error
 */
 /* POST /api/zaps/upload
 * Rate limit: 10 requests / min per IP  (uploadLimiter)
 * Also triggers QR code generation — compute-heavy, kept strict.
 * Sanitization: Applied to body and file names
 */
router.post(
  "/upload",
  uploadLimiter,
  upload.single("file"),
  sanitizeBody,
  validate(createZapSchema),
  createZap,
);

/**
 * GET /api/zaps/:shortId/metadata
 * Rate limit: 30 requests / min per IP (downloadLimiter)
 * Get metadata about a Zap without accessing file content
 * Sanitization: URL params and query params sanitized
 */
router.get(
  "/:shortId/metadata",
  sanitizeParams,
  downloadLimiter,
  validate(getZapMetadataSchema),
  getZapMetadata,
);

/**
 * POST /api/zaps/:shortId/verify-quiz
 * Rate limit: 30 requests / min per IP (downloadLimiter) 
 * Verify quiz answer
 * Sanitization: URL params and body sanitized
 */
router.post(
  "/:shortId/verify-quiz",
  sanitizeParams,
  sanitizeBody,
  downloadLimiter,
  validate(verifyQuizForZapSchema),
  verifyQuizForZap,
);

router.post("/shorten", downloadLimiter, shortenUrl);

/**
 * GET /api/zaps/:shortId
 * Rate limit: 30 requests / min per IP  (downloadLimiter)
 * Handles all access: public, password-protected, quiz-protected, etc.
 * Password/quiz passed as query params: ?password=xxx&quizAnswer=yyy
 * Sanitization: URL params and query params sanitized
 */
router.get(
  "/:shortId",
  sanitizeParams,
  sanitizeQuery,
  downloadLimiter,
  notFoundLimiter,
  validate(getZapByShortIdSchema),
  getZapByShortId,
);

export default router;
