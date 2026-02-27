import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./Routes/index";
import cookieParser from "cookie-parser";
import { globalLimiter } from "./middlewares/rateLimiter";
import { cleanupExpiredZaps } from "./jobs/cleanupExpiredZaps";

dotenv.config();

const app = express();

app.set("trust proxy", 1);


app.use(cors());
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

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// ── Cleanup Job ───────────────────────────────────────────────────────────────
// Cleanup expired Zaps every hour (configurable via CLEANUP_INTERVAL_MS env var)
const CLEANUP_INTERVAL_MS = parseInt(
  process.env.CLEANUP_INTERVAL_MS || "3600000"
); // Default: 1 hour

console.log(
  `[Cleanup] Scheduled cleanup job every ${CLEANUP_INTERVAL_MS / 1000 / 60} minutes`
);

// Run cleanup immediately on startup
cleanupExpiredZaps();

// Schedule periodic cleanup
setInterval(cleanupExpiredZaps, CLEANUP_INTERVAL_MS);
