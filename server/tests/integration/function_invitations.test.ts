import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { rsvps } from '../../src/db/schema';

describe('Task T2.1: Function Invitation Assignments (household_functions)', () => {
  let cookieA: string;
  let cookieB: string;
  let weddingAId: string;
  let weddingBId: string;
  let functionAId: string;
  let householdA1Id: string;
  let householdA2Id: string;
  let householdBId: string;

  beforeAll(async () => {
    const ts = Date.now();
    // 1. Register Planner A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ email: `planner_t21_a_${ts}@test.com`, password: 'Password123!', name: 'Planner A' });
    cookieA = resA.headers['set-cookie']?.[0]?.split(';')[0] || '';

    // 2. Register Planner B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ email: `planner_t21_b_${ts}@test.com`, password: 'Password123!', name: 'Planner B' });
    cookieB = resB.headers['set-cookie']?.[0]?.split(';')[0] || '';

    // 3. Planner A creates Wedding A and Function A
    const wedA = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookieA)
      .send({ title: "Wedding A", coupleNames: "A & Partner", startDate: "2026-12-01", endDate: "2026-12-02" });
    weddingAId = wedA.body.id;

    const fnA = await request(app)
      .post(`/api/weddings/${weddingAId}/functions`)
      .set('Cookie', cookieA)
      .send({ name: "Sangeet Night", dateTime: "2026-12-01T19:00:00Z", venue: "Grand Lawn" });
    functionAId = fnA.body.id;

    // 4. Planner A adds two households
    const hhA1 = await request(app)
      .post(`/api/weddings/${weddingAId}/households`)
      .set('Cookie', cookieA)
      .send({ name: "Sharma Family", primaryContactName: "Rajesh Sharma", phone: "+919876543201", expectedPartySize: 3 });
    householdA1Id = hhA1.body.id;

    const hhA2 = await request(app)
      .post(`/api/weddings/${weddingAId}/households`)
      .set('Cookie', cookieA)
      .send({ name: "Kapoor Family", primaryContactName: "Anil Kapoor", phone: "+919876543202", expectedPartySize: 4 });
    householdA2Id = hhA2.body.id;

    // 5. Planner B creates Wedding B and Household B
    const wedB = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookieB)
      .send({ title: "Wedding B", coupleNames: "B & Partner", startDate: "2026-12-05", endDate: "2026-12-06" });
    weddingBId = wedB.body.id;

    const hhB = await request(app)
      .post(`/api/weddings/${weddingBId}/households`)
      .set('Cookie', cookieB)
      .send({ name: "Foreign Household", primaryContactName: "Foreign Guest", phone: "+919876543299", expectedPartySize: 2 });
    householdBId = hhB.body.id;
  });

  it('GET /api/functions/:id/invitations lists all wedding households with invited status', async () => {
    const res = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    // Initially not invited
    expect(res.body.every((h: any) => h.invited === false)).toBe(true);
  });

  it('POST /api/functions/:id/invitations assigns households to function', async () => {
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ householdIds: [householdA1Id] });

    expect(res.status).toBe(200);
    expect(res.body.invitedCount).toBe(1);

    // Verify GET reflects the invitation
    const listRes = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);

    const a1 = listRes.body.find((h: any) => h.id === householdA1Id);
    const a2 = listRes.body.find((h: any) => h.id === householdA2Id);
    expect(a1?.invited).toBe(true);
    expect(a2?.invited).toBe(false);
  });

  it('rejects bulk assignment containing a household from another wedding (IDOR defense)', async () => {
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ householdIds: [householdA1Id, householdBId] }); // householdBId belongs to Wedding B

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/do not belong to this wedding/i);
  });

  it('rejects bulk assignment exceeding the 500 household limit', async () => {
    const dummyIds = Array.from({ length: 501 }, (_, i) => `dummy-uuid-${i}`);
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ householdIds: dummyIds });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exceed 500/i);
  });

  it('handles duplicate IDs in request array idempotently', async () => {
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ householdIds: [householdA1Id, householdA1Id, householdA2Id] }); // Duplicate A1

    expect(res.status).toBe(200);
    expect(res.body.invitedCount).toBe(2);
  });

  it('prevents Planner B from accessing Planner A function invitations (returns 404)', async () => {
    const resGet = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieB);
    expect(resGet.status).toBe(404);

    const resPost = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieB)
      .send({ householdIds: [] });
    expect(resPost.status).toBe(404);
  });

  it('rejects unassigning a household that has already submitted an RSVP', async () => {
    // 1. Assign householdA1Id
    await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ householdIds: [householdA1Id] });

    // 2. Simulate an RSVP response submitted by householdA1
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      functionId: functionAId,
      householdId: householdA1Id,
      status: 'yes',
      partySize: 3,
      vegCount: 2,
      nonvegCount: 1,
    });

    // 3. Attempt to unassign householdA1Id by omitting it from householdIds
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ householdIds: [householdA2Id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot unassign household.*already submitted an RSVP/i);
  });
});

