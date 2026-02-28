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
router.post(
  "/upload",
  uploadLimiter,
  upload.single("file"),
  sanitizeBody,
  validate(createZapSchema),
  createZap,
);

/**
 * @swagger
 * /api/zaps/{shortId}/metadata:
 *   get:
 *     summary: Get metadata about a Zap without accessing content
 *     tags: [Zaps]
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *         example: abc123
 *     responses:
 *       200:
 *         description: Metadata retrieved successfully
 *       404:
 *         description: Zap not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:shortId/metadata",
  sanitizeParams,
  downloadLimiter,
  validate(getZapMetadataSchema),
  getZapMetadata,
);

/**
 * @swagger
 * /api/zaps/{shortId}/verify-quiz:
 *   post:
 *     summary: Verify quiz answer for a quiz-protected Zap
 *     tags: [Zaps]
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *         example: abc123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quizAnswer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Quiz answer correct
 *       401:
 *         description: Incorrect answer
 *       404:
 *         description: Zap not found
 *       500:
 *         description: Server error
 */
router.post(
  "/:shortId/verify-quiz",
  sanitizeParams,
  sanitizeBody,
  downloadLimiter,
  validate(verifyQuizForZapSchema),
  verifyQuizForZap,
);

/**
 * @swagger
 * /api/zaps/shorten:
 *   post:
 *     summary: Shorten a URL
 *     tags: [Zaps]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               originalUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: URL shortened
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post("/shorten", downloadLimiter, shortenUrl);

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
 *       - in: query
 *         name: quizAnswer
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
