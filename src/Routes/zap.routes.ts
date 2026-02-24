import express from "express";
import upload from "../middlewares/upload";
import {
  createZap,
  getZapByShortId,
  deleteZap,
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
router.post("/upload", upload.single("file"), createZap);

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
router.get("/:shortId", getZapByShortId);
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

/**
 * @swagger
 * /api/zaps/{shortId}:
 *   delete:
 *     summary: Delete a Zap using deletion token
 *     tags: [Zaps]
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *         description: The short ID of the Zap to delete
 *         example: abc123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deletionToken
 *             properties:
 *               deletionToken:
 *                 type: string
 *                 description: The deletion token provided when the Zap was created
 *                 example: clxyz_secret_token_789
 *     responses:
 *       200:
 *         description: Zap deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Zap deleted successfully
 *       400:
 *         description: Deletion token is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Invalid deletion token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Zap not found
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
router.delete("/:shortId", deleteZap);

export default router;
