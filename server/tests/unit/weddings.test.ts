import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const weddingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  coupleNames: z.string().min(1, 'Couple names are required').max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

const functionSchema = z.object({
  name: z.string().min(1, 'Function name is required').max(100),
  dateTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid date and time is required',
  }),
  venue: z.string().min(1, 'Venue is required').max(255),
});

describe('Wedding and Function Domain Rules', () => {
  it('accepts valid wedding input', () => {
    const valid = {
      title: "Aditi & Rahul's Wedding",
      coupleNames: 'Aditi Sharma & Rahul Verma',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    };
    const result = weddingSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects wedding with endDate prior to startDate', () => {
    const invalid = {
      title: "Aditi & Rahul's Wedding",
      coupleNames: 'Aditi Sharma & Rahul Verma',
      startDate: '2026-11-15',
      endDate: '2026-11-10',
    };
    const result = weddingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toMatch(/on or after start date/i);
    }
  });

  it('rejects wedding with invalid date format', () => {
    const invalid = {
      title: "Aditi & Rahul's Wedding",
      coupleNames: 'Aditi Sharma & Rahul Verma',
      startDate: '10/11/2026',
      endDate: '12/11/2026',
    };
    const result = weddingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects wedding with empty title or couple names', () => {
    const invalid = {
      title: '',
      coupleNames: '',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    };
    const result = weddingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts valid function inputs', () => {
    const valid = {
      name: 'Sangeet & Cocktail',
      dateTime: '2026-11-11T19:30:00.000Z',
      venue: 'The Leela Palace Ballroom',
    };
    const result = functionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects function with unparseable dateTime', () => {
    const invalid = {
      name: 'Sangeet & Cocktail',
      dateTime: 'invalid-datetime',
      venue: 'The Leela Palace Ballroom',
    };
    const result = functionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
