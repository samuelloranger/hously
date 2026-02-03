/**
 * Validation utilities for email and password
 */

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}

/**
 * Validate password requirements
 * Returns [isValid, errorMessage]
 */
export function validatePassword(
  password: string
): [boolean, string | null] {
  if (!password) {
    return [false, "Password is required"];
  }
  if (password.length < 8) {
    return [false, "Password must be at least 8 characters long"];
  }
  return [true, null];
}
