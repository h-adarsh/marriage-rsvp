import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { planners, weddings, functions, households, householdFunctions, rsvps } from '../../src/db/schema';
import { hashPassword, generateInviteToken } from '../../src/utils/auth';
import { resetRsvpLimiters } from '../../src/middleware/rateLimit';

describe('Task T2.3: Public Token Lookup & Verification Service (GET /api/rsvp/:token)', () => {
  const plannerId = crypto.randomUUID();
  const weddingId = crypto.randomUUID();
  const function1Id = crypto.randomUUID();
  const function2Id = crypto.randomUUID();
  const function3Id = crypto.randomUUID(); // Household will NOT be invited to this function
  const household1Id = crypto.randomUUID();
  const household2Id = crypto.randomUUID(); // 0 functions assigned
  const token1 = generateInviteToken(); // 32 hex chars
  const token2 = generateInviteToken();

  beforeAll(async () => {
    // 1. Seed planner
    const passwordHash = await hashPassword('SecurePass123!');
    await db.insert(planners).values({
      id: plannerId,
      email: `rsvp-test-${Date.now()}@example.com`,
      passwordHash,
      name: 'RSVP Test Planner',
    });

    // 2. Seed wedding
    await db.insert(weddings).values({
      id: weddingId,
      plannerId,
      title: 'Dev & Priya Wedding',
      coupleNames: 'Dev & Priya',
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-11-22'),
    });

    // 3. Seed functions
    await db.insert(functions).values([
      {
        id: function1Id,
        weddingId,
        name: 'Sangeet & Cocktails',
        dateTime: new Date('2026-11-20T18:30:00Z'),
        venue: 'The Grand Palace',
      },
      {
        id: function2Id,
        weddingId,
        name: 'Wedding Ceremony',
        dateTime: new Date('2026-11-21T10:00:00Z'),
        venue: 'Temple Hall',
      },
      {
        id: function3Id,
        weddingId,
        name: 'Private VIP Dinner',
        dateTime: new Date('2026-11-22T20:00:00Z'),
        venue: 'Private Terrace',
      },
    ]);

    // 4. Seed households
    await db.insert(households).values([
      {
        id: household1Id,
        weddingId,
        name: 'Verma Family',
        primaryContactName: 'Rahul Verma',
        phone: '+919876543210',
        expectedPartySize: 3,
        inviteToken: token1,
        notes: 'Strictly confidential internal notes: VIP relatives',
      },
      {
        id: household2Id,
        weddingId,
        name: 'Empty Invite Family',
        primaryContactName: 'Empty Contact',
        phone: '+919876543211',
        expectedPartySize: 2,
        inviteToken: token2,
        notes: 'No functions assigned yet',
      },
    ]);

    // 5. Assign household1 to function1 and function2 (NOT function3)
    await db.insert(householdFunctions).values([
      {
        id: crypto.randomUUID(),
        householdId: household1Id,
        functionId: function1Id,
      },
      {
        id: crypto.randomUUID(),
        householdId: household1Id,
        functionId: function2Id,
      },
    ]);

    // 6. Record existing RSVP for function1
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      functionId: function1Id,
      householdId: household1Id,
      status: 'yes',
      partySize: 3,
      vegCount: 2,
      nonvegCount: 1,
      dietaryNotes: 'No peanuts please',
    });
  });

  beforeEach(() => {
    resetRsvpLimiters('127.0.0.1');
  });

  it('successfully returns public invitation data for a valid token (Happy Path)', async () => {
    const res = await request(app).get(`/api/rsvp/${token1}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('household');
    expect(res.body).toHaveProperty('wedding');
    expect(res.body).toHaveProperty('functions');

    // Verify household details
    expect(res.body.household.name).toBe('Verma Family');
    expect(res.body.household.expectedPartySize).toBe(3);

    // Verify wedding details
    expect(res.body.wedding.title).toBe('Dev & Priya Wedding');
    expect(res.body.wedding.coupleNames).toBe('Dev & Priya');

    // Verify function scoping: only invited functions are returned (function1 and function2)
    const funcs = res.body.functions;
    expect(funcs).toHaveLength(2);

    const f1 = funcs.find((f: any) => f.id === function1Id);
    const f2 = funcs.find((f: any) => f.id === function2Id);
    const f3 = funcs.find((f: any) => f.id === function3Id);

    expect(f1).toBeDefined();
    expect(f2).toBeDefined();
    expect(f3).toBeUndefined(); // Crucial: household was NOT invited to function3

    // Verify f1 has the existing RSVP data
    expect(f1.name).toBe('Sangeet & Cocktails');
    expect(f1.rsvpStatus).toBe('yes');
    expect(f1.partySize).toBe(3);
    expect(f1.vegCount).toBe(2);
    expect(f1.nonvegCount).toBe(1);
    expect(f1.dietaryNotes).toBe('No peanuts please');

    // Verify f2 has default 'no_response' state
    expect(f2.name).toBe('Wedding Ceremony');
    expect(f2.rsvpStatus).toBe('no_response');
    expect(f2.partySize).toBe(0);
    expect(f2.vegCount).toBe(0);
    expect(f2.nonvegCount).toBe(0);
  });

  it('strictly minimizes data and exposes ZERO PII in the response payload', async () => {
    const res = await request(app).get(`/api/rsvp/${token1}`);

    expect(res.status).toBe(200);
    const jsonString = JSON.stringify(res.body);

    // Assert that phone numbers are NOT present anywhere in the response
    expect(res.body.household.phone).toBeUndefined();
    expect(jsonString).not.toContain('+919876543210');

    // Assert that primary contact personal name is NOT exposed
    expect(res.body.household.primaryContactName).toBeUndefined();
    expect(jsonString).not.toContain('Rahul Verma');

    // Assert that confidential planner notes are NOT exposed
    expect(res.body.household.notes).toBeUndefined();
    expect(jsonString).not.toContain('VIP relatives');

    // Assert internal database IDs (weddingId, plannerId, householdId) are NOT exposed
    expect(res.body.wedding.id).toBeUndefined();
    expect(res.body.household.id).toBeUndefined();
    expect(jsonString).not.toContain(plannerId);
    expect(jsonString).not.toContain(weddingId);
    expect(jsonString).not.toContain(household1Id);
  });

  it('sets required anti-leak security headers on capability URLs', async () => {
    const res = await request(app).get(`/api/rsvp/${token1}`);

    expect(res.status).toBe(200);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['cache-control']).toContain('no-cache');
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('returns uniform 404 for malformed tokens vs unknown tokens (prevents oracle)', async () => {
    // Malformed token (short / invalid characters)
    const malformedRes = await request(app).get('/api/rsvp/malformed-token-123');
    expect(malformedRes.status).toBe(404);
    expect(malformedRes.body).toEqual({ error: 'Invitation not found' });

    // Non-existent 32-character hex token
    const nonExistentToken = 'e'.repeat(32);
    const nonExistentRes = await request(app).get(`/api/rsvp/${nonExistentToken}`);
    expect(nonExistentRes.status).toBe(404);
    expect(nonExistentRes.body).toEqual({ error: 'Invitation not found' });

    // Check anti-leak headers on 404s as well
    expect(nonExistentRes.headers['referrer-policy']).toBe('no-referrer');
    expect(nonExistentRes.headers['cache-control']).toContain('no-store');
  });

  it('handles household with zero assigned functions cleanly', async () => {
    const res = await request(app).get(`/api/rsvp/${token2}`);

    expect(res.status).toBe(200);
    expect(res.body.household.name).toBe('Empty Invite Family');
    expect(res.body.functions).toEqual([]);
  });

  it('enforces rate limiting on invalid token attempts (10 failed attempts trigger HTTP 429)', async () => {
    // Reset limits for clean test run
    resetRsvpLimiters('127.0.0.1');

    const fakeToken = 'd'.repeat(32);

    // Make 10 failed requests
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get(`/api/rsvp/${fakeToken}`);
      expect(res.status).toBe(404);
    }

    // The 11th request should be blocked by rsvpInvalidTokenLimiter
    const rateLimitedRes = await request(app).get(`/api/rsvp/${fakeToken}`);
    expect(rateLimitedRes.status).toBe(429);
    expect(rateLimitedRes.body.error).toMatch(/too many invalid token attempts/i);

    // Reset so subsequent tests run smoothly
    resetRsvpLimiters('127.0.0.1');
  });

  it('does NOT count successful lookups against the invalid token attempt limit', async () => {
    resetRsvpLimiters('127.0.0.1');

    // Make 15 successful lookups with valid token
    for (let i = 0; i < 15; i++) {
      const res = await request(app).get(`/api/rsvp/${token1}`);
      expect(res.status).toBe(200);
    }

    // Now make 1 invalid lookup - it should still return 404 (NOT 429) because successes were skipped
    const invalidRes = await request(app).get('/api/rsvp/malformed-token');
    expect(invalidRes.status).toBe(404);

    resetRsvpLimiters('127.0.0.1');
  });
});

