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

// Swagger UI documentation
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

// ──────────────────────────────────────────────────────────────────────────────
// ── Scheduled Cleanup Jobs (Single Cron Strategy) ────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────

const cleanupJob = cron.schedule("0 * * * *", async () => {
  console.log("[Cron] Running scheduled Zap cleanup...");
  try {
    const expiredCount = await deleteExpiredZaps().then(() => "done");
    const overLimitCount = await deleteOverLimitZaps().then(() => "done");
    console.log("[Cron] Cleanup complete.");
  } catch (error) {
    console.error("[Cron] Cleanup job failed:", error);
  }
});

console.log(`[Scheduler] Cleanup job scheduled: every hour at minute 0`);

// ──────────────────────────────────────────────────────────────────────────────
// ── Error Handling ─────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────

// 404 handler (after all routes)
app.use(notFoundHandler);

// Global error handler (MUST be last)
app.use(errorHandler);

// ──────────────────────────────────────────────────────────────────────────────
// ── Server Startup & Graceful Shutdown ─────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────

const PORT = config.PORT;
let server: any;

async function startServer() {
  try {
    server = app.listen(PORT, () => {
      console.log(`\n[Server] ✓ Running on port ${PORT}`);
      console.log(`[Server] Environment: ${config.NODE_ENV}`);
      console.log(`[Server] Docs: http://localhost:${PORT}/api-docs\n`);
    });
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string) {
  console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully...`);

  try {
    // Stop accepting new requests
    server?.close(() => {
      console.log("[Shutdown] HTTP server closed");
    });

    // Stop cleanup job
    cleanupJob.stop();
    console.log("[Shutdown] Cleanup job stopped");

    // Wait for in-flight requests (5 second timeout)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("[Shutdown] ✓ Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("[Shutdown] Error during shutdown:", error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Uncaught exceptions (exit after logging)
process.on("uncaughtException", (error) => {
  console.error("[Uncaught Exception]", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Unhandled Rejection]", { reason, promise });
});

// Start the server
startServer();
