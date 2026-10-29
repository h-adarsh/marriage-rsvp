import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { rsvps, auditLog, householdFunctions } from '../../src/db/schema';

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
    expect(res.body.error).toMatch(/Cannot unassign household that has already submitted an active RSVP/i);
  });

  it('supports delta add and remove operations to prevent stale browser tab overwrites', async () => {
    // 1. Add householdA2Id via delta add
    const addRes = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ add: [householdA2Id] });

    expect(addRes.status).toBe(200);
    expect(addRes.body.addedCount).toBe(1);

    // Verify both A1 and A2 are now invited
    const listRes = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    const a1 = listRes.body.find((h: any) => h.id === householdA1Id);
    const a2 = listRes.body.find((h: any) => h.id === householdA2Id);
    expect(a1?.invited).toBe(true);
    expect(a2?.invited).toBe(true);

    // 2. Remove householdA2Id via delta remove without affecting A1
    const removeRes = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ remove: [householdA2Id] });

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.removedCount).toBe(1);

    // Verify A2 is uninvited while A1 remains invited
    const listResAfter = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    const a1After = listResAfter.body.find((h: any) => h.id === householdA1Id);
    const a2After = listResAfter.body.find((h: any) => h.id === householdA2Id);
    expect(a1After?.invited).toBe(true);
    expect(a2After?.invited).toBe(false);
  });

  it('successfully unassigns a household that has NOT replied (no RSVP submitted)', async () => {
    // 1. Assign householdA2Id (which has no RSVP in rsvps table)
    await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ add: [householdA2Id] });

    // 2. Unassign householdA2Id - should succeed without error because no RSVP was submitted
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ remove: [householdA2Id] });

    expect(res.status).toBe(200);
    expect(res.body.removedCount).toBe(1);

    const listRes = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    const a2 = listRes.body.find((h: any) => h.id === householdA2Id);
    expect(a2?.invited).toBe(false);
  });

  it('rejects delta add containing a foreign household (IDOR defense)', async () => {
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ add: [householdBId] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/do not belong to this wedding/i);
  });

  it('rejects delta remove containing a foreign household (IDOR defense)', async () => {
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ remove: [householdBId] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/do not belong to this wedding/i);
  });

  it('rejects mixing householdIds with delta add or remove (mode exclusivity)', async () => {
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ householdIds: [householdA1Id], add: [householdA2Id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot mix "householdIds" with "add" or "remove"/i);
  });

  it('rejects request when the same household ID is present in both add and remove', async () => {
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ add: [householdA2Id], remove: [householdA2Id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot be present in both add and remove/i);
  });

  it('GET /api/functions/:id/invitations returns accurate rsvpStatus and partySize for all states', async () => {
    // 1. Create a third household for Wedding A to test 'no' and 'maybe' responses
    const hhA3 = await request(app)
      .post(`/api/weddings/${weddingAId}/households`)
      .set('Cookie', cookieA)
      .send({ name: "Gupta Family", primaryContactName: "Anita Gupta", phone: "+919876543203", expectedPartySize: 2 });
    const householdA3Id = hhA3.body.id;

    // 2. Invite householdA3Id
    await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ add: [householdA3Id] });

    // 3. Insert 'no' RSVP for householdA3Id
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      functionId: functionAId,
      householdId: householdA3Id,
      status: 'no',
      partySize: 0,
      vegCount: 0,
      nonvegCount: 0,
    });

    // 4. Fetch invitations and verify statuses
    const res = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);

    expect(res.status).toBe(200);

    const a1 = res.body.find((h: any) => h.id === householdA1Id);
    const a2 = res.body.find((h: any) => h.id === householdA2Id);
    const a3 = res.body.find((h: any) => h.id === householdA3Id);

    // Household A1 has 'yes' RSVP with 3 guests
    expect(a1?.invited).toBe(true);
    expect(a1?.rsvpStatus).toBe('yes');
    expect(a1?.rsvpPartySize).toBe(3);

    // Household A2 is not invited
    expect(a2?.invited).toBe(false);
    expect(a2?.rsvpStatus).toBeNull();
    expect(a2?.rsvpPartySize).toBeNull();

    // Household A3 has 'no' RSVP
    expect(a3?.invited).toBe(true);
    expect(a3?.rsvpStatus).toBe('no');
    expect(a3?.rsvpPartySize).toBe(0);
  });

  it('allows uninviting a household that replied "no" (decline has no headcount to protect)', async () => {
    // Household A3 has a 'no' RSVP. Uninviting should succeed.
    // Fetch all households to locate A3
    const listRes = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    const a3 = listRes.body.find((h: any) => h.phone === '+919876543203');
    expect(a3?.rsvpStatus).toBe('no');

    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ remove: [a3.id] });

    expect(res.status).toBe(200);
    expect(res.body.removedCount).toBe(1);

    // Verify A3 is now uninvited and decline record was cleaned up
    const afterRes = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    const a3After = afterRes.body.find((h: any) => h.id === a3.id);
    expect(a3After?.invited).toBe(false);
  });

  it('provides Reset RSVP endpoint allowing planners to reset active attendance and uninvite', async () => {
    // 1. Attempting to unassign household A1 (status: 'yes') is blocked
    const blockedRes = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ remove: [householdA1Id] });

    expect(blockedRes.status).toBe(400);
    expect(blockedRes.body.error).toMatch(/Cannot unassign household that has already submitted an active RSVP/i);

    // 2. Call Reset RSVP endpoint
    const resetRes = await request(app)
      .post(`/api/functions/${functionAId}/rsvps/${householdA1Id}/reset`)
      .set('Cookie', cookieA);

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // 3. Verify GET shows rsvpStatus is now cleared
    const listRes = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    const a1 = listRes.body.find((h: any) => h.id === householdA1Id);
    expect(a1?.rsvpStatus).toBeNull();
    expect(a1?.rsvpPartySize).toBeNull();

    // 4. Now unassigning household A1 succeeds cleanly
    const unassignRes = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ remove: [householdA1Id] });

    expect(unassignRes.status).toBe(200);
    expect(unassignRes.body.removedCount).toBe(1);
  });

  it('rejects batch unassign when any household has an active RSVP, leaving existing assignments untouched', async () => {
    // 1. Re-invite householdA2Id
    await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ add: [householdA2Id] });

    // 2. Set an active RSVP ('yes') on householdA2Id
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      functionId: functionAId,
      householdId: householdA2Id,
      status: 'yes',
      partySize: 4,
      vegCount: 4,
      nonvegCount: 0,
    });

    // 3. Re-invite householdA1Id
    await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ add: [householdA1Id] });

    // Current state: both A1 and A2 are invited
    const beforeRes = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    const a1Before = beforeRes.body.find((h: any) => h.id === householdA1Id);
    const a2Before = beforeRes.body.find((h: any) => h.id === householdA2Id);
    expect(a1Before?.invited).toBe(true);
    expect(a2Before?.invited).toBe(true);

    // 4. Send a batch remove containing both A1 (unlocked) AND A2 (locked 'yes' RSVP).
    // The entire request must fail: A1 must NOT be uninvited!
    const failedBatchRes = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ remove: [householdA1Id, householdA2Id] });

    expect(failedBatchRes.status).toBe(400);

    // 5. Verify that A1 was NOT uninvited
    const afterRes = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    const a1After = afterRes.body.find((h: any) => h.id === householdA1Id);
    const a2After = afterRes.body.find((h: any) => h.id === householdA2Id);
    expect(a1After?.invited).toBe(true);
    expect(a2After?.invited).toBe(true);
  });

  it('cross-planner protection: Planner B cannot reset Planner A RSVP (returns 404)', async () => {
    const res = await request(app)
      .post(`/api/functions/${functionAId}/rsvps/${householdA2Id}/reset`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(404);
  });

  it('cross-wedding protection: cannot reset household from another wedding on function (returns 404)', async () => {
    const res = await request(app)
      .post(`/api/functions/${functionAId}/rsvps/${householdBId}/reset`)
      .set('Cookie', cookieA);
    expect(res.status).toBe(404);
  });

  it('records audit_log entry when an RSVP is reset by planner', async () => {
    // householdA2Id currently has an active RSVP
    const resetRes = await request(app)
      .post(`/api/functions/${functionAId}/rsvps/${householdA2Id}/reset`)
      .set('Cookie', cookieA);
    expect(resetRes.status).toBe(200);

    // Check audit_log table
    const logs = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.weddingId, weddingAId), eq(auditLog.action, 'reset_rsvp')));

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].actorType).toBe('planner');
    expect(logs[0].action).toBe('reset_rsvp');
  });

  it('proves the invitations route transaction rolls back deletions if subsequent insert fails midway', async () => {
    // 1. Ensure householdA1 is invited and householdA2 is not invited
    await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ householdIds: [householdA1Id] });

    // Verify initial state
    const beforeRes = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    expect(beforeRes.body.find((h: any) => h.id === householdA1Id)?.invited).toBe(true);
    expect(beforeRes.body.find((h: any) => h.id === householdA2Id)?.invited).toBe(false);

    // 2. Spy on db.transaction to let tx.delete succeed, but force tx.insert to fail midway
    const realTransaction = db.transaction.bind(db);
    const txSpy = vi.spyOn(db, 'transaction').mockImplementation(async (callback) => {
      return realTransaction(async (tx) => {
        const realInsert = tx.insert.bind(tx);
        (tx as any).insert = (table: any) => {
          if (table === householdFunctions) {
            throw new Error('Simulated database write error during assignment insert');
          }
          return realInsert(table);
        };
        return callback(tx);
      });
    });

    // 3. Dispatch HTTP request to unassign A1 and assign A2
    const res = await request(app)
      .post(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA)
      .send({ remove: [householdA1Id], add: [householdA2Id] });

    // Route catches error and returns 500
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to update function invitations/i);

    // Restore the spy
    txSpy.mockRestore();

    // 4. PROOF: Query the database to verify householdA1Id was NOT uninvited because the route's transaction rolled back!
    const afterRes = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    const a1After = afterRes.body.find((h: any) => h.id === householdA1Id);
    const a2After = afterRes.body.find((h: any) => h.id === householdA2Id);

    expect(a1After?.invited).toBe(true);
    expect(a2After?.invited).toBe(false);
  });

  it('GET /api/functions/:id/invitations accurately flags stale RSVPs (>14 days) and returns daysAgo', async () => {
    // Household A1 is invited. Create an RSVP with respondedAt 20 days ago (stale)
    await db.delete(rsvps).where(and(eq(rsvps.functionId, functionAId), eq(rsvps.householdId, householdA1Id)));
    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      functionId: functionAId,
      householdId: householdA1Id,
      status: 'yes',
      partySize: 3,
      vegCount: 2,
      nonvegCount: 1,
      respondedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    });

    // Default stale threshold (14 days)
    const resDefault = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);

    expect(resDefault.status).toBe(200);
    const a1 = resDefault.body.find((h: any) => h.id === householdA1Id);
    expect(a1).toBeDefined();
    expect(a1.rsvpStatus).toBe('yes');
    expect(a1.isStale).toBe(true);
    expect(a1.daysAgo).toBeGreaterThanOrEqual(19);

    // Custom threshold: ?staleDays=30 -> 20 days is NOT stale
    const res30 = await request(app)
      .get(`/api/functions/${functionAId}/invitations?staleDays=30`)
      .set('Cookie', cookieA);

    expect(res30.status).toBe(200);
    const a1Custom = res30.body.find((h: any) => h.id === householdA1Id);
    expect(a1Custom.isStale).toBe(false);
    expect(a1Custom.daysAgo).toBeGreaterThanOrEqual(19);

    // Household with 'no' response 25 days ago is NEVER stale
    await db.update(rsvps)
      .set({ status: 'no', partySize: 0, respondedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) })
      .where(and(eq(rsvps.functionId, functionAId), eq(rsvps.householdId, householdA1Id)));

    const resNo = await request(app)
      .get(`/api/functions/${functionAId}/invitations`)
      .set('Cookie', cookieA);
    const a1No = resNo.body.find((h: any) => h.id === householdA1Id);
    expect(a1No.rsvpStatus).toBe('no');
    expect(a1No.isStale).toBe(false);
  });
});




