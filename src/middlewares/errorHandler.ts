/**
 * Global Error Handling Middleware
 * Standardizes error responses across the application
 */

import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Enhanced error interface with optional logging
 */
interface ErrorWithStack extends Error {
  statusCode?: number;
  errors?: any[];
  stack?: string;
}

/**
 * Global error handler middleware
 * Should be the LAST middleware registered
 */
export function errorHandler(
  err: ErrorWithStack,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const isDev = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = err.errors || [];

  // Log error details (always log in dev, selective in prod)
  if (isDev || statusCode >= 500) {
    console.error("[Error Handler]", {
      statusCode,
      message,
      path: req.path,
      method: req.method,
      errors,
      stack: isDev ? err.stack : undefined,
    });
  }

  // Sanitize error message for production
  if (isProduction && statusCode === 500) {
    message = "Internal Server Error";
    errors = [];
  }

  // Return standardized error response
  res.status(statusCode).json({
    statusCode,
    message,
    success: false,
    errors: isDev ? errors : [],
    timestamp: new Date().toISOString(),
    ...(isDev && { stack: err.stack }),
  });
}

/**
 * Async error wrapper for route handlers
 * Catches promise rejections and passes to error handler
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      // Ensure error has ApiError structure
      if (!(err instanceof ApiError) && !err.statusCode) {
        err = new ApiError(
          500,
          err.message || "Internal Server Error",
          [err],
        );
      }
      next(err);
    });
  };
}

/**
 * 404 Not Found handler
 * Should be registered after all routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.status(404).json({
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.path}`,
    success: false,
    errors: [],
  });
}
