import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Returns the set of trusted origins based on the current environment.
 * In production, localhost is strictly excluded. If no origins are configured,
 * returns an empty set which enforces default-deny on all mutating requests.
 */
export function getAllowedOrigins(): Set<string> {
  const isProd = process.env.NODE_ENV === 'production';
  const origins = new Set<string>();

  const clientUrl = process.env.CLIENT_URL?.trim();
  if (clientUrl) {
    origins.add(clientUrl);
  }

  const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  for (const o of extraOrigins) {
    origins.add(o);
  }

  // Development / test local defaults
  if (!isProd) {
    origins.add('http://localhost:5173');
    origins.add('http://localhost:5174');
    origins.add('http://localhost:5001');
  }

  return origins;
}

/**
 * Defense-in-depth CSRF protection middleware.
 * Verifies that mutating requests (POST, PUT, PATCH, DELETE) come from
 * trusted origins or include standard SPA application headers.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = getAllowedOrigins();

  // In production with an empty allowed list, reject all mutating requests by default
  if (isProd && allowedOrigins.size === 0) {
    res.status(403).json({ error: 'Forbidden: No trusted origins configured for production' });
    return;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Extract source origin from Origin header or fallback to Referer origin
  let requestOrigin: string | null = null;
  if (origin) {
    requestOrigin = origin;
  } else if (referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      res.status(403).json({ error: 'Forbidden: Malformed referer header' });
      return;
    }
  }

  // In production, reject if neither Origin nor Referer is provided for mutating requests
  if (isProd && !requestOrigin) {
    res.status(403).json({ error: 'Forbidden: Missing Origin and Referer on state-changing request' });
    return;
  }

  // Reject untrusted cross-origin mutating requests
  if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
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

