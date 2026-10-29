import { describe, it, expect } from 'vitest';
import {
  isValidTimeZone,
  getSafeTimeZone,
  parseWeddingDateTime,
  formatDateTimeInZone,
  formatDateTimeForInput,
} from '../../src/utils/date';

describe('Timezone & Date Utilities', () => {
  describe('isValidTimeZone', () => {
    it('accepts valid IANA timezone identifiers', () => {
      expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
      expect(isValidTimeZone('America/New_York')).toBe(true);
      expect(isValidTimeZone('Europe/London')).toBe(true);
      expect(isValidTimeZone('Asia/Dubai')).toBe(true);
      expect(isValidTimeZone('Asia/Tokyo')).toBe(true);
      expect(isValidTimeZone('Australia/Sydney')).toBe(true);
      expect(isValidTimeZone('UTC')).toBe(true);
    });

    it('rejects invalid, malformed, or empty timezones', () => {
      expect(isValidTimeZone('Invalid/Timezone')).toBe(false);
      expect(isValidTimeZone('Moon/Base')).toBe(false);
      expect(isValidTimeZone('NotATimezone')).toBe(false);
      expect(isValidTimeZone('')).toBe(false);
      expect(isValidTimeZone(null as any)).toBe(false);
      expect(isValidTimeZone(undefined)).toBe(false);
    });
  });

  describe('getSafeTimeZone', () => {
    it('returns the input timezone if valid', () => {
      expect(getSafeTimeZone('America/Chicago')).toBe('America/Chicago');
      expect(getSafeTimeZone('Europe/Paris')).toBe('Europe/Paris');
    });

    it('falls back to Asia/Kolkata for null, empty, or invalid input', () => {
      expect(getSafeTimeZone(null)).toBe('Asia/Kolkata');
      expect(getSafeTimeZone(undefined)).toBe('Asia/Kolkata');
      expect(getSafeTimeZone('')).toBe('Asia/Kolkata');
      expect(getSafeTimeZone('Gibberish/Zone')).toBe('Asia/Kolkata');
    });
  });

  describe('parseWeddingDateTime', () => {
    it('correctly interprets wall-clock time in Asia/Kolkata (+05:30) into exact UTC', () => {
      // 19:30 on 10 Dec 2026 in IST corresponds to 14:00 UTC on 10 Dec 2026
      const parsed = parseWeddingDateTime('2026-12-10T19:30', 'Asia/Kolkata');
      expect(parsed.toISOString()).toBe('2026-12-10T14:00:00.000Z');
    });

    it('correctly interprets wall-clock time in America/New_York (-05:00 standard time) into exact UTC', () => {
      // 19:30 on 10 Dec 2026 in EST corresponds to 00:30 UTC on 11 Dec 2026
      const parsed = parseWeddingDateTime('2026-12-10T19:30', 'America/New_York');
      expect(parsed.toISOString()).toBe('2026-12-11T00:30:00.000Z');
    });

    it('correctly interprets wall-clock time in Europe/London (+00:00 GMT) into exact UTC', () => {
      // 19:30 on 10 Dec 2026 in GMT corresponds to 19:30 UTC on 10 Dec 2026
      const parsed = parseWeddingDateTime('2026-12-10T19:30', 'Europe/London');
      expect(parsed.toISOString()).toBe('2026-12-10T19:30:00.000Z');
    });

    it('preserves timestamps that already contain explicit ISO offsets or Z', () => {
      const explicitUtc = parseWeddingDateTime('2026-12-10T14:00:00.000Z', 'Asia/Kolkata');
      expect(explicitUtc.toISOString()).toBe('2026-12-10T14:00:00.000Z');

      const explicitOffset = parseWeddingDateTime('2026-12-10T19:30:00+05:30', 'America/New_York');
      expect(explicitOffset.toISOString()).toBe('2026-12-10T14:00:00.000Z');
    });
  });

  describe('formatDateTimeInZone', () => {
    const utcDate = new Date('2026-12-10T14:00:00.000Z');

    it('formats UTC date correctly into Asia/Kolkata (7:30 pm)', () => {
      const formatted = formatDateTimeInZone(utcDate, 'Asia/Kolkata');
      expect(formatted).toContain('10 Dec 2026');
      expect(formatted).toMatch(/7:30\s*(pm|PM)/i);
      expect(formatted).toContain('(Asia/Kolkata)');
    });

    it('formats UTC date correctly into Europe/London (2:00 pm)', () => {
      const formatted = formatDateTimeInZone(utcDate, 'Europe/London');
      expect(formatted).toContain('10 Dec 2026');
      expect(formatted).toMatch(/2:00\s*(pm|PM)/i);
      expect(formatted).toContain('(Europe/London)');
    });

    it('formats UTC date correctly into America/New_York (9:00 am)', () => {
      const formatted = formatDateTimeInZone(utcDate, 'America/New_York');
      expect(formatted).toContain('10 Dec 2026');
      expect(formatted).toMatch(/9:00\s*(am|AM)/i);
      expect(formatted).toContain('(America/New_York)');
    });
  });

  describe('formatDateTimeForInput', () => {
    const utcDate = new Date('2026-12-10T14:00:00.000Z');

    it('converts UTC date back to wall-clock YYYY-MM-DDTHH:mm in Asia/Kolkata', () => {
      expect(formatDateTimeForInput(utcDate, 'Asia/Kolkata')).toBe('2026-12-10T19:30');
    });

    it('converts UTC date back to wall-clock YYYY-MM-DDTHH:mm in America/New_York', () => {
      expect(formatDateTimeForInput(utcDate, 'America/New_York')).toBe('2026-12-10T09:00');
    });

    it('converts UTC date back to wall-clock YYYY-MM-DDTHH:mm in Europe/London', () => {
      expect(formatDateTimeForInput(utcDate, 'Europe/London')).toBe('2026-12-10T14:00');
    });
  });

  describe('Round-trip conversion consistency', () => {
    it('guarantees round-trip equality: parse -> format -> input format', () => {
      const inputWallClock = '2026-12-10T19:30';
      const zones = ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];

      for (const zone of zones) {
        const parsedUtc = parseWeddingDateTime(inputWallClock, zone);
        const reconstructedInput = formatDateTimeForInput(parsedUtc, zone);
        expect(reconstructedInput).toBe(inputWallClock);
      }
    });
  });
});

