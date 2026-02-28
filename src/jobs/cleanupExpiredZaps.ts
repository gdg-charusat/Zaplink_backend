import prisma from "../utils/prismClient";
import cloudinary from "../middlewares/cloudinary";

/**
 * Extracts the Cloudinary public_id from a full Cloudinary URL
 * Example: https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg
 * Returns: sample (or folder/sample if nested)
 */
function extractPublicId(cloudUrl: string): string | null {
    try {
        const url = new URL(cloudUrl);
        const pathParts = url.pathname.split("/");

        // Cloudinary URLs follow pattern: /[cloud_name]/[resource_type]/[type]/[version]/[public_id_with_extension]
        const uploadIndex = pathParts.findIndex((part) => part === "upload");
        if (uploadIndex !== -1 && uploadIndex + 2 < pathParts.length) {
            // Skip version (v12345...) and get public_id with path
            const publicIdWithExt = pathParts.slice(uploadIndex + 2).join("/");
            // Remove file extension
            const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");
            return publicId;
        }
        return null;
    } catch (error) {
        console.error("[Cleanup] Error parsing Cloudinary URL:", error);
        return null;
    }
}

/**
 * Cleanup job that deletes expired Zaps from database and cloud storage
 * Runs periodically to free up resources and reduce costs
 */
export async function cleanupExpiredZaps(): Promise<void> {
    try {
        const now = new Date();
        console.log(`[Cleanup] Starting cleanup job at ${now.toISOString()}`);

        // Find all expired Zaps
        const expiredZaps = await prisma.zap.findMany({
            where: {
                expiresAt: {
                    lt: now,
                },
                NOT: {
                    expiresAt: null,
                },
            },
        });

        console.log(`[Cleanup] Found ${expiredZaps.length} expired Zaps`);

        if (expiredZaps.length === 0) {
            console.log("[Cleanup] No expired Zaps to clean up");
            return;
        }

        let deletedFromCloud = 0;
        let deletedFromDb = 0;
        let cloudErrors = 0;

        // Process each expired Zap
        for (const zap of expiredZaps) {
            try {
                // Delete from Cloudinary if cloudUrl exists
                if (zap.cloudUrl && zap.cloudUrl.includes("cloudinary")) {
                    const publicId = extractPublicId(zap.cloudUrl);
                    if (publicId) {
                        try {
                            await cloudinary.uploader.destroy(publicId, {
                                resource_type: "auto",
                            });
                            deletedFromCloud++;
                            console.log(`[Cleanup] Deleted from cloud: ${publicId}`);
                        } catch (cloudError: any) {
                            cloudErrors++;
                            console.error(
                                `[Cleanup] Failed to delete ${zap.id} from Cloudinary:`,
                                cloudError.message || cloudError
                            );
                        }
                    }
                }

                // Delete from database
                await prisma.zap.delete({
                    where: { id: zap.id },
                });
                deletedFromDb++;
                console.log(`[Cleanup] Deleted Zap from DB: ${zap.shortId}`);
            } catch (error: any) {
                console.error(
                    `[Cleanup] Failed to delete Zap ${zap.id}:`,
                    error.message || error
                );
            }
        }

        console.log(
            `[Cleanup] Cleanup completed - DB: ${deletedFromDb} deleted, Cloud: ${deletedFromCloud} deleted, Errors: ${cloudErrors}`
        );
    } catch (error: any) {
        console.error("[Cleanup] Cleanup job failed:", error.message || error);
    }
}
