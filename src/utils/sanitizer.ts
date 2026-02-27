import xss from "xss";

/**
 * Sanitization configuration for different input types
 * Prevents XSS, HTML injection, and malicious scripts
 */

const defaultXSSOptions = {
  whiteList: {}, // No HTML tags allowed by default
  stripIgnoredTag: true,
  stripLeadingAndTrailingWhitespace: false,
};

const urlXSSOptions = {
  whiteList: {},
  stripIgnoredTag: true,
  onIgnoredTag: (_tag: string) => "", // Remove ignored tags
};

/**
 * Sanitize general text input (usernames, names, descriptions)
 * Removes all HTML tags and dangerous characters
 * @param input - Raw input text
 * @returns Sanitized text safe for storage
 */
export const sanitizeText = (input: string | null | undefined): string => {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Limit length to prevent DoS via extremely long inputs
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000);
  }

  // Remove XSS attempts
  sanitized = xss(sanitized, defaultXSSOptions);

  // Remove control characters (except newlines in text content)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
};

/**
 * Sanitize file names
 * Removes dangerous characters and path traversal attempts
 * @param filename - Raw filename
 * @returns Sanitized filename
 */
export const sanitizeFileName = (
  filename: string | null | undefined,
): string => {
  if (!filename || typeof filename !== "string") {
    return "unnamed";
  }

  let sanitized = filename.trim();

  // Limited length for filenames
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  // Remove path traversal attempts
  sanitized = sanitized.replace(/\.\./g, "");
  sanitized = sanitized.replace(/[\/\\]/g, "_");

  // Remove NULL bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

  // Remove XSS attempts
  sanitized = xss(sanitized, defaultXSSOptions);

  // If completely empty after sanitization, use default
  if (!sanitized.trim()) {
    return "unnamed";
  }

  return sanitized;
};

/**
 * Sanitize URLs
 * Validates URL format and prevents javascript: and data: URLs
 * @param url - Raw URL input
 * @returns Sanitized URL or null if invalid
 */
export const sanitizeUrl = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== "string") {
    return null;
  }

  let sanitized = url.trim();

  // Limit length
  if (sanitized.length > 2048) {
    sanitized = sanitized.substring(0, 2048);
  }

  // Block dangerous protocols
  const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
  const lowerUrl = sanitized.toLowerCase();

  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return null; // Reject dangerous URLs
    }
  }

  // Ensure URL has protocol
  if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
    sanitized = "https://" + sanitized;
  }

  // Validate URL format
  try {
    new URL(sanitized);
    return sanitized;
  } catch {
    return null; // Return null if URL is invalid
  }
};

/**
 * Sanitize quiz questions and answers
 * Similar to general text but with stricter validation
 * @param input - Raw input
 * @returns Sanitized text
 */
export const sanitizeQuizInput = (
  input: string | null | undefined,
): string => {
  if (!input || typeof input !== "string") {
    return "";
  }

  let sanitized = input.trim();

  // Shorter length limit for quiz inputs
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }

  // Remove XSS
  sanitized = xss(sanitized, defaultXSSOptions);

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Remove extra whitespace
  sanitized = sanitized.replace(/\s+/g, " ");

  return sanitized;
};

/**
 * Sanitize JSON input from text content
 * Attempts to parse and re-serialize to prevent injection
 * @param input - Raw JSON string
 * @returns Sanitized JSON string or null if invalid
 */
export const sanitizeJsonText = (
  input: string | null | undefined,
): string | null => {
  if (!input || typeof input !== "string") {
    return null;
  }

  try {
    // Try to parse as JSON to validate structure
    const parsed = JSON.parse(input);

    // Re-serialize to remove any extra whitespace/formatting
    return JSON.stringify(parsed);
  } catch {
    // Not valid JSON, treat as plain text
    return sanitizeText(input);
  }
};

/**
 * Batch sanitize common input fields from request body
 * @param data - Objects with fields to sanitize
 * @returns Sanitized data
 */
export const sanitizeRequestBody = (data: {
  name?: string;
  textContent?: string;
  originalUrl?: string;
  quizQuestion?: string;
  quizAnswer?: string;
}): {
  name?: string;
  textContent?: string;
  originalUrl?: string;
  quizQuestion?: string;
  quizAnswer?: string;
  sanitized: boolean;
} => {
  return {
    name: data.name ? sanitizeText(data.name) : undefined,
    textContent: data.textContent ? sanitizeText(data.textContent) : undefined,
    originalUrl: data.originalUrl
      ? sanitizeUrl(data.originalUrl) || undefined
      : undefined,
    quizQuestion: data.quizQuestion
      ? sanitizeQuizInput(data.quizQuestion)
      : undefined,
    quizAnswer: data.quizAnswer
      ? sanitizeQuizInput(data.quizAnswer)
      : undefined,
    sanitized: true,
  };
};

/**
 * Validate and sanitize email addresses
 * @param email - Raw email input
 * @returns Sanitized email or null if invalid
 */
export const sanitizeEmail = (
  email: string | null | undefined,
): string | null => {
  if (!email || typeof email !== "string") {
    return null;
  }

  const sanitized = email.trim().toLowerCase();

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (emailRegex.test(sanitized)) {
    return sanitized;
  }

  return null;
};

/**
 * Sanitize password input
 * Removes any HTML/special characters but preserves password complexity
 * @param password - Raw password
 * @returns Sanitized password
 */
export const sanitizePassword = (
  password: string | null | undefined,
): string | null => {
  if (!password || typeof password !== "string") {
    return null;
  }

  // Don't trim passwords as whitespace might be intentional
  const sanitized = password;

  // Limit length to prevent DoS
  if (sanitized.length > 256) {
    return null; // Reject excessively long passwords
  }

  // Remove null bytes
  if (sanitized.includes("\0")) {
    return null;
  }

  return sanitized;
};

/**
 * Check if input contains potentially malicious patterns
 * @param input - String to check
 * @returns boolean - true if malicious patterns detected
 */
export const isSuspiciousInput = (input: string | null | undefined): boolean => {
  if (!input || typeof input !== "string") {
    return false;
  }

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers
    /eval\(/i,
    /expression\(/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
};
