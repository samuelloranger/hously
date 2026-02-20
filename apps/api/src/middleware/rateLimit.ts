import { rateLimit } from 'elysia-rate-limit';

/**
 * Global rate limiting configuration
 * Default: 1000 requests per hour (matching Flask configuration)
 */
export const globalRateLimit = rateLimit({
  duration: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 1000,
  generator: (req) => {
    // Unauthenticated traffic is limited by IP (similar to Flask's get_remote_address)
    return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  },
  skip: (req) => {
    // Skip rate limiting for requests that look authenticated.
    // These will be verified by the auth middleware downstream.
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) return true;

    const cookie = req.headers.get('cookie');
    if (cookie && (cookie.includes('auth=') || cookie.includes('refreshToken='))) return true;

    return false;
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
