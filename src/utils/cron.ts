import cron from "node-cron";
import prisma from "./prismClient";
import { deleteFromCloudinary } from "./cloudinaryHelper";

export const initializeCronJobs = () => {
    // Run every hour at minute 0
    cron.schedule("0 * * * *", async () => {
        console.log("[Cron] Running expired Zaps cleanup job...");
        try {
            const now = new Date();

            // Find all zaps that have expired
            const expiredZaps = await prisma.zap.findMany({
                where: {
                    expiresAt: {
                        lt: now,
                    },
                },
            });

            if (expiredZaps.length === 0) {
                console.log("[Cron] No expired zaps found.");
                return;
            }

            console.log(`[Cron] Found ${expiredZaps.length} expired zaps to clean up.`);

            for (const zap of expiredZaps) {
                if (zap.cloudUrl) {
                    await deleteFromCloudinary(zap.cloudUrl);
                }
                await prisma.zap.delete({
                    where: { id: zap.id },
                });
                console.log(`[Cron] Cleaned up Zap: ${zap.shortId}`);
            }

            console.log("[Cron] Expired Zaps cleanup completed.");
        } catch (error) {
            console.error("[Cron] Error during expired Zaps cleanup:", error);
        }
    });
};
