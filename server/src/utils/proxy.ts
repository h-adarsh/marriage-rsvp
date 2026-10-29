/**
 * Parse TRUST_PROXY environment variable into Express-compatible value.
 *
 * Express app.set('trust proxy', val) behavior:
 * - boolean false: Do not trust any proxy (req.ip uses direct socket remoteAddress).
 * - boolean true: Trust all hops.
 * - number n: Trust the n-th hop from front-facing proxy.
 * - string: Trust specific named subnets ('loopback', 'linklocal', 'uniquelocal') or IP/CIDR.
 *
 * Note: Environment variables are always strings. A raw string "false" is truthy in JavaScript
 * and would be treated by Express as an IP address / subnet name, breaking IP resolution and rate limits.
 */
export function parseTrustProxy(val?: string | null): boolean | number | string {
  if (!val || val.trim() === '' || val.trim().toLowerCase() === 'false') {
    return false;
  }
  const trimmed = val.trim();
  if (trimmed.toLowerCase() === 'true') {
    return true;
  }
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return trimmed;
}

