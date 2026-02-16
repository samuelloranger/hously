export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateEmail(email: string): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email);
}

export const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
} as const;

export function validatePassword(password: string): [boolean, string | null] {
  if (!password) {
    return [false, 'Password is required'];
  }
  if (password.length < PASSWORD_RULES.minLength) {
    return [false, 'Password must be at least 8 characters long'];
  }
  return [true, null];
}
