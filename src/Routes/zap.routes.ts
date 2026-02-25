import express from "express";
import upload from "../middlewares/upload";
import {
  createZap,
  getZapByShortId,
  getZapMetadata,
  verifyQuizForZap,
  // shortenUrl,
} from "../controllers/zap.controller";
import rateLimit from "express-rate-limit";
import { uploadLimiter, downloadLimiter } from "../middlewares/rateLimiter";
import { validateRequest } from "../middlewares/validate";
import {
  createZapSchema,
  getZapByShortIdSchema,
  shortIdParamSchema,
  verifyQuizForZapSchema,
} from "../validations/zap.validation";

const notFoundLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // allow 20 invalid IDs per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip ?? "unknown",

    // Count ONLY failed (404) responses
    requestWasSuccessful: (_req, res) => {
        return res.statusCode !== 404;
    },

    message: {
        error: "Too many invalid Zap IDs. Slow down.",
    },
});

const router = express.Router();

router.post(
  "/upload",
  uploadLimiter,
  upload.single("file"),
  validateRequest(createZapSchema),
  createZap,
);

router.get(
  "/:shortId",
  downloadLimiter,
  notFoundLimiter,
  validateRequest(getZapByShortIdSchema),
  getZapByShortId,
);

router.get(
  "/:shortId/metadata",
  downloadLimiter,
  validateRequest(shortIdParamSchema),
  getZapMetadata,
);

router.post(
  "/:shortId/verify-quiz",
  downloadLimiter,
  validateRequest(verifyQuizForZapSchema),
  verifyQuizForZap,
);

// router.post("/shorten", (req, res) => shortenUrl(req, res));

export default router;
