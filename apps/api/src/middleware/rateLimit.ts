import { rateLimit } from 'elysia-rate-limit';

/**
 * Global rate limiting configuration
 * Default: 1000 requests per hour (matching Flask configuration)
 */
export const globalRateLimit = rateLimit({
  duration: 60 * 60 * 1000, // 1 hour in milliseconds
  max: ((key: string) => (key.startsWith('user:') ? 10000 : 1000)) as any,
  generator: (req, _server, derived: { user?: { id: number } | null }) => {
    if (derived.user?.id) {
      return `user:${derived.user.id}`;
    }

    return `ip:${req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'}`;
  },
  errorResponse: 'Too many requests. Please try again later.',
});

/**
 * Auth rate limiting configuration
 * Strict rate limit for all authentication endpoints to prevent brute force attacks
 */
export const authRateLimit = rateLimit({
  duration: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute across all auth endpoints
  generator: req =>
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown',
  errorResponse: 'Too many authentication requests. Please wait a minute before trying again.',
});
