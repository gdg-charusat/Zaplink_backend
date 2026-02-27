import express from "express";
import { getZapAnalytics } from "../controllers/analytics.controller";
import { downloadLimiter } from "../middlewares/rateLimiter";

const router = express.Router();

/**
 * @swagger
 * /api/analytics/{shortId}:
 *   get:
 *     summary: Get analytics for a Zap
 *     description: |
 *       Returns click tracking analytics for a specific Zap.
 *       Requires the `deletionToken` (returned when the Zap was created) for authorization.
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *         description: The short ID of the Zap
 *         example: abc12345
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The deletionToken returned at Zap creation time
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *         description: Max number of recent access log entries to return
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsResponse'
 *       401:
 *         description: Missing authorization token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Invalid authorization token
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
router.get("/:shortId", downloadLimiter, getZapAnalytics);

export default router;
