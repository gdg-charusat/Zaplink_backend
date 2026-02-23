import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import routes from "./Routes/index";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import { globalLimiter } from "./middlewares/rateLimiter";
import {
  deleteExpiredZaps,
  deleteOverLimitZaps,
} from "./utils/cleanup";

dotenv.config();

const app = express();

app.set("trust proxy", 1);

// ── Security Hardening ────────────────────────────────────────────────────────
// Helmet sets sensible HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());

// CORS restricted to the configured frontend origin
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://zaplink.krishnapaljadeja.com";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// ── Utility Routes (excluded from rate limiting) ─────────────────────────────
app.get("/favicon.ico", (req: any, res: any) => res.status(204).end());
app.get("/", (req: any, res: any) => res.status(200).send("ZapLink API Root"));
app.get("/health", (req: any, res: any) => res.status(200).send("OK"));

// ── Global Rate Limiter ───────────────────────────────────────────────────────
// Applied to all routes below. Sensitive routes (/upload, /:shortId) get
// additional, stricter limiters applied directly in zap.routes.ts.
// Defaults: 100 requests per 15 minutes per IP (configurable via .env).
app.use(globalLimiter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api", routes);

// ── Scheduled Cleanup Jobs ────────────────────────────────────────────────────
// Runs every hour at minute 0 — sweeps expired and over-limit Zaps.
cron.schedule("0 * * * *", async () => {
  console.log("[Cron] Running scheduled Zap cleanup...");
  await deleteExpiredZaps();
  await deleteOverLimitZaps();
  console.log("[Cron] Cleanup complete.");
});

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
