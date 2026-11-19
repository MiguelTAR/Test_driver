// CLients - side validation for the login form
// The sever must validate again
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**Trim spaces and lowercae, so "ABCD@Mail.com" = "abcd@mail.com" */
export function normalizeEmail(email: string): string {
return email.trim().toLowerCase();
}
/**Returns an error message, or null when the email is valid */
export function validateEmail(value: string): string | null {
const email = normalizeEmail(value);
   if (email.length === 0) return 'Email is required';
   if (!EMAIL_PATTERN.test(email)) return 'Email is invalid';
   return null;
}
/** Returns an error message, or null when the password is present. Not trimmed, spaces can be part of a password. */
export function validatePassword(value: string): string | null {
    if (value.length === 0) return 'Password is required';
    return null;
}
/** For choosing a NEW password (reset screen). Returns an error message, or null when OK. */
export function validateNewPassword(value: string): string | null {
    if (value.length === 0) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    return null;
}

/** The reset code is 6 digits. */
export function validateResetCode(value: string): string | null {
    return /^\d{6}$/.test(value.trim()) ? null : 'Enter the 6-digit code';
}