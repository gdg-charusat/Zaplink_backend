/**
 * Centralized Middleware Configuration
 * Single source of truth for all Express middleware setup
 */

import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { getEnvConfig } from "../config/env";

/**
 * Apply all middleware to the Express app
 * This ensures consistent middleware order and configuration
 */
export function setupMiddleware(app: Express): void {
  const config = getEnvConfig();

  // ── Trust proxy (must be before cors/helmet) ────────────────────────────────
  app.set("trust proxy", 1);

  // ── Security Headers ──────────────────────────────────────────────────────────
  app.use(helmet());

  // ── Body Parsing (JSON & URL-encoded) ─────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── Cookie Parsing ───────────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── CORS (Unified Configuration) ──────────────────────────────────────────────
  // Single source of truth: uses CORS_ORIGIN env var or defaults to FRONTEND_URL
  const allowedOrigins = config.CORS_ORIGIN;
  
  app.use(
    cors({
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      maxAge: 3600, // 1 hour
    }),
  );
}

/**
 * Setup basic health check routes (before middleware)
 * These routes skip middleware for performance
 */
export function setupHealthRoutes(app: Express): void {
  // No CORS/middleware on these - serve immediately
  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });
  
  app.get("/", (_req, res) => {
    res.status(200).send("ZapLink API Root");
  });
  
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });
}
