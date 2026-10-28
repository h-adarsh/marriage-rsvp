import { Request, Response, NextFunction } from 'express';

/**
 * Anti-leak capability headers for public RSVP capability URLs
 * - Referrer-Policy: no-referrer prevents token leakage in Referer headers
 * - Cache-Control: no-store, no-cache, must-revalidate prevents caching capability links and responses
 * - X-Robots-Tag: noindex, nofollow prevents web crawlers from indexing private capability links
 */
export function antiLeakHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
}
