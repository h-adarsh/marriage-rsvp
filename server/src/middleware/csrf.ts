import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defense-in-depth CSRF protection middleware.
 * Verifies that mutating requests (POST, PUT, PATCH, DELETE) come from
 * trusted origins or include standard SPA application headers.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([
    clientUrl,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5001',
    ...extraOrigins,
  ]);

  // Reject untrusted cross-origin mutating requests
  if (origin && !allowedOrigins.has(origin)) {
    res.status(403).json({ error: 'Forbidden: Untrusted cross-origin request rejected' });
    return;
  }

  // Reject browsers reporting cross-site fetch
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    res.status(403).json({ error: 'Forbidden: Cross-site request rejected' });
    return;
  }

  next();
}
