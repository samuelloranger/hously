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
 * Sanitize rich text using an allowlist approach.
 * Only permits safe tags and strips everything else via HTML entity escaping.
 * Allowed tags: b, i, u, strong, em, p, br, ul, ol, li, h1-h6, a (href only)
 */
const ALLOWED_TAGS = new Set([
  "b", "i", "u", "strong", "em", "p", "br", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6", "a",
]);

export const sanitizeRichText = (input: string): string => {
  // Replace all HTML tags: keep only allowed tags with safe attributes
  return input.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/gi, (match, tag, attrs) => {
    const tagLower = tag.toLowerCase();
    const isClosing = match.startsWith("</");

    if (!ALLOWED_TAGS.has(tagLower)) {
      // Escape the entire tag
      return match.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    if (isClosing) {
      return `</${tagLower}>`;
    }

    // For allowed tags, only keep href on <a> tags
    let safeAttrs = "";
    if (tagLower === "a") {
      const hrefMatch = attrs.match(/href\s*=\s*"([^"]*?)"/i)
        || attrs.match(/href\s*=\s*'([^']*?)'/i);
      if (hrefMatch) {
        const href = hrefMatch[1];
        // Block javascript: and data: URIs
        if (!/^\s*(javascript|data|vbscript):/i.test(href)) {
          safeAttrs = ` href="${href.replace(/"/g, "&quot;")}"`;
        }
      }
    }

    const selfClosing = tagLower === "br" ? " /" : "";
    return `<${tagLower}${safeAttrs}${selfClosing}>`;
  });
};

/**
 * Valid color validation for custom events
 * Allows hex colors (#RRGGBB) and common color names
 */
export const isValidColor = (color: string): boolean => {
  return /^#[0-9A-Fa-f]{6}$/.test(color) || /^[a-zA-Z]+$/.test(color);
};
