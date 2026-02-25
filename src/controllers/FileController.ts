import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../utils/prismClient";
import dotenv from "dotenv";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

dotenv.config();
export class FileController {
  async getFile(req: Request, res: Response) {
    try {
      const { zapId } = req.params;
      const providedPassword = req.query.password as string | undefined;

    // 1. Fetch the Zap record
    const zap = await prisma.zap.findUnique({
      where: { shortId: zapId },
    });

    if (!zap) {
      res.status(404).json(new ApiError(404, "File not found"));
      return;
    }

    // 2. Check Expiration
    if (zap.expiresAt && new Date() > zap.expiresAt) {
      res.status(410).json(new ApiError(410, "File has expired"));
      return;
    }

    // 4. Password Validation (Fixed Variable Names)
    if (zap.passwordHash) {
      if (!providedPassword) {
        res.status(401).json(new ApiError(401, "Password required for this file"));
        return;
      }

      const isPasswordValid = await bcrypt.compare(
        providedPassword,
        zap.passwordHash
      );

      if (!isPasswordValid) {
        res.status(401).json(new ApiError(401, "Invalid password"));
        return;
      }
    }

    // Bug Fix #2: Fixed view limit logic - single check before increment
    // 3. Check View Limits before incrementing
    if (zap.viewLimit !== null && zap.viewCount >= zap.viewLimit) {
      res.status(410).json(new ApiError(410, "View limit exceeded"));
      return;
    }

    // 5. Increment View Count
    const updatedZap = await prisma.zap.update({
      where: { shortId: zapId },
      data: { viewCount: { increment: 1 } },
    });

    // 7. Return File Data
    res.status(200).json(new ApiResponse(200, {
      name: zap.name,
      type: zap.type,
      // size: zap.size,
      url: zap.cloudUrl || zap.originalUrl,
      expiresAt: zap.expiresAt,
      views: updatedZap.viewCount,
      maxViews: zap.viewLimit,
    }, "File retrieved successfully"));

  } catch (error) {
    console.error("Error getting file [T066]:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
  }
};

// Bug Fix #3: Removed duplicate getZapMetadata function
// The authoritative version is in zap.controller.ts with more complete metadata