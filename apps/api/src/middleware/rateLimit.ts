import { rateLimit } from "elysia-rate-limit";
import { auth } from "@hously/api/lib/auth";

/**
 * Global rate limiting configuration
 * Default: 1000 unauthenticated requests per hour.
 * Authenticated users bypass the limiter entirely.
 */
export const globalRateLimit = rateLimit({
  duration: 60 * 60 * 1000,
  max: 1000,
  skip: async (req) => {
    const session = await auth.api.getSession({ headers: req.headers });
    return Boolean(session);
  },
  generator: (req) =>
    `ip:${req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown"}`,
  errorResponse: "Too many requests. Please try again later.",
});
