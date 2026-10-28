import { describe, it, expect } from 'vitest';
import { parseTrustProxy } from '../../src/utils/proxy';

describe('parseTrustProxy Utility', () => {
  it('returns boolean false for undefined, null, or empty string', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy(null)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('   ')).toBe(false);
  });

  it('returns boolean false for string "false" (case-insensitive)', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('FALSE')).toBe(false);
    expect(parseTrustProxy(' False  ')).toBe(false);
  });

  it('returns boolean true for string "true" (case-insensitive)', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('TRUE')).toBe(true);
    expect(parseTrustProxy(' True ')).toBe(true);
  });

  it('returns integer number when given numeric strings', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy(' 3 ')).toBe(3);
    expect(parseTrustProxy('0')).toBe(0);
  });

  it('returns trimmed string for named subnets, CIDRs, or specific IP addresses', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy('127.0.0.1')).toBe('127.0.0.1');
    expect(parseTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
    expect(parseTrustProxy('  loopback, 192.168.1.1  ')).toBe('loopback, 192.168.1.1');
  });
});
