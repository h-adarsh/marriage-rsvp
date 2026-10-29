import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { checkins, rsvps, auditLog, householdFunctions } from '../../src/db/schema';

describe('Task T4.1 Integration Tests: Venue Check-In Backend API', () => {
  let cookiePlannerA: string;
  let cookiePlannerB: string;
  let weddingAId: string;
  let weddingBId: string;
  let functionAId: string;
  let functionBId: string;
  let householdA1Id: string;
  let householdA2Id: string;
  let householdBId: string;

  beforeAll(async () => {
    const ts = Date.now();

    // 1. Register Planner A & Planner B
    const regA = await request(app)
      .post('/api/auth/register')
      .send({ email: `planner_checkin_a_${ts}@test.com`, password: 'Password123!', name: 'Planner Checkin A' });
    cookiePlannerA = regA.headers['set-cookie']?.[0]?.split(';')[0] || '';

    const regB = await request(app)
      .post('/api/auth/register')
      .send({ email: `planner_checkin_b_${ts}@test.com`, password: 'Password123!', name: 'Planner Checkin B' });
    cookiePlannerB = regB.headers['set-cookie']?.[0]?.split(';')[0] || '';

    // 2. Planner A creates Wedding A & Reception Function
    const wedA = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookiePlannerA)
      .send({
        title: 'Sharma & Verma Wedding',
        coupleNames: 'Rahul & Priya',
        startDate: '2026-12-15',
        endDate: '2026-12-17',
      });
    weddingAId = wedA.body.id;

    const fnA = await request(app)
      .post(`/api/weddings/${weddingAId}/functions`)
      .set('Cookie', cookiePlannerA)
      .send({
        name: 'Grand Reception',
        dateTime: '2026-12-16T19:30:00Z',
        venue: 'Taj Palace Grand Ballroom',
      });
    functionAId = fnA.body.id;

    // 3. Planner A creates two households: A1 (invited + RSVP yes) and A2 (invited + RSVP maybe)
    const hhA1 = await request(app)
      .post(`/api/weddings/${weddingAId}/households`)
      .set('Cookie', cookiePlannerA)
      .send({
        name: 'Kapoor Family',
        primaryContactName: 'Anil Kapoor',
        phone: '+919876543201',
        expectedPartySize: 4,
      });
    householdA1Id = hhA1.body.id;

    const hhA2 = await request(app)
      .post(`/api/weddings/${weddingAId}/households`)
      .set('Cookie', cookiePlannerA)
      .send({
        name: 'Mehta Family',
        primaryContactName: 'Sanjay Mehta',
        phone: '+919876543202',
        expectedPartySize: 3,
      });
    householdA2Id = hhA2.body.id;

    // Assign A1 and A2 to Reception
    await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookiePlannerA)
      .send({ householdIds: [householdA1Id, householdA2Id] });

    // Seed RSVP for A1: 4 confirmed guests
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      functionId: functionAId,
      householdId: householdA1Id,
      status: 'yes',
      partySize: 4,
      vegCount: 3,
      nonvegCount: 1,
      respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    // 4. Planner B creates Wedding B, Function B, and Household B
    const wedB = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookiePlannerB)
      .send({
        title: 'Foreign Wedding B',
        coupleNames: 'Bob & Alice',
        startDate: '2026-12-20',
        endDate: '2026-12-22',
      });
    weddingBId = wedB.body.id;

    const fnB = await request(app)
      .post(`/api/weddings/${weddingBId}/functions`)
      .set('Cookie', cookiePlannerB)
      .send({
        name: 'Function B',
        dateTime: '2026-12-21T18:00:00Z',
        venue: 'Venue B',
      });
    functionBId = fnB.body.id;

    const hhB = await request(app)
      .post(`/api/weddings/${weddingBId}/households`)
      .set('Cookie', cookiePlannerB)
      .send({
        name: 'Smith Family',
        primaryContactName: 'John Smith',
        phone: '+919876543999',
        expectedPartySize: 2,
      });
    householdBId = hhB.body.id;
  });

  describe('GET /api/functions/:id/checkins', () => {
    it('blocks unauthenticated access with 401', async () => {
      const res = await request(app).get(`/api/functions/${functionAId}/checkins`);
      expect(res.status).toBe(401);
    });

    it('enforces multi-tenant isolation: Planner B cannot access Planner A checkins (404)', async () => {
      const res = await request(app)
        .get(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerB);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Function not found/i);
    });

    it('returns empty checkins list and invited households overview initially', async () => {
      const res = await request(app)
        .get(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA);

      expect(res.status).toBe(200);
      expect(res.body.functionName).toBe('Grand Reception');
      expect(res.body.weddingId).toBe(weddingAId);
      expect(res.body.checkins).toEqual([]);
      expect(res.body.summary).toEqual({
        totalCheckedInGuests: 0,
        totalCheckedInHouseholds: 0,
        walkinGuests: 0,
        walkinCount: 0,
        confirmedHeadcount: 4, // Kapoor Family RSVP'd yes (4)
        invitedHeadcount: 7, // 4 + 3
      });

      expect(res.body.invitedHouseholds).toHaveLength(2);
      const a1 = res.body.invitedHouseholds.find((h: any) => h.householdId === householdA1Id);
      expect(a1).toBeDefined();
      expect(a1.householdName).toBe('Kapoor Family');
      expect(a1.isCheckedIn).toBe(false);
      expect(a1.rsvpStatus).toBe('yes');
      expect(a1.rsvpPartySize).toBe(4);
    });
  });

  describe('POST /api/functions/:id/checkins', () => {
    it('blocks unauthenticated check-in with 401', async () => {
      const res = await request(app)
        .post(`/api/functions/${functionAId}/checkins`)
        .send({ householdId: householdA1Id, actualPartySize: 4 });
      expect(res.status).toBe(401);
    });

    it('enforces multi-tenant isolation: Planner B cannot check in guests on Planner A function (404)', async () => {
      const res = await request(app)
        .post(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerB)
        .send({ householdId: householdA1Id, actualPartySize: 4 });
      expect(res.status).toBe(404);
    });

    it('rejects invalid actual party size (0 or negative)', async () => {
      const res = await request(app)
        .post(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA)
        .send({ householdId: householdA1Id, actualPartySize: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/party size must be at least 1/i);
    });

    it('rejects check-in for household from a different wedding (IDOR prevention)', async () => {
      const res = await request(app)
        .post(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA)
        .send({ householdId: householdBId, actualPartySize: 2 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not invited to this function/i);
    });

    it('successfully checks in an invited household with actual party size', async () => {
      const res = await request(app)
        .post(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA)
        .send({
          householdId: householdA1Id,
          actualPartySize: 4,
          notes: 'Arrived together with family',
        });

      expect(res.status).toBe(201);
      expect(res.body.isNew).toBe(true);
      expect(res.body.checkin).toBeDefined();
      expect(res.body.checkin.householdId).toBe(householdA1Id);
      expect(res.body.checkin.guestName).toBe('Anil Kapoor');
      expect(res.body.checkin.actualPartySize).toBe(4);
      expect(res.body.checkin.isWalkin).toBe(false);
      expect(res.body.checkin.notes).toBe('Arrived together with family');

      // Verify audit_log entry
      const logs = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.weddingId, weddingAId), eq(auditLog.action, 'venue_checkin')));
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].entityType).toBe('checkin');
    });

    it('idempotently updates check-in if the same household checks in again (party size adjust)', async () => {
      // Kapoor family brought an extra guest -> actualPartySize = 5
      const res = await request(app)
        .post(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA)
        .send({
          householdId: householdA1Id,
          actualPartySize: 5,
          notes: 'Adjusted count: brought one extra guest',
        });

      expect(res.status).toBe(200);
      expect(res.body.isNew).toBe(false);
      expect(res.body.checkin.actualPartySize).toBe(5);
      expect(res.body.checkin.notes).toBe('Adjusted count: brought one extra guest');

      // Verify DB has only 1 checkin row for householdA1
      const count = await db
        .select()
        .from(checkins)
        .where(and(eq(checkins.functionId, functionAId), eq(checkins.householdId, householdA1Id)));
      expect(count.length).toBe(1);
      expect(count[0].actualPartySize).toBe(5);
    });

    it('successfully records walk-in guest arrivals (no householdId)', async () => {
      const res = await request(app)
        .post(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA)
        .send({
          guestName: 'Vikram Seth (Colleague)',
          actualPartySize: 2,
          isWalkin: true,
          notes: 'Colleague of the groom, walk-in',
        });

      expect(res.status).toBe(201);
      expect(res.body.isNew).toBe(true);
      expect(res.body.checkin.isWalkin).toBe(true);
      expect(res.body.checkin.householdId).toBeNull();
      expect(res.body.checkin.guestName).toBe('Vikram Seth (Colleague)');
      expect(res.body.checkin.actualPartySize).toBe(2);
    });

    it('rejects walk-in guest arrival if guest name is missing', async () => {
      const res = await request(app)
        .post(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA)
        .send({
          actualPartySize: 2,
          isWalkin: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Guest name is required/i);
    });
  });

  describe('Live check-in overview tally calculation', () => {
    it('GET /api/functions/:id/checkins computes live attendance vs confirmed tally', async () => {
      const res = await request(app)
        .get(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA);

      expect(res.status).toBe(200);
      // Kapoor Family (5) + Vikram Seth walk-in (2) = 7 guests
      expect(res.body.summary.totalCheckedInGuests).toBe(7);
      expect(res.body.summary.totalCheckedInHouseholds).toBe(1); // Kapoor Family
      expect(res.body.summary.walkinGuests).toBe(2);
      expect(res.body.summary.walkinCount).toBe(1);
      expect(res.body.summary.confirmedHeadcount).toBe(4);

      // Kapoor Family in invitedHouseholds shows isCheckedIn: true
      const kapoor = res.body.invitedHouseholds.find((h: any) => h.householdId === householdA1Id);
      expect(kapoor.isCheckedIn).toBe(true);
      expect(kapoor.actualPartySize).toBe(5);

      // Mehta Family is not yet checked in
      const mehta = res.body.invitedHouseholds.find((h: any) => h.householdId === householdA2Id);
      expect(mehta.isCheckedIn).toBe(false);
      expect(mehta.actualPartySize).toBeNull();
    });
  });

  describe('PATCH /api/functions/:id/checkins/:checkinId', () => {
    let checkinId: string;

    beforeAll(async () => {
      const list = await request(app)
        .get(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA);
      checkinId = list.body.checkins[0].id;
    });

    it('enforces multi-tenant isolation on PATCH (Planner B returns 404)', async () => {
      const res = await request(app)
        .patch(`/api/functions/${functionAId}/checkins/${checkinId}`)
        .set('Cookie', cookiePlannerB)
        .send({ actualPartySize: 3 });
      expect(res.status).toBe(404);
    });

    it('updates actual party size and notes cleanly', async () => {
      const res = await request(app)
        .patch(`/api/functions/${functionAId}/checkins/${checkinId}`)
        .set('Cookie', cookiePlannerA)
        .send({ actualPartySize: 3, notes: 'Updated note via PATCH' });

      expect(res.status).toBe(200);
      expect(res.body.actualPartySize).toBe(3);
      expect(res.body.notes).toBe('Updated note via PATCH');
    });
  });

  describe('DELETE /api/functions/:id/checkins/:checkinId (Undo Check-In)', () => {
    it('enforces multi-tenant isolation on DELETE (Planner B returns 404)', async () => {
      const list = await request(app)
        .get(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA);
      const cId = list.body.checkins[0].id;

      const res = await request(app)
        .delete(`/api/functions/${functionAId}/checkins/${cId}`)
        .set('Cookie', cookiePlannerB);
      expect(res.status).toBe(404);
    });

    it('successfully undoes a check-in and logs audit entry', async () => {
      const list = await request(app)
        .get(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA);
      const walkin = list.body.checkins.find((c: any) => c.isWalkin);
      expect(walkin).toBeDefined();

      const res = await request(app)
        .delete(`/api/functions/${functionAId}/checkins/${walkin.id}`)
        .set('Cookie', cookiePlannerA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify audit log has undo_checkin
      const logs = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.weddingId, weddingAId), eq(auditLog.action, 'undo_checkin')));
      expect(logs.length).toBeGreaterThanOrEqual(1);

      // Verify walkin is gone from overview
      const afterRes = await request(app)
        .get(`/api/functions/${functionAId}/checkins`)
        .set('Cookie', cookiePlannerA);
      expect(afterRes.body.summary.walkinGuests).toBe(0);
      expect(afterRes.body.summary.walkinCount).toBe(0);
    });
  });

  describe('Concurrency & Data Privacy Verifications', () => {
    it('concurrent double check-in: Promise.all from two devices results in exactly 1 check-in row without duplicates', async () => {
      // Household A2 (Mehta Family) is not checked in yet.
      // Two phones tap check-in at the exact same moment with party sizes 3 and 4.
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/functions/${functionAId}/checkins`)
          .set('Cookie', cookiePlannerA)
          .send({ householdId: householdA2Id, actualPartySize: 3, notes: 'Device 1' }),
        request(app)
          .post(`/api/functions/${functionAId}/checkins`)
          .set('Cookie', cookiePlannerA)
          .send({ householdId: householdA2Id, actualPartySize: 4, notes: 'Device 2' }),
      ]);

      // Both requests resolve with 2xx (one creates, the other updates serialized by row lock & unique index)
      expect([200, 201]).toContain(res1.status);
      expect([200, 201]).toContain(res2.status);

      // Verify the database has EXACTLY one check-in row for household A2
      const rows = await db
        .select()
        .from(checkins)
        .where(and(eq(checkins.functionId, functionAId), eq(checkins.householdId, householdA2Id)));

      expect(rows).toHaveLength(1);
      expect([3, 4]).toContain(rows[0].actualPartySize);
    });

    it('personal data privacy: walk-in guest records are permanently cascade-deleted when the wedding is deleted', async () => {
      // 1. Create a temporary wedding, function, and walk-in check-in
      const tempWed = await request(app)
        .post('/api/weddings')
        .set('Cookie', cookiePlannerA)
        .send({
          title: 'Temporary Wedding',
          coupleNames: 'Temp & Partner',
          startDate: '2026-12-25',
          endDate: '2026-12-26',
        });
      const tempWedId = tempWed.body.id;

      const tempFn = await request(app)
        .post(`/api/weddings/${tempWedId}/functions`)
        .set('Cookie', cookiePlannerA)
        .send({
          name: 'Temp Function',
          dateTime: '2026-12-25T18:00:00Z',
          venue: 'Temp Venue',
        });
      const tempFnId = tempFn.body.id;

      // Log a walk-in guest with personal name
      const walkinRes = await request(app)
        .post(`/api/functions/${tempFnId}/checkins`)
        .set('Cookie', cookiePlannerA)
        .send({
          guestName: 'Private Walkin Guest',
          actualPartySize: 1,
          isWalkin: true,
          notes: 'Sensitive personal data',
        });
      expect(walkinRes.status).toBe(201);
      const walkinCheckinId = walkinRes.body.checkin.id;

      // 2. Delete the wedding
      const delRes = await request(app)
        .delete(`/api/weddings/${tempWedId}`)
        .set('Cookie', cookiePlannerA);
      expect(delRes.status).toBe(200);

      // 3. PROOF: Query checkins table directly to verify walkin guest row was cascade-deleted
      const remaining = await db
        .select()
        .from(checkins)
        .where(eq(checkins.id, walkinCheckinId));

      expect(remaining).toHaveLength(0);
    });
  });
});
