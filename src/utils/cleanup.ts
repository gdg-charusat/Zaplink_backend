import prisma from "./prismClient";
import { destroyZap } from "../controllers/zap.controller";

/**
 * Delete all expired Zaps from the database and Cloudinary.
 * Called on a schedule (every hour) to sweep orphaned files.
 */
export const deleteExpiredZaps = async (): Promise<void> => {
    try {
        const now = new Date();

        // Find all Zaps that have passed their expiration time
        const expiredZaps = await prisma.zap.findMany({
            where: {
                expiresAt: {
                    lt: now,
                },
            },
        });

        if (expiredZaps.length === 0) return;

        console.log(`[Cleanup] Found ${expiredZaps.length} expired Zap(s). Deleting...`);

        for (const zap of expiredZaps) {
            await destroyZap(zap);
        }

        console.log(`[Cleanup] Successfully cleaned up ${expiredZaps.length} expired Zap(s).`);
    } catch (error) {
        console.error("[Cleanup] Error during expired Zap sweep:", error);
    }
};

/**
 * Delete all Zaps that have exceeded their view limit.
 * These may exist if the on-access cleanup failed.
 */
export const deleteOverLimitZaps = async (): Promise<void> => {
    try {
        // Find Zaps where viewCount >= viewLimit (non-null limits only)
        const overLimitZaps: any[] = await prisma.$queryRawUnsafe(
            `SELECT * FROM "Zap"
       WHERE "maxViews" IS NOT NULL
         AND "viewCount" >= "maxViews"`
        );

        if (overLimitZaps.length === 0) return;

        console.log(`[Cleanup] Found ${overLimitZaps.length} over-limit Zap(s). Deleting...`);

        for (const zap of overLimitZaps) {
            await destroyZap(zap);
        }

        console.log(`[Cleanup] Successfully cleaned up ${overLimitZaps.length} over-limit Zap(s).`);
    } catch (error) {
        console.error("[Cleanup] Error during over-limit Zap sweep:", error);
    }
};
