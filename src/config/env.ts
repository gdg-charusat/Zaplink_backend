/**
 * Environment Configuration & Validation
 * Centralizes env var access and validates required vars at startup
 */

interface EnvConfig {
  // Server
  PORT: number;
  NODE_ENV: "development" | "production" | "test";
  
  // Frontend & CORS
  FRONTEND_URL: string;
  CORS_ORIGIN: string[];
  
  // Database
  DATABASE_URL: string;
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
  UPLOAD_RATE_LIMIT_WINDOW_MS: number;
  UPLOAD_RATE_LIMIT_MAX: number;
  DOWNLOAD_RATE_LIMIT_WINDOW_MS: number;
  DOWNLOAD_RATE_LIMIT_MAX: number;
  ZAP_PASSWORD_ATTEMPT_WINDOW_MS: number;
  ZAP_PASSWORD_ATTEMPT_MAX: number;
  
  // Cleanup Jobs
  CLEANUP_INTERVAL_MS: number;
  
  // Security
  ENCRYPTION_KEY?: string;
  JWT_SECRET?: string;
}

/**
 * Apply backward compatibility for legacy Cloudinary env var names
 * Maps old names to new names if needed
 */
function applyCloudinaryBackwardCompat(): void {
  // Support legacy env variable names
  if (!process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_ACCOUNT) {
    process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_ACCOUNT;
  }
  if (!process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_KEY) {
    process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_KEY;
  }
  if (!process.env.CLOUDINARY_API_SECRET && process.env.CLOUDINARY_SECRET) {
    process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_SECRET;
  }
}

/**
 * Parse and validate environment variables
 * Throws error if required vars are missing (unless in test mode)
 */
export function validateEnv(): EnvConfig {
  // Apply backward compatibility first
  applyCloudinaryBackwardCompat();

  const isTestMode = process.env.NODE_ENV === "test";
  
  const requiredVars = [
    "DATABASE_URL",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);
  
  // In test mode, log warnings instead of failing; use defaults
  if (missing.length > 0) {
    if (isTestMode) {
      console.warn(
        `[Env] Warning: Missing env vars in test mode: ${missing.join(", ")}. Using defaults.`
      );
    } else {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please check your .env file."
      );
    }
  }

  return {
    PORT: parseInt(process.env.PORT || "3000", 10),
    NODE_ENV: (process.env.NODE_ENV || "development") as any,
    FRONTEND_URL: process.env.FRONTEND_URL || "https://zaplink.krishnapaljadeja.com",
    CORS_ORIGIN: (process.env.CORS_ORIGIN || "http://localhost:5173")
      .split(",")
      .map((o) => o.trim()),
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/zaplink_test",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || (isTestMode ? "test-cloud" : ""),
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || (isTestMode ? "test-key" : ""),
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || (isTestMode ? "test-secret" : ""),
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
    UPLOAD_RATE_LIMIT_WINDOW_MS: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || "60000", 10),
    UPLOAD_RATE_LIMIT_MAX: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || "10", 10),
    DOWNLOAD_RATE_LIMIT_WINDOW_MS: parseInt(process.env.DOWNLOAD_RATE_LIMIT_WINDOW_MS || "60000", 10),
    DOWNLOAD_RATE_LIMIT_MAX: parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX || "30", 10),
    ZAP_PASSWORD_ATTEMPT_WINDOW_MS: parseInt(process.env.ZAP_PASSWORD_ATTEMPT_WINDOW_MS || "900000", 10),
    ZAP_PASSWORD_ATTEMPT_MAX: parseInt(process.env.ZAP_PASSWORD_ATTEMPT_MAX || "5", 10),
    CLEANUP_INTERVAL_MS: parseInt(process.env.CLEANUP_INTERVAL_MS || "3600000", 10),
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    JWT_SECRET: process.env.JWT_SECRET,
  };
}

// Singleton instance - validated at startup
let envConfig: EnvConfig | null = null;
let isValidationAttempted = false;

/**
 * Get validated environment config
 * Returns cached config if available, otherwise attempts validation
 */
export function getEnvConfig(): EnvConfig {
  if (!envConfig) {
    // Auto-initialize if not already done (useful for tests)
    if (!isValidationAttempted) {
      return initEnvConfig();
    }
    throw new Error("Environment not validated yet. Call validateEnv() or initEnvConfig() first.");
  }
  return envConfig;
}

/**
 * Initialize and cache validated config
 * Safe to call multiple times; returns cached value after first call
 */
export function initEnvConfig(): EnvConfig {
  if (!envConfig) {
    isValidationAttempted = true;
    try {
      envConfig = validateEnv();
    } catch (error) {
      isValidationAttempted = true;
      // In test mode, allow graceful degradation
      if (process.env.NODE_ENV === "test") {
        console.warn("[Env] Validation failed in test mode, using defaults");
        envConfig = validateEnv();
      } else {
        throw error;
      }
    }
  }
  return envConfig;
}

/**
 * Reset env config (useful for testing)
 */
export function resetEnvConfig(): void {
  envConfig = null;
  isValidationAttempted = false;
}
