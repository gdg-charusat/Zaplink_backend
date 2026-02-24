import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import prisma from "../utils/prismClient";
import cloudinary from "../middlewares/cloudinary";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import dotenv from "dotenv";
dotenv.config();
export class FileController {
  async getFile(req: Request, res: Response) {
    try {
      const { zapId } = req.params;
      const providedPassword = req.query.password as string | undefined;

      const zap = await prisma.zap.findUnique({
        where: { shortId: zapId },
      });

      if (!zap) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      if (zap.expiresAt && new Date() > zap.expiresAt) {
        res.status(410).json({ error: "File has expired" });
        return;
      }

      const now = new Date();
      console.log(
        `[${now.toISOString()}] ZapId: ${zapId}, Current views: ${
          zap.viewCount
        }, Max views: ${zap.viewLimit}`
      );

      if (zap.viewLimit !== null && zap.viewCount >= zap.viewLimit) {
        return res.status(410).json({
          error: "View limit exceeded",
          message: "View limit exceeded",
        });
      }

      if (file.password) {
        if (!password) {
          res.status(401).json({ error: "Password required" });
          return;
        }

        const isPasswordValid = await bcrypt.compare(
          password as string,
          file.password
        );

        if (!isPasswordValid) {
          res.status(401).json({ error: "Invalid password" });
          return;
        }
      }

      const updatedZap = await prisma.zap.update({
        where: { shortId: zapId },
        data: { viewCount: { increment: 1 } },
      });

      if (
        updatedZap.viewLimit !== null &&
        updatedZap.viewCount > updatedZap.viewLimit
      ) {
        res.status(410).json({
          error: "View limit exceeded",
          message: "View limit exceeded",
        });
        return;
      }

      res.json({
        name: zap.name,
        type: zap.type,
        url: zap.cloudUrl || zap.originalUrl,
        expiresAt: zap.expiresAt,
        views: updatedZap.viewCount,
        maxViews: zap.viewLimit,
      });
    } catch (error) {
      console.error("Error getting file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
