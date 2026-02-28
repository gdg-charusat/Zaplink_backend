/**
 * ZapLink Backend Server
 *
 * Architecture:
 * - Centralized middleware config (src/middlewares/config.ts)
 * - Global error handling (src/middlewares/errorHandler.ts)
 * - Request logging (src/middlewares/logger.ts)
 * - Environment validation (src/config/env.ts)
 * - Graceful shutdown with cleanup jobs
 */

import express from "express";
import dotenv from "dotenv";
import cron from "node-cron";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";

// ── Configuration ──────────────────────────────────────────────────────────────
import { initEnvConfig, getEnvConfig } from "./config/env";
import { setupMiddleware, setupHealthRoutes } from "./middlewares/config";
import { errorHandler, notFoundHandler, asyncHandler } from "./middlewares/errorHandler";
import { requestLogger } from "./middlewares/logger";

// ── Routes & Services ──────────────────────────────────────────────────────────
import routes from "./Routes/index";
import { globalLimiter } from "./middlewares/rateLimiter";
import {
  deleteExpiredZaps,
  deleteOverLimitZaps,
} from "./utils/cleanup";
import rateLimit from "express-rate-limit";
import { cleanupExpiredZaps } from "./jobs/cleanupExpiredZaps";
import multer from "multer";
import { initializeCronJobs } from "./utils/cron";
import prisma from "./utils/prismClient";
import { requestLogger } from "./middlewares/logger";

dotenv.config();

/**
 * Initialize and validate environment config
 * Fails fast if required vars are missing
 */
let config: ReturnType<typeof initEnvConfig>;
try {
  config = initEnvConfig();
  console.log(`[Config] Environment validated. NODE_ENV=${config.NODE_ENV}`);
} catch (error: any) {
  console.error("[Config Error]", error.message);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────────
// ── App Setup ──────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────

const app = express();

// Setup health check routes first (skip middleware for performance)
setupHealthRoutes(app);

// Apply all middleware (centralized configuration)
setupMiddleware(app);

// Request logging middleware
app.use(requestLogger);

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

// Request Logging Middleware
app.use(requestLogger);

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
app.get('/health', (req: any, res: any) => {
  res.status(200).send('OK');
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ZapLink API Documentation',
}));

// ──────────────────────────────────────────────────────────────────────────────
// ── API Routes ─────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────

// Apply global rate limiter to all /api routes
app.use("/api", globalLimiter);

// Register all API routes
app.use("/api", routes);

// ── Scheduled Cleanup Jobs ────────────────────────────────────────────────────
// Runs every hour at minute 0 — sweeps expired and over-limit Zaps.
const cleanupTask = cron.schedule("0 * * * *", async () => {
  console.log("[Cron] Running scheduled Zap cleanup...");
  try {
    const expiredCount = await deleteExpiredZaps().then(() => "done");
    const overLimitCount = await deleteOverLimitZaps().then(() => "done");
    console.log("[Cron] Cleanup complete.");
  } catch (error) {
    console.error("[Cron] Cleanup job failed:", error);
  }
});

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
let server: any;
if (process.env.NODE_ENV !== "test") {
  server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

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
const cleanupInterval = setInterval(cleanupExpiredZaps, CLEANUP_INTERVAL_MS);

export default app;

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  // Guard: prevent duplicate shutdown from multiple signals
  if (isShuttingDown) {
    console.log(`[Shutdown] Already shutting down, ignoring ${signal}.`);
    return;
  }
  isShuttingDown = true;

  console.log(`\n[Shutdown] Received ${signal}. Starting graceful shutdown...`);

  // 1. Start force-exit timeout FIRST — covers entire shutdown process
  const forceExitTimeout = setTimeout(() => {
    console.error("[Shutdown] Forced exit after 10s timeout.");
    process.exit(1);
  }, 10_000);
  forceExitTimeout.unref();

  // 2. Stop accepting new connections and wait for in-flight requests
  await new Promise<void>((resolve) => {
    if (server) {
      server.close(() => {
        console.log("[Shutdown] HTTP server closed.");
        resolve();
      });
    } else {
      resolve();
    }
  });

  // 3. Stop cron jobs
  try {
    cleanupTask.stop();
    console.log("[Shutdown] Cron jobs stopped.");
  } catch (err) {
    console.error("[Shutdown] Error stopping cron jobs:", err);
  }

  // 4. Stop interval-based cleanup
  clearInterval(cleanupInterval);
  console.log("[Shutdown] Cleanup interval cleared.");

  // 5. Disconnect Prisma client
  try {
    await prisma.$disconnect();
    console.log("[Shutdown] Prisma client disconnected.");
  } catch (err) {
    console.error("[Shutdown] Error disconnecting Prisma:", err);
  }

  console.log("[Shutdown] Graceful shutdown complete.");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));


