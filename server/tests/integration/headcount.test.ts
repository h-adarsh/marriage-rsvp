import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { planners, weddings, functions, households, householdFunctions, rsvps } from '../../src/db/schema';
import { hashPassword, generateInviteToken } from '../../src/utils/auth';

describe('Task T3.1 & T3.2 Integration Tests: Headcount Calculation API (GET /api/functions/:id/headcount)', () => {
  let cookiePlannerA: string;
  let cookiePlannerB: string;
  const plannerAId = crypto.randomUUID();
  const plannerBId = crypto.randomUUID();
  const weddingAId = crypto.randomUUID();
  const weddingBId = crypto.randomUUID();
  const functionAId = crypto.randomUUID();
  const functionBId = crypto.randomUUID();

  // 10 households for hand-checked verification
  const householdIds: string[] = [];
  const inviteTokens: string[] = [];

  beforeAll(async () => {
    // 1. Create Planner A and login
    const passHash = await hashPassword('Password123!');
    const emailA = `planner-headcount-a-${Date.now()}@example.com`;
    await db.insert(planners).values({
      id: plannerAId,
      email: emailA,
      passwordHash: passHash,
      name: 'Planner A',
    });

    const loginResA = await request(app).post('/api/auth/login').send({
      email: emailA,
      password: 'Password123!',
    });
    cookiePlannerA = loginResA.headers['set-cookie'][0];

    // 2. Create Planner B and login
    const emailB = `planner-headcount-b-${Date.now()}@example.com`;
    await db.insert(planners).values({
      id: plannerBId,
      email: emailB,
      passwordHash: passHash,
      name: 'Planner B',
    });

    const loginResB = await request(app).post('/api/auth/login').send({
      email: emailB,
      password: 'Password123!',
    });
    cookiePlannerB = loginResB.headers['set-cookie'][0];

    // 3. Create Weddings
    await db.insert(weddings).values([
      {
        id: weddingAId,
        plannerId: plannerAId,
        title: 'Wedding A (Headcount Test)',
        coupleNames: 'Rohan & Ananya',
        startDate: '2026-12-10',
        endDate: '2026-12-12',
      },
      {
        id: weddingBId,
        plannerId: plannerBId,
        title: 'Wedding B (Isolation Test)',
        coupleNames: 'Sameer & Pooja',
        startDate: '2026-12-12',
        endDate: '2026-12-14',
      },
    ]);

    // 4. Create Functions
    await db.insert(functions).values([
      {
        id: functionAId,
        weddingId: weddingAId,
        name: 'Sangeet Ceremony',
        dateTime: new Date('2026-12-10T18:00:00Z'),
        venue: 'Grand Ballroom',
      },
      {
        id: functionBId,
        weddingId: weddingBId,
        name: 'Planner B Reception',
        dateTime: new Date('2026-12-12T19:00:00Z'),
        venue: 'Lakeside Lawn',
      },
    ]);

    // 5. Seed 10 households for Wedding A matching hand-checked numbers:
    // Sizes: 4, 3, 2, 5 (confirmed), 2, 2 (maybe), 3 (declined), 2, 1, 3 (no response)
    const sizes = [4, 3, 2, 5, 2, 2, 3, 2, 1, 3];
    for (let i = 0; i < 10; i++) {
      const hid = crypto.randomUUID();
      const token = generateInviteToken();
      householdIds.push(hid);
      inviteTokens.push(token);

      await db.insert(households).values({
        id: hid,
        weddingId: weddingAId,
        name: `Household ${i + 1}`,
        primaryContactName: `Contact ${i + 1}`,
        phone: `+9198765432${i.toString().padStart(2, '0')}`,
        expectedPartySize: sizes[i],
        inviteToken: token,
      });

      // Assign all 10 households to Function A
      await db.insert(householdFunctions).values({
        id: crypto.randomUUID(),
        householdId: hid,
        functionId: functionAId,
      });
    }

    // 6. Seed RSVPs for Function A:
    // Household 1 (size 4): yes, veg 3, nonveg 1, 2 days ago
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      householdId: householdIds[0],
      functionId: functionAId,
      status: 'yes',
      partySize: 4,
      vegCount: 3,
      nonvegCount: 1,
      respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    // Household 2 (size 3): yes, veg 2, nonveg 1, 5 days ago
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      householdId: householdIds[1],
      functionId: functionAId,
      status: 'yes',
      partySize: 3,
      vegCount: 2,
      nonvegCount: 1,
      respondedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    // Household 3 (size 2): yes, veg 2, nonveg 0, 20 days ago (stale > 14 days)
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      householdId: householdIds[2],
      functionId: functionAId,
      status: 'yes',
      partySize: 2,
      vegCount: 2,
      nonvegCount: 0,
      respondedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    });

    // Household 4 (size 5): yes, veg 1, nonveg 4, 1 day ago
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      householdId: householdIds[3],
      functionId: functionAId,
      status: 'yes',
      partySize: 5,
      vegCount: 1,
      nonvegCount: 4,
      respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });

    // Household 5 (size 2): maybe, 2 people, 3 days ago
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      householdId: householdIds[4],
      functionId: functionAId,
      status: 'maybe',
      partySize: 2,
      vegCount: 0,
      nonvegCount: 0,
      respondedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    // Household 6 (size 2): maybe, 2 people, 18 days ago (stale > 14 days)
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      householdId: householdIds[5],
      functionId: functionAId,
      status: 'maybe',
      partySize: 2,
      vegCount: 0,
      nonvegCount: 0,
      respondedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
    });

    // Household 7 (size 3): no, 0 people
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      householdId: householdIds[6],
      functionId: functionAId,
      status: 'no',
      partySize: 0,
      vegCount: 0,
      nonvegCount: 0,
      respondedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    });

    // Households 8, 9, 10 have no RSVP rows (Pending / No Response)
  });

  it('blocks unauthenticated access to GET /api/functions/:id/headcount with 401', async () => {
    const res = await request(app).get(`/api/functions/${functionAId}/headcount`);
    expect(res.status).toBe(401);
  });

  it('enforces multi-tenant isolation: Planner B cannot access Planner A function headcount (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/functions/${functionAId}/headcount`)
      .set('Cookie', cookiePlannerB);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Function not found/i);
  });

  it('returns 404 for non-existent function ID', async () => {
    const nonExistent = crypto.randomUUID();
    const res = await request(app)
      .get(`/api/functions/${nonExistent}/headcount`)
      .set('Cookie', cookiePlannerA);

    expect(res.status).toBe(404);
  });

  it('returns exact hand-checked numbers for Planner A Sangeet function with default 50% maybe ratio', async () => {
    const res = await request(app)
      .get(`/api/functions/${functionAId}/headcount`)
      .set('Cookie', cookiePlannerA);

    expect(res.status).toBe(200);
    const data = res.body;

    expect(data.functionId).toBe(functionAId);
    expect(data.functionName).toBe('Sangeet Ceremony');
    expect(data.weddingId).toBe(weddingAId);

    // Household logistics counts
    expect(data.invitedCount).toBe(10);
    expect(data.households).toEqual({
      total: 10,
      confirmed: 4,
      maybe: 2,
      declined: 1,
      noResponse: 3,
    });

    // Headcount metrics in people
    expect(data.totalInvitedHeadcount).toBe(27);
    expect(data.confirmedHeadcount).toBe(14);
    expect(data.vegCount).toBe(8);
    expect(data.nonvegCount).toBe(6);
    expect(data.vegCount + data.nonvegCount).toBe(data.confirmedHeadcount);

    expect(data.maybeHeadcount).toBe(4);
    expect(data.declinedHeadcount).toBe(3);
    expect(data.noResponseHeadcount).toBe(6);

    // Planning estimate: 14 + floor(0.50 * 4) = 16
    expect(data.planningEstimate).toBe(16);
    expect(data.maybePct).toBe(50);
    expect(data.formula).toBe('Planning Estimate = Confirmed (14) + 50% of Maybe (4) = 16 guests');

    // Stale responses (> 14 days): households 3 and 6 = 2
    expect(data.staleCount).toBe(2);
    expect(data.staleDays).toBe(14);
  });

  it('updates planning estimate dynamically when custom query parameters are provided', async () => {
    // maybePct = 25% -> 14 + floor(0.25 * 4) = 15
    const res25 = await request(app)
      .get(`/api/functions/${functionAId}/headcount?maybePct=25`)
      .set('Cookie', cookiePlannerA);

    expect(res25.status).toBe(200);
    expect(res25.body.planningEstimate).toBe(15);
    expect(res25.body.maybePct).toBe(25);
    expect(res25.body.formula).toBe('Planning Estimate = Confirmed (14) + 25% of Maybe (4) = 15 guests');

    // maybePct = 75% -> 14 + floor(0.75 * 4) = 17
    const res75 = await request(app)
      .get(`/api/functions/${functionAId}/headcount?maybePct=75`)
      .set('Cookie', cookiePlannerA);

    expect(res75.status).toBe(200);
    expect(res75.body.planningEstimate).toBe(17);
    expect(res75.body.formula).toBe('Planning Estimate = Confirmed (14) + 75% of Maybe (4) = 17 guests');
  });

  it('proves fresh totals: when a guest submits an RSVP, the headcount updates live on refresh', async () => {
    // Household 8 was previously pending (expected size 2)
    // Guest opens link and submits 'yes' with partySize 2 (1 veg, 1 nonveg)
    const token8 = inviteTokens[7];
    const guestSubmitRes = await request(app)
      .post(`/api/rsvp/${token8}`)
      .send({
        functionId: functionAId,
        status: 'yes',
        partySize: 2,
        vegCount: 1,
        nonvegCount: 1,
      });

    expect(guestSubmitRes.status).toBe(200);

    // Planner refreshes the headcount dashboard
    const refreshedRes = await request(app)
      .get(`/api/functions/${functionAId}/headcount`)
      .set('Cookie', cookiePlannerA);

    expect(refreshedRes.status).toBe(200);
    const refreshed = refreshedRes.body;

    // Confirmed headcount increases from 14 to 16
    expect(refreshed.confirmedHeadcount).toBe(16);
    expect(refreshed.vegCount).toBe(9); // was 8
    expect(refreshed.nonvegCount).toBe(7); // was 6
    expect(refreshed.households.confirmed).toBe(5); // was 4

    // No response headcount decreases from 6 to 4 (households 9 and 10 remain)
    expect(refreshed.noResponseHeadcount).toBe(4);
    expect(refreshed.households.noResponse).toBe(2); // was 3

    // Planning estimate with P = 50%: 16 + floor(0.50 * 4) = 18 guests
    expect(refreshed.planningEstimate).toBe(18);
    expect(refreshed.formula).toBe('Planning Estimate = Confirmed (16) + 50% of Maybe (4) = 18 guests');
  });
});
