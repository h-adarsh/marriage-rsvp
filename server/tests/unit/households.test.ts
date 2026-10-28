import { describe, it, expect } from 'vitest';
import { householdSchema } from '../../src/routes/households';

describe('Household Input Validation Rules', () => {
  it('accepts valid household inputs with standard mobile number', () => {
    const valid = {
      name: 'Kapoor Family',
      primaryContactName: 'Anil Kapoor',
      phone: '+919876543210',
      expectedPartySize: 3,
      notes: 'Close family friends',
    };
    const result = householdSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts valid phone numbers without leading plus', () => {
    const valid = {
      name: 'Verma Household',
      primaryContactName: 'Sunita Verma',
      phone: '9876543210',
      expectedPartySize: 2,
    };
    const result = householdSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects phone numbers with letters or symbols', () => {
    const invalid = {
      name: 'Verma Household',
      primaryContactName: 'Sunita Verma',
      phone: '98765-ABCDE',
      expectedPartySize: 2,
    };
    const result = householdSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects phone numbers with fewer than 7 digits', () => {
    const invalid = {
      name: 'Verma Household',
      primaryContactName: 'Sunita Verma',
      phone: '12345',
      expectedPartySize: 2,
    };
    const result = householdSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects party size less than 1', () => {
    const invalid = {
      name: 'Verma Household',
      primaryContactName: 'Sunita Verma',
      phone: '9876543210',
      expectedPartySize: 0,
    };
    const result = householdSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toMatch(/at least 1/i);
    }
  });

  it('rejects party size greater than 50', () => {
    const invalid = {
      name: 'Verma Household',
      primaryContactName: 'Sunita Verma',
      phone: '9876543210',
      expectedPartySize: 55,
    };
    const result = householdSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toMatch(/cannot exceed 50/i);
    }
  });

  it('rejects empty household name or contact name', () => {
    const invalid = {
      name: '',
      primaryContactName: '',
      phone: '9876543210',
      expectedPartySize: 2,
    };
    const result = householdSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
