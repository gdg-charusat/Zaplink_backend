import { Request, Response } from "express";
import prisma from "../utils/prismClient";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { getAnalytics } from "../services/analytics.service";

/**
 * GET /api/analytics/:shortId?token=<deletionToken>
 *
 * Returns analytics data for a Zap. Requires the deletionToken
 * (returned at Zap creation) for authorization.
 *
 * Query params:
 *   - token  (required) — the deletionToken for this Zap
 *   - limit  (optional) — max recent access logs to return (default 50)
 */
export const getZapAnalytics = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { shortId } = req.params;
        const { token, limit } = req.query;

        // ── Validate input ──────────────────────────────────────────────────
        if (!shortId) {
            res.status(400).json(new ApiError(400, "shortId parameter is required."));
            return;
        }

        if (!token || typeof token !== "string") {
            res
                .status(401)
                .json(
                    new ApiError(
                        401,
                        "Authorization required. Provide your deletionToken as ?token=<value>."
                    )
                );
            return;
        }

        // ── Find the Zap ────────────────────────────────────────────────────
        const zap = await prisma.zap.findUnique({
            where: { shortId },
            select: { id: true, deletionToken: true },
        });

        if (!zap) {
            res.status(404).json(new ApiError(404, "Zap not found."));
            return;
        }

        // ── Verify authorization ────────────────────────────────────────────
        if (!zap.deletionToken || token !== zap.deletionToken) {
            res
                .status(403)
                .json(
                    new ApiError(
                        403,
                        "Forbidden. Invalid token — you are not authorized to view analytics for this Zap."
                    )
                );
            return;
        }

        // ── Fetch analytics ─────────────────────────────────────────────────
        const parsedLimit = limit ? parseInt(limit as string, 10) : 50;
        const analyticsLimit =
            !isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 200
                ? parsedLimit
                : 50;

        const analytics = await getAnalytics(zap.id, analyticsLimit);

        if (!analytics) {
            res.status(404).json(new ApiError(404, "Analytics data not found."));
            return;
        }

        res
            .status(200)
            .json(
                new ApiResponse(200, analytics, "Analytics retrieved successfully.")
            );
    } catch (error) {
        console.error("[Analytics Controller] Error:", error);
        res.status(500).json(new ApiError(500, "Internal Server Error."));
    }
};
