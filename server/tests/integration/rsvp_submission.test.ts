import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { planners, weddings, functions, households, householdFunctions, rsvps, auditLog } from '../../src/db/schema';
import { hashPassword, generateInviteToken } from '../../src/utils/auth';
import { resetRsvpLimiters } from '../../src/middleware/rateLimit';

describe('Task T2.5 Integration Tests: Public RSVP Submission API (POST /api/rsvp/:token)', () => {
  let cookiePlannerA: string;
  const plannerId = crypto.randomUUID();
  const weddingId = crypto.randomUUID();
  const function1Id = crypto.randomUUID();
  const function2Id = crypto.randomUUID();
  const function3Id = crypto.randomUUID(); // Uninvited function
  const household1Id = crypto.randomUUID();
  const token1 = generateInviteToken();
  const household2Id = crypto.randomUUID();
  const token2 = generateInviteToken();

  beforeAll(async () => {
    // 1. Seed planner
    const passHash = await hashPassword('Password123!');
    const email = `planner-t25-${Date.now()}@example.com`;
    await db.insert(planners).values({
      id: plannerId,
      email,
      passwordHash: passHash,
      name: 'T2.5 Planner',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      password: 'Password123!',
    });
    cookiePlannerA = loginRes.headers['set-cookie'][0];

    // 2. Seed wedding
    await db.insert(weddings).values({
      id: weddingId,
      plannerId,
      title: 'T2.5 Concurrency Wedding',
      coupleNames: 'Rohan & Ananya',
      startDate: new Date('2026-12-15'),
      endDate: new Date('2026-12-17'),
    });

    // 3. Seed functions
    await db.insert(functions).values([
      {
        id: function1Id,
        weddingId,
        name: 'Sangeet Night',
        dateTime: new Date('2026-12-15T19:00:00Z'),
        venue: 'Grand Ballroom',
      },
      {
        id: function2Id,
        weddingId,
        name: 'Wedding Pheras',
        dateTime: new Date('2026-12-16T11:00:00Z'),
        venue: 'Main Courtyard',
      },
      {
        id: function3Id,
        weddingId,
        name: 'VIP Private Breakfast',
        dateTime: new Date('2026-12-17T09:00:00Z'),
        venue: 'Suites Terrace',
      },
    ]);

    // 4. Seed households
    await db.insert(households).values([
      {
        id: household1Id,
        weddingId,
        name: 'Kapoor Family',
        primaryContactName: 'Sameer Kapoor',
        phone: '+919876543222',
        expectedPartySize: 4,
        inviteToken: token1,
      },
      {
        id: household2Id,
        weddingId,
        name: 'Sharma Family',
        primaryContactName: 'Anil Sharma',
        phone: '+919876543233',
        expectedPartySize: 2,
        inviteToken: token2,
      },
    ]);

    // 5. Assign household to function1 and function2 (NOT function3)
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
      {
        id: crypto.randomUUID(),
        householdId: household2Id,
        functionId: function1Id,
      },
    ]);
  });

  beforeEach(() => {
    resetRsvpLimiters('127.0.0.1');
  });

  it('submits initial RSVPs for invited functions with strict dietary validation and audit logging', async () => {
    const payload = {
      responses: [
        {
          functionId: function1Id,
          status: 'yes',
          partySize: 3,
          vegCount: 2,
          nonvegCount: 1,
          dietaryNotes: 'One person has nut allergy',
        },
        {
          functionId: function2Id,
          status: 'no',
        },
      ],
    };

    const res = await request(app)
      .post(`/api/rsvp/${token1}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.submittedCount).toBe(2);

    // Verify database entries in rsvps
    const savedRsvps = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.householdId, household1Id));

    expect(savedRsvps).toHaveLength(2);

    const f1Rsvp = savedRsvps.find((r) => r.functionId === function1Id);
    expect(f1Rsvp).toBeDefined();
    expect(f1Rsvp?.status).toBe('yes');
    expect(f1Rsvp?.partySize).toBe(3);
    expect(f1Rsvp?.vegCount).toBe(2);
    expect(f1Rsvp?.nonvegCount).toBe(1);
    expect(f1Rsvp?.dietaryNotes).toBe('One person has nut allergy');

    const f2Rsvp = savedRsvps.find((r) => r.functionId === function2Id);
    expect(f2Rsvp).toBeDefined();
    expect(f2Rsvp?.status).toBe('no');
    expect(f2Rsvp?.partySize).toBe(0);
    expect(f2Rsvp?.vegCount).toBe(0);
    expect(f2Rsvp?.nonvegCount).toBe(0);

    // Verify audit log has submit_rsvp records with zero PII
    const logs = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.weddingId, weddingId), eq(auditLog.actorId, household1Id)));

    expect(logs.length).toBeGreaterThanOrEqual(2);
    const submitLogs = logs.filter((l) => l.action === 'submit_rsvp');
    expect(submitLogs).toHaveLength(2);
    expect(submitLogs[0].actorType).toBe('guest');
    expect(submitLogs[0].ipAddress).toBeNull();
  });

  it('updates an existing RSVP without creating duplicate rows (revisiting the link)', async () => {
    // Guest updates function1 from 3 guests to 4 guests (3 veg, 1 nonveg)
    const updatePayload = {
      functionId: function1Id,
      status: 'yes',
      partySize: 4,
      vegCount: 3,
      nonvegCount: 1,
      dietaryNotes: 'Updated: plus one baby chair',
    };

    const res = await request(app)
      .post(`/api/rsvp/${token1}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Ensure only 1 row exists for (household1, function1)
    const rows = await db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.householdId, household1Id), eq(rsvps.functionId, function1Id)));

    expect(rows).toHaveLength(1);
    expect(rows[0].partySize).toBe(4);
    expect(rows[0].vegCount).toBe(3);
    expect(rows[0].nonvegCount).toBe(1);
    expect(rows[0].dietaryNotes).toBe('Updated: plus one baby chair');

    // Verify audit log recorded update_rsvp
    const logs = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, rows[0].id), eq(auditLog.action, 'update_rsvp')));

    expect(logs).toHaveLength(1);
    expect((logs[0].oldValues as any)?.partySize).toBe(3);
    expect((logs[0].newValues as any)?.partySize).toBe(4);
  });

  it('rejects RSVP submission for a function the household was NOT invited to', async () => {
    const uninvitedPayload = {
      functionId: function3Id, // Not invited
      status: 'yes',
      partySize: 2,
      vegCount: 2,
      nonvegCount: 0,
    };

    const res = await request(app)
      .post(`/api/rsvp/${token1}`)
      .send(uninvitedPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Household is not invited to function/i);

    // Confirm no row created
    const rows = await db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.householdId, household1Id), eq(rsvps.functionId, function3Id)));

    expect(rows).toHaveLength(0);
  });

  it('proves atomic rollback: if one response in a multi-function batch fails, all prior writes in that batch are rolled back', async () => {
    // Attempt batch: function1 (invited and valid) + function3 (not invited)
    const mixedBatch = {
      responses: [
        {
          functionId: function1Id,
          status: 'yes',
          partySize: 2,
          vegCount: 2,
          nonvegCount: 0,
        },
        {
          functionId: function3Id, // Will fail check inside transaction
          status: 'yes',
          partySize: 2,
          vegCount: 2,
          nonvegCount: 0,
        },
      ],
    };

    const res = await request(app)
      .post(`/api/rsvp/${token2}`)
      .send(mixedBatch);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Household is not invited to function/i);

    // Verify atomic rollback: function1 was NOT committed for household2
    const household2Rsvps = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.householdId, household2Id));

    expect(household2Rsvps).toHaveLength(0);

    // Verify auditLog was also rolled back
    const household2AuditLogs = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.actorId, household2Id));

    expect(household2AuditLogs).toHaveLength(0);
  });

  it('rejects submissions with invalid dietary math (veg + nonveg != partySize)', async () => {
    const invalidMath = {
      functionId: function1Id,
      status: 'yes',
      partySize: 4,
      vegCount: 1,
      nonvegCount: 1, // 1 + 1 = 2 != 4
    };

    const res = await request(app)
      .post(`/api/rsvp/${token1}`)
      .send(invalidMath);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Veg \+ Non-Veg count must equal party size/i);
  });

  it('rejects submissions with dietary notes exceeding 500 characters', async () => {
    const res = await request(app)
      .post(`/api/rsvp/${token1}`)
      .send({
        functionId: function1Id,
        status: 'yes',
        partySize: 2,
        vegCount: 1,
        nonvegCount: 1,
        dietaryNotes: 'X'.repeat(501),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot exceed 500 characters/i);
  });

  it('rejects submissions with duplicate function IDs in the same request', async () => {
    const duplicateBody = [
      { functionId: function1Id, status: 'yes', partySize: 2, vegCount: 2, nonvegCount: 0 },
      { functionId: function1Id, status: 'no' },
    ];

    const res = await request(app)
      .post(`/api/rsvp/${token1}`)
      .send(duplicateBody);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duplicate function responses/i);
  });

  it('returns uniform 404 for invalid or malformed tokens', async () => {
    const res = await request(app)
      .post('/api/rsvp/malformed-token-xyz')
      .send({ functionId: function1Id, status: 'no' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Invitation not found' });
  });

  it('safely serializes concurrent RSVP submissions on the same household without data corruption or deadlocks', async () => {
    // Concurrently trigger 5 updates with different party sizes
    const concurrentRequests = [1, 2, 3, 4, 5].map((size) =>
      request(app)
        .post(`/api/rsvp/${token1}`)
        .send({
          functionId: function1Id,
          status: 'yes',
          partySize: size,
          vegCount: size,
          nonvegCount: 0,
        })
    );

    const responses = await Promise.all(concurrentRequests);

    // All requests must succeed (HTTP 200) without crashing or deadlocking
    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    // Exactly 1 row exists in the database
    const finalRows = await db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.householdId, household1Id), eq(rsvps.functionId, function1Id)));

    expect(finalRows).toHaveLength(1);
    // Final vegCount must match final partySize
    expect(finalRows[0].vegCount).toBe(finalRows[0].partySize);
  });

  it('prevents planner from uninviting a household that submitted an active RSVP', async () => {
    // Ensure household has status 'yes' for function1
    await request(app)
      .post(`/api/rsvp/${token1}`)
      .send({
        functionId: function1Id,
        status: 'yes',
        partySize: 2,
        vegCount: 2,
        nonvegCount: 0,
      });

    // Planner attempts to uninvite this household from function1
    const uninviteRes = await request(app)
      .post(`/api/functions/${function1Id}/invitations`)
      .set('Cookie', cookiePlannerA)
      .send({ remove: [household1Id] });

    expect(uninviteRes.status).toBe(400);
    expect(uninviteRes.body.error).toMatch(/Cannot unassign household that has already submitted an active RSVP/i);
  });
});

