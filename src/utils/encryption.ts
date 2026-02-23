import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ENCRYPTION_KEY = process.env.TEXT_ENCRYPTION_KEY;
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For GCM mode
const AUTH_TAG_LENGTH = 16; // Authentication tag length for GCM
const SALT_LENGTH = 64; // Salt length for key derivation

/**
 * Validates that the encryption key is properly configured
 * @throws Error if encryption key is not set or invalid
 */
const validateEncryptionKey = (): void => {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.trim().length === 0) {
    throw new Error(
      "TEXT_ENCRYPTION_KEY is not set in environment variables. Please configure it in .env file."
    );
  }
  if (ENCRYPTION_KEY.length < 32) {
    throw new Error(
      "TEXT_ENCRYPTION_KEY must be at least 32 characters long for secure encryption."
    );
  }
};

/**
 * Derives a 32-byte encryption key from the master key using PBKDF2
 * @param salt - Salt for key derivation
 * @returns Derived key buffer
 */
const deriveKey = (salt: Buffer): Buffer => {
  if (!ENCRYPTION_KEY) {
    throw new Error("Encryption key is not configured");
  }
  return crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, "sha256");
};

/**
 * Encrypts text content using AES-256-GCM
 * @param text - Plain text to encrypt
 * @returns Encrypted text in format: salt:iv:authTag:encryptedData (all base64 encoded)
 * @throws Error if encryption fails or key is invalid
 */
export const encryptText = (text: string): string => {
  try {
    validateEncryptionKey();

    if (!text || text.length === 0) {
      throw new Error("Cannot encrypt empty text");
    }

    // Generate random salt for key derivation
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Derive encryption key from master key
    const key = deriveKey(salt);

    // Generate random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");

    // Get authentication tag (for GCM mode integrity verification)
    const authTag = cipher.getAuthTag();

    // Combine salt, iv, authTag, and encrypted data
    // Format: salt:iv:authTag:encryptedData (all base64 encoded)
    const result = [
      salt.toString("base64"),
      iv.toString("base64"),
      authTag.toString("base64"),
      encrypted,
    ].join(":");

    return result;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error(
      `Failed to encrypt text: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

/**
 * Decrypts text content encrypted with encryptText function
 * @param encryptedText - Encrypted text in format: salt:iv:authTag:encryptedData
 * @returns Decrypted plain text
 * @throws Error if decryption fails, data is corrupted, or key is invalid
 */
export const decryptText = (encryptedText: string): string => {
  try {
    validateEncryptionKey();

    if (!encryptedText || encryptedText.length === 0) {
      throw new Error("Cannot decrypt empty text");
    }

    // Split the encrypted text into its components
    const parts = encryptedText.split(":");
    if (parts.length !== 4) {
      throw new Error(
        "Invalid encrypted text format. Data may be corrupted or not properly encrypted."
      );
    }

    const [saltBase64, ivBase64, authTagBase64, encryptedData] = parts;

    // Convert from base64 to buffers
    const salt = Buffer.from(saltBase64, "base64");
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");

    // Validate buffer lengths
    if (salt.length !== SALT_LENGTH) {
      throw new Error("Invalid salt length. Data may be corrupted.");
    }
    if (iv.length !== IV_LENGTH) {
      throw new Error("Invalid IV length. Data may be corrupted.");
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid auth tag length. Data may be corrupted.");
    }

    // Derive the same key using the stored salt
    const key = deriveKey(salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the text
    let decrypted = decipher.update(encryptedData, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("Unsupported state or unable to authenticate data")) {
        throw new Error(
          "Failed to decrypt text: Invalid encryption key or corrupted data"
        );
      }
      throw new Error(`Failed to decrypt text: ${error.message}`);
    }
    
    throw new Error("Failed to decrypt text: Unknown error occurred");
  }
};

/**
 * Checks if a string appears to be encrypted by our encryption function
 * @param text - Text to check
 * @returns true if text appears to be encrypted, false otherwise
 */
export const isEncrypted = (text: string): boolean => {
  if (!text) return false;
  
  // Check if format matches our encryption format (4 base64 parts separated by colons)
  const parts = text.split(":");
  if (parts.length !== 4) return false;
  
  // Basic validation that each part looks like base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return parts.every(part => part.length > 0 && base64Regex.test(part));
};
