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
      const { password } = req.query;

      const file = await prisma.file.findUnique({
        where: { zapId },
      });

      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      if (file.expiresAt && new Date() > file.expiresAt) {
        res.status(410).json({ error: "File has expired" });
        return;
      }

      const now = new Date();
      console.log(
        `[${now.toISOString()}] ZapId: ${zapId}, Current views: ${
          file.views
        }, Max views: ${file.maxViews}`
      );
      if (file.maxViews && file.views >= file.maxViews) {
        if (file.selfDestruct) {
          await prisma.file.delete({ where: { zapId } });
        }
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
      const updatedFile = await prisma.file.update({
        where: { zapId },
        data: { views: { increment: 1 } },
      });
      if (updatedFile.maxViews && updatedFile.views > updatedFile.maxViews) {
        if (updatedFile.selfDestruct) {
          await prisma.file.delete({ where: { zapId } });
        }
        res.status(410).json({
          error: "View limit exceeded",
          message: "View limit exceeded",
        });
        return;
      }
      res.json({
        name: file.name,
        type: file.type,
        size: file.size,
        url: file.url,
        expiresAt: file.expiresAt,
        views: updatedFile.views,
        maxViews: file.maxViews,
      });
    } catch (error) {
      console.error("Error getting file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
