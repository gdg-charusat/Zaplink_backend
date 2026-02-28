/**
 * Request/Response Logger Middleware
 * Logs all HTTP requests and responses with timing info
 */

import { Request, Response, NextFunction } from "express";

interface RequestLog {
  method: string;
  path: string;
  query: any;
  statusCode?: number;
  duration?: number;
  timestamp: string;
  ip: string;
  userAgent?: string;
}

/**
 * Logger middleware for HTTP requests
 * Tracks: method, path, status, response time, client IP
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const originalSend = res.send;

  // Intercept response to log after sending
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Fast-path: skip logging healthchecks and favicon
    const skipPaths = ["/favicon.ico", "/health"];
    if (!skipPaths.includes(req.path)) {
      const log: RequestLog = {
        method: req.method,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        statusCode,
        duration,
        timestamp: new Date().toISOString(),
        ip: req.ip || "unknown",
        userAgent: req.get("user-agent"),
      };

      // Log slow requests or errors
      if (duration > 1000 || statusCode >= 400) {
        const level = statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";
        console.log(`[${level}] ${JSON.stringify(log)}`);
      }
    }

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Express trust proxy logger
 * Logs client IP resolution for debugging
 */
export function logClientIp(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const clientIp =
    req.ip ||
    req.socket.remoteAddress ||
    "unknown";

  // Attach to request for use in other middleware
  (req as any).clientIp = clientIp;

  next();
}
