import { rateLimit } from "elysia-rate-limit";

/**
 * Global rate limiting configuration
 * Default: 1000 requests per hour (matching Flask configuration)
 */
const SESSION_COOKIE = "better-auth.session_token";

function getSessionToken(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE}=`)) {
      return trimmed.slice(SESSION_COOKIE.length + 1) || null;
    }
  }
  return null;
}

export const globalRateLimit = rateLimit({
  duration: 60 * 60 * 1000,
  max: ((key: string) =>
    key.startsWith("session:") ? 10000 : 1000) as unknown as number,
  generator: (req) => {
    const session = getSessionToken(req);
    if (session) return `session:${session}`;
    return `ip:${req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown"}`;
  },
  errorResponse: "Too many requests. Please try again later.",
});
