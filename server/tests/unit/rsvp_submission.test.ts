import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { rsvpItemSchema, submitRsvpBodySchema } from '../../src/routes/rsvp';

describe('Task T2.5 Unit Tests: RSVP Submission Validation Schema', () => {
  const functionId = crypto.randomUUID();

  describe('rsvpItemSchema - Status "yes" (Confirmed Attendance)', () => {
    it('accepts valid confirmed RSVP where veg + nonveg equals party size', () => {
      const valid1 = {
        functionId,
        status: 'yes',
        partySize: 4,
        vegCount: 3,
        nonvegCount: 1,
        dietaryNotes: 'One Jain meal',
      };
      expect(rsvpItemSchema.safeParse(valid1).success).toBe(true);

      const validAllVeg = {
        functionId,
        status: 'yes',
        partySize: 2,
        vegCount: 2,
        nonvegCount: 0,
      };
      expect(rsvpItemSchema.safeParse(validAllVeg).success).toBe(true);

      const validAllNonveg = {
        functionId,
        status: 'yes',
        partySize: 1,
        vegCount: 0,
        nonvegCount: 1,
      };
      expect(rsvpItemSchema.safeParse(validAllNonveg).success).toBe(true);
    });

    it('rejects confirmed RSVP where veg + nonveg does not equal party size', () => {
      const invalidSum = {
        functionId,
        status: 'yes',
        partySize: 4,
        vegCount: 2,
        nonvegCount: 1, // 2 + 1 = 3 != 4
      };
      const res = rsvpItemSchema.safeParse(invalidSum);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors[0].message).toMatch(/Veg \+ Non-Veg count must equal party size/i);
      }
    });

    it('rejects confirmed RSVP with party size 0', () => {
      const zeroParty = {
        functionId,
        status: 'yes',
        partySize: 0,
        vegCount: 0,
        nonvegCount: 0,
      };
      const res = rsvpItemSchema.safeParse(zeroParty);
      expect(res.success).toBe(false);
    });

    it('rejects negative party sizes or counts', () => {
      const negativeParty = {
        functionId,
        status: 'yes',
        partySize: -1,
        vegCount: 0,
        nonvegCount: 0,
      };
      expect(rsvpItemSchema.safeParse(negativeParty).success).toBe(false);

      const negativeVeg = {
        functionId,
        status: 'yes',
        partySize: 2,
        vegCount: -1,
        nonvegCount: 3,
      };
      expect(rsvpItemSchema.safeParse(negativeVeg).success).toBe(false);
    });

    it('rejects dietary notes exceeding 500 characters', () => {
      const longNotes = {
        functionId,
        status: 'yes',
        partySize: 2,
        vegCount: 1,
        nonvegCount: 1,
        dietaryNotes: 'A'.repeat(501),
      };
      const res = rsvpItemSchema.safeParse(longNotes);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors[0].message).toMatch(/cannot exceed 500 characters/i);
      }
    });

    it('accepts dietary notes within 500 characters limit', () => {
      const validNotes = {
        functionId,
        status: 'yes',
        partySize: 2,
        vegCount: 1,
        nonvegCount: 1,
        dietaryNotes: 'A'.repeat(500),
      };
      expect(rsvpItemSchema.safeParse(validNotes).success).toBe(true);
    });
  });

  describe('rsvpItemSchema - Status "no" (Declined Attendance)', () => {
    it('accepts declined RSVP with partySize 0', () => {
      const declined = {
        functionId,
        status: 'no',
        partySize: 0,
        vegCount: 0,
        nonvegCount: 0,
      };
      expect(rsvpItemSchema.safeParse(declined).success).toBe(true);
    });
  });

  describe('rsvpItemSchema - Status "maybe" (Tentative Attendance)', () => {
    it('accepts maybe RSVP with partySize 0', () => {
      const tentative = {
        functionId,
        status: 'maybe',
        partySize: 0,
        vegCount: 0,
        nonvegCount: 0,
      };
      expect(rsvpItemSchema.safeParse(tentative).success).toBe(true);
    });

    it('accepts maybe RSVP with estimated headcount without requiring meal breakdown', () => {
      const tentative = {
        functionId,
        status: 'maybe',
        partySize: 3,
        vegCount: 0,
        nonvegCount: 0,
      };
      expect(rsvpItemSchema.safeParse(tentative).success).toBe(true);
    });
  });

  describe('submitRsvpBodySchema - Request Body Shapes', () => {
    it('accepts wrapped responses object { responses: [...] }', () => {
      const body = {
        responses: [
          { functionId, status: 'yes', partySize: 2, vegCount: 1, nonvegCount: 1 },
        ],
      };
      expect(submitRsvpBodySchema.safeParse(body).success).toBe(true);
    });

    it('accepts direct array of responses [...]', () => {
      const body = [
        { functionId, status: 'no', partySize: 0, vegCount: 0, nonvegCount: 0 },
      ];
      expect(submitRsvpBodySchema.safeParse(body).success).toBe(true);
    });

    it('accepts a single response object directly', () => {
      const body = { functionId, status: 'yes', partySize: 1, vegCount: 1, nonvegCount: 0 };
      expect(submitRsvpBodySchema.safeParse(body).success).toBe(true);
    });

    it('rejects empty responses array', () => {
      expect(submitRsvpBodySchema.safeParse({ responses: [] }).success).toBe(false);
      expect(submitRsvpBodySchema.safeParse([]).success).toBe(false);
    });
  });
});

