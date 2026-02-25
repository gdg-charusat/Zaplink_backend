import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../utils/prismClient";
import dotenv from "dotenv";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

/**
 * Team T066 - File Retrieval Logic
 * Fixed undefined variables and added type safety for Express handlers
 */
export const getFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { zapId } = req.params;
    const providedPassword = req.query.password as string | undefined;

    if (!zapId) {
      res.status(400).json({ message: "Zap ID is required" });
      return;
    }

    // continue your file retrieval logic here...

  } catch (error) {
    console.error("Error retrieving file:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

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

    // 3. Check View Limits
    if (zap.viewLimit !== null && zap.viewCount >= zap.viewLimit) {
  res.status(410).json(new ApiError(410, "View limit exceeded"));
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

    // 5. Increment View Count
   const updateResult = await prisma.zap.updateMany({
  where: {
    shortId: zapId,
    OR: [
      { viewLimit: null },
      { viewCount: { lt: zap.viewLimit ?? undefined } }
    ]
  },
  data: { viewCount: { increment: 1 } },
});

if (updateResult.count === 0) {
  res.status(410).json(new ApiError(410, "View limit exceeded"));
  return;
}
const updatedZap = await prisma.zap.findUnique({
  where: { shortId: zapId },
});

if (!updatedZap) {
  res.status(404).json(new ApiError(404, "File not found after update"));
  return;
}

    // 6. Final Check for View Limit after increment
    if (
      updatedZap.viewLimit !== null &&
      updatedZap.viewCount > updatedZap.viewLimit
    ) {
      res.status(410).json(new ApiError(410, "View limit exceeded"));
      return;
    }

    // 7. Return File Data
res.status(200).json(
  new ApiResponse(200, {
    name: updatedZap.name,
    type: updatedZap.type,
    size: updatedZap.size,
    url: updatedZap.cloudUrl || updatedZap.originalUrl,
    expiresAt: updatedZap.expiresAt,
  })
);
      views: updatedZap.viewCount,
      maxViews: updatedZap.viewLimit,
    },
    "File retrieved successfully"
  )
);

  } catch (error) {
    console.error("Error getting file [T066]:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
  }
};

// Added placeholder metadata function to satisfy Route requirements
export const getZapMetadata = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shortId } = req.params;
        const zap = await prisma.zap.findUnique({ where: { shortId } });
        if (!zap) { res.status(404).json(new ApiError(404, "Zap not found")); return; }
        res.status(200).json(new ApiResponse(200, { name: zap.name, type: zap.type, hasPassword: !!zap.passwordHash }, "Metadata retrieved"));
    } catch (e) { res.status(500).json(new ApiError(500, "Error")); }
};