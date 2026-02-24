export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
}

export const validatePasswordStrength = (password: string): PasswordValidationResult => {
    const errors: string[] = [];

    if (!password) return { isValid: false, errors: ["Password is required"] };
    if (password.length < 8) errors.push("Minimum 8 characters required");
    if (password.length > 128) errors.push("Maximum 128 characters allowed");
    if (!/[A-Z]/.test(password)) errors.push("Must contain uppercase letter");
    if (!/[a-z]/.test(password)) errors.push("Must contain lowercase letter");
    if (!/[0-9]/.test(password)) errors.push("Must contain number");
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
        errors.push("Must contain special character");
    }

    const commonPasswords = ["password", "12345678", "qwerty123", "password123"];
    if (commonPasswords.includes(password.toLowerCase())) {
        errors.push("Password too common");
    }

    return { isValid: errors.length === 0, errors };
};
