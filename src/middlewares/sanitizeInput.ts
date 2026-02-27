import { Request, Response, NextFunction } from "express";
import {
  sanitizeText,
  sanitizeUrl,
  sanitizeQuizInput,
  isSuspiciousInput,
} from "../utils/sanitizer";

/**
 * Middleware to sanitize common text fields in request body
 * Protects against XSS and injection attacks
 */
export const sanitizeBody = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.body || typeof req.body !== "object") {
    next();
    return;
  }

  // Sanitize common text fields
  const fieldsToSanitize = ["name", "quizQuestion", "textContent"];
  const fieldsToSanitizeUrl = ["originalUrl"];
  const fieldsToSanitizeQuiz = ["quizAnswer"];

  for (const field of fieldsToSanitize) {
    if (req.body[field] && typeof req.body[field] === "string") {
      // Check for suspicious patterns
      if (isSuspiciousInput(req.body[field])) {
        res.status(400).json({
          statusCode: 400,
          message: `Field "${field}" contains potentially malicious content`,
          success: false,
          errors: [],
        });
        return;
      }
      req.body[field] = sanitizeText(req.body[field]);
    }
  }

  for (const field of fieldsToSanitizeUrl) {
    if (req.body[field] && typeof req.body[field] === "string") {
      const sanitized = sanitizeUrl(req.body[field]);
      if (!sanitized) {
        res.status(400).json({
          statusCode: 400,
          message: `Field "${field}" contains an invalid or unsafe URL`,
          success: false,
          errors: [],
        });
        return;
      }
      req.body[field] = sanitized;
    }
  }

  for (const field of fieldsToSanitizeQuiz) {
    if (req.body[field] && typeof req.body[field] === "string") {
      req.body[field] = sanitizeQuizInput(req.body[field]);
    }
  }

  next();
};

/**
 * Middleware to sanitize query parameters
 * Protects against XSS in URL parameters
 */
export const sanitizeQuery = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.query || typeof req.query !== "object") {
    next();
    return;
  }

  const fieldsToSanitize = ["password", "quizAnswer"];

  for (const field of fieldsToSanitize) {
    if (req.query[field] && typeof req.query[field] === "string") {
      req.query[field] = sanitizeQuizInput(req.query[field]);
    }
  }

  next();
};

/**
 * Middleware to sanitize URL parameters
 */
export const sanitizeParams = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.params || typeof req.params !== "object") {
    next();
    return;
  }

  // Sanitize shortId to prevent injection
  if (req.params.shortId && typeof req.params.shortId === "string") {
    // shortId should only contain alphanumeric, limit length
    const sanitized = req.params.shortId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (sanitized !== req.params.shortId) {
      res.status(400).json({
        statusCode: 400,
        message: "Invalid shortId format",
        success: false,
        errors: [],
      });
      return;
    }
  }

  next();
};
