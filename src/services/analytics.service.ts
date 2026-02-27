import crypto from "crypto";
import { Request } from "express";
import { UAParser } from "ua-parser-js";
import prisma from "../utils/prismClient";

/**
 * Hashes an IP address using SHA-256 for privacy.
 * Returns null if no IP is available.
 */
const hashIp = (ip: string | undefined): string | null => {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
};

/**
 * Parses the device type from a User-Agent string.
 * Returns "Desktop", "Mobile", "Tablet", or "Unknown".
 */
const parseDeviceType = (userAgent: string | undefined): string => {
  if (!userAgent) return "Unknown";
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();
  return device.type
    ? device.type.charAt(0).toUpperCase() + device.type.slice(1)
    : "Desktop";
};

/**
 * Logs an analytics entry for a Zap access.
 * This function is designed to be called asynchronously (fire-and-forget)
 * so it does NOT delay the response to the user.
 *
 * @param zapId - The database ID of the Zap (not shortId)
 * @param req   - The Express request object
 */
export const logAccess = async (
  zapId: string,
  req: Request
): Promise<void> => {
  try {
    const userAgent = req.headers["user-agent"] || null;
    const ipHash = hashIp(req.ip);
    const deviceType = parseDeviceType(userAgent || undefined);

    await prisma.zapAnalytics.create({
      data: {
        zapId,
        userAgent,
        ipHash,
        deviceType,
      },
    });
  } catch (error) {
    // Silently fail — analytics logging should never break the main flow
    console.error("[Analytics] Failed to log access:", error);
  }
};

/**
 * Retrieves analytics data for a specific Zap.
 *
 * @param zapId - The database ID of the Zap
 * @param limit - Max number of recent access logs to return (default 50)
 * @returns Analytics summary object
 */
export const getAnalytics = async (zapId: string, limit: number = 50) => {
  // Get total view count from the Zap itself
  const zap = await prisma.zap.findUnique({
    where: { id: zapId },
    select: { viewCount: true, name: true, shortId: true, createdAt: true },
  });

  if (!zap) return null;

  // Get device breakdown
  const allAnalytics = await prisma.zapAnalytics.findMany({
    where: { zapId },
    select: { deviceType: true },
  });

  const deviceBreakdown: Record<string, number> = {};
  for (const entry of allAnalytics) {
    const device = entry.deviceType || "Unknown";
    deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;
  }

  // Get recent access logs (paginated)
  const recentAccess = await prisma.zapAnalytics.findMany({
    where: { zapId },
    orderBy: { accessedAt: "desc" },
    take: limit,
    select: {
      id: true,
      userAgent: true,
      deviceType: true,
      accessedAt: true,
    },
  });

  return {
    zapName: zap.name,
    shortId: zap.shortId,
    createdAt: zap.createdAt,
    totalViews: zap.viewCount,
    uniqueDeviceTypes: Object.keys(deviceBreakdown).length,
    deviceBreakdown,
    recentAccess,
  };
};
