import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import routes from "./Routes/index";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import {
  deleteExpiredZaps,
  deleteOverLimitZaps,
} from "./utils/cleanup";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";
import { globalLimiter } from "./middlewares/rateLimiter";
import { cleanupExpiredZaps } from "./jobs/cleanupExpiredZaps";
import multer from "multer";
import { initializeCronJobs } from "./utils/cron";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
// Middleware
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "http://localhost:5173")
      .split(",")
      .map((o) => o.trim()),
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

/**
 * @swagger
 * /:
 *   get:
 *     summary: API root
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API root message
 */
app.get("/favicon.ico", (req: any, res: any) => res.status(204).end());
app.get("/", (req: any, res: any) => res.status(200).send("ZapLink API Root"));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
app.get('/health', (req:any, res:any) => {
  res.status(200).send('OK');
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ZapLink API Documentation',
}));


app.get("/health", (req: any, res: any) => {
  res.status(200).send("OK");
});

// Rate limiter for all routes except favicon and root
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "development" ? 1000 : 100, // higher in dev
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/favicon.ico" || req.path === "/",
});
app.use(apiLimiter);

// Use Routes
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
