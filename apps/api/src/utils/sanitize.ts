/**
 * Input sanitization utility functions for the Elysia server.
 * These are shared across multiple route handlers to prevent XSS and other attacks.
 */

/**
 * Sanitize plain text input - basic HTML escape to prevent XSS
 * Use for user inputs that should not contain any HTML
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
};

/**
 * Sanitize rich text - removes dangerous tags/attributes but allows some HTML
 * Use for user inputs that may contain formatted content (descriptions, instructions)
 * Note: For production, consider using a library like DOMPurify
 */
export const sanitizeRichText = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "");
};

/**
 * Valid color validation for custom events
 * Allows hex colors (#RRGGBB) and common color names
 */
export const isValidColor = (color: string): boolean => {
  return /^#[0-9A-Fa-f]{6}$/.test(color) || /^[a-zA-Z]+$/.test(color);
};
