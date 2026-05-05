import { rateLimit } from "elysia-rate-limit";

/**
 * Global rate limiting configuration
 * Default: 1000 requests per hour (matching Flask configuration)
 */
export const globalRateLimit = rateLimit({
  duration: 60 * 60 * 1000, // 1 hour in milliseconds
  max: ((key: string) =>
    key.startsWith("user:") ? 10000 : 1000) as unknown as number,
  generator: (req, _server, derived: { user?: { id: string } | null }) => {
    if (derived.user?.id) {
      return `user:${derived.user.id}`;
    }

    return `ip:${req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown"}`;
  },
  errorResponse: "Too many requests. Please try again later.",
});
