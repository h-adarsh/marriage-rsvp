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

// Rate limiter for public RSVP routes
export const rsvpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTest ? 1000 : 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many RSVP requests. Please slow down.',
  },
});
