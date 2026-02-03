import { rateLimit } from "elysia-rate-limit";
import { Elysia } from "elysia";

/**
 * Global rate limiting configuration
 * Default: 1000 requests per hour (matching Flask configuration)
 */
export const globalRateLimit = rateLimit({
  duration: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 1000,
  generator: (req) => {
    // Use IP address as the key (similar to Flask's get_remote_address)
    return (
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown"
    );
  },
  errorResponse: "Too many requests. Please try again later.",
});

/**
 * Auth rate limiting configuration
 * Strict rate limit for all authentication endpoints to prevent brute force attacks
 */
export const authRateLimit = rateLimit({
  duration: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute across all auth endpoints
  generator: (req) =>
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown",
  errorResponse:
    "Too many authentication requests. Please wait a minute before trying again.",
});
