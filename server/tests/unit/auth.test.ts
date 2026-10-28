import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateSessionId,
  hashSessionId,
  generateInviteToken,
  getSessionCookieOptions,
  getClearCookieOptions,
  COOKIE_NAME,
} from '../../src/utils/auth';

describe('Authentication Utilities', () => {
  it('hashes passwords using Argon2id and verifies correctly', async () => {
    const rawPassword = 'StrongSecurePassword123!';
    const hash = await hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const isMatch = await verifyPassword(rawPassword, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword('WrongPassword123!', hash);
    expect(isWrongMatch).toBe(false);
  });

  it('generates a cryptographically secure 64-char session ID', () => {
    const sessionId1 = generateSessionId();
    const sessionId2 = generateSessionId();

    expect(sessionId1).toHaveLength(64);
    expect(sessionId2).toHaveLength(64);
    expect(sessionId1).not.toBe(sessionId2);
    expect(/^[0-9a-f]{64}$/.test(sessionId1)).toBe(true);
  });

  it('generates a 128-bit (32-char hex) unguessable invite token', () => {
    const token1 = generateInviteToken();
    const token2 = generateInviteToken();

    expect(token1).toHaveLength(32);
    expect(token2).toHaveLength(32);
    expect(token1).not.toBe(token2);
    expect(/^[0-9a-f]{32}$/.test(token1)).toBe(true);
  });

  it('provides secure cookie options', () => {
    expect(COOKIE_NAME).toBe('sessionId');

    const options = getSessionCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('strict');
    expect(options.path).toBe('/');
    expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);

    const clearOptions = getClearCookieOptions();
    expect(clearOptions.httpOnly).toBe(true);
    expect(clearOptions.sameSite).toBe('strict');
    expect(clearOptions.path).toBe('/');
  });

  it('hashes session IDs deterministically using SHA-256 for at-rest storage', () => {
    const rawId = 'abcd1234ef567890abcd1234ef567890abcd1234ef567890abcd1234ef567890';
    const hash1 = hashSessionId(rawId);
    const hash2 = hashSessionId(rawId);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(rawId);
    expect(hashSessionId('different_session')).not.toBe(hash1);
  });
});
