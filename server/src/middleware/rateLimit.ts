import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

// Rate limiter for authentication endpoints (login, register)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTest ? 1000 : 10, // 10 attempts per minute in production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again after 1 minute.',
  },
});

// General rate limiter for public RSVP routes (generous for guests sharing Wi-Fi / IP)
export const rsvpGeneralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 100, // 100 requests per 15 min per IP in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many RSVP requests. Please slow down.',
  },
});

// Strict rate limiter for invalid/failed token lookup attempts per IP
// Only 4xx/5xx responses count against the limit (skipSuccessfulRequests: true)
export const rsvpInvalidTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 failed attempts per 15 minutes per IP
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many invalid token attempts. Please try again after 15 minutes.',
  },
});

// Deprecated alias for backwards compatibility
export const rsvpLimiter = rsvpGeneralLimiter;

/**
 * Helper to reset RSVP rate limit stores for test isolation
 */
export function resetRsvpLimiters(ip = '127.0.0.1'): void {
  try {
    (rsvpGeneralLimiter as any).resetKey?.(ip);
    (rsvpGeneralLimiter as any).resetKey?.(`::ffff:${ip}`);
    (rsvpInvalidTokenLimiter as any).resetKey?.(ip);
    (rsvpInvalidTokenLimiter as any).resetKey?.(`::ffff:${ip}`);
  } catch {
    // Ignore if not supported in environment
  }
}
