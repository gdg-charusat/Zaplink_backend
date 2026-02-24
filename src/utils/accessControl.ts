import bcrypt from "bcrypt";
import { Zap } from "@prisma/client";

/**
 * Check if a file has delayed access enabled and if it's accessible
 * @param zap - The Zap record
 * @returns { isLocked: boolean, unlockTime: Date | null }
 */
export const checkDelayedAccess = (
  zap: Zap
): { isLocked: boolean; unlockTime: Date | null } => {
  if (!zap.unlockAt) {
    return { isLocked: false, unlockTime: null };
  }

  const now = new Date();
  const unlockTime = new Date(zap.unlockAt);
  const isLocked = now.getTime() < unlockTime.getTime();

  return { isLocked, unlockTime };
};

/**
 * Check if a file has quiz protection enabled
 * @param zap - The Zap record
 * @returns boolean
 */
export const hasQuizProtection = (zap: Zap): boolean => {
  return !!(zap.quizQuestion && zap.quizAnswerHash);
};

/**
 * Verify quiz answer
 * @param providedAnswer - The user's answer
 * @param hashedAnswer - The stored hashed answer
 * @returns Promise<boolean>
 */
export const verifyQuizAnswer = async (
  providedAnswer: string,
  hashedAnswer: string
): Promise<boolean> => {
  try {
    return await bcrypt.compare(providedAnswer, hashedAnswer);
  } catch (error) {
    console.error("Error verifying quiz answer:", error);
    return false;
  }
};

/**
 * Hash a quiz answer for storage
 * @param answer - The quiz answer to hash
 * @param rounds - Number of bcrypt rounds (default 10)
 * @returns Promise<string>
 */
export const hashQuizAnswer = async (
  answer: string,
  rounds: number = 10
): Promise<string> => {
  try {
    return await bcrypt.hash(answer.trim().toLowerCase(), rounds);
  } catch (error) {
    console.error("Error hashing quiz answer:", error);
    throw new Error("Failed to hash quiz answer");
  }
};

/**
 * Determine access validation result
 */
export type AccessValidationResult =
  | { allowed: true; reason?: string }
  | {
      allowed: false;
      reason: "quiz_required" | "delayed_access_locked" | "both_locked";
      quizQuestion?: string;
      unlockTime?: Date;
    };

/**
 * Validate access to a file based on its access controls
 * @param zap - The Zap record
 * @param quizAnswered - Whether the user has answered the quiz (from query/session)
 * @returns AccessValidationResult
 */
export const validateFileAccess = (
  zap: Zap,
  quizAnswered: boolean = false
): AccessValidationResult => {
  const delayedAccessCheck = checkDelayedAccess(zap);
  const hasQuiz = hasQuizProtection(zap);

  // Check both conditions
  const quizLocked = hasQuiz && !quizAnswered;
  const delayedLocked = delayedAccessCheck.isLocked;

  if (quizLocked && delayedLocked) {
    return {
      allowed: false,
      reason: "both_locked",
      quizQuestion: zap.quizQuestion || undefined,
      unlockTime: delayedAccessCheck.unlockTime || undefined,
    };
  }

  if (quizLocked) {
    return {
      allowed: false,
      reason: "quiz_required",
      quizQuestion: zap.quizQuestion || undefined,
    };
  }

  if (delayedLocked) {
    return {
      allowed: false,
      reason: "delayed_access_locked",
      unlockTime: delayedAccessCheck.unlockTime || undefined,
    };
  }

  return { allowed: true };
};
