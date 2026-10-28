import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { planners, weddings, households, auditLog } from '../../src/db/schema';
import { hashPassword, generateInviteToken } from '../../src/utils/auth';

describe('Task T2.4b: Invite Link Revocation & Token Regeneration (POST /api/households/:id/regenerate-token)', () => {
  let cookiePlannerA: string;
  let cookiePlannerB: string;
  const plannerAId = crypto.randomUUID();
  const plannerBId = crypto.randomUUID();
  const weddingAId = crypto.randomUUID();
  const householdAId = crypto.randomUUID();
  let initialTokenA: string;

  beforeAll(async () => {
    // 1. Create Planner A
    const passHashA = await hashPassword('Password123!');
    const emailA = `planner-a-${Date.now()}@example.com`;
    await db.insert(planners).values({
      id: plannerAId,
      email: emailA,
      passwordHash: passHashA,
      name: 'Planner A',
    });

    const loginResA = await request(app).post('/api/auth/login').send({
      email: emailA,
      password: 'Password123!',
    });
    cookiePlannerA = loginResA.headers['set-cookie'][0];

    // 2. Create Planner B
    const passHashB = await hashPassword('Password123!');
    const emailB = `planner-b-${Date.now()}@example.com`;
    await db.insert(planners).values({
      id: plannerBId,
      email: emailB,
      passwordHash: passHashB,
      name: 'Planner B',
    });

    const loginResB = await request(app).post('/api/auth/login').send({
      email: emailB,
      password: 'Password123!',
    });
    cookiePlannerB = loginResB.headers['set-cookie'][0];

    // 3. Create Wedding for Planner A
    await db.insert(weddings).values({
      id: weddingAId,
      plannerId: plannerAId,
      title: 'Token Revocation Wedding',
      coupleNames: 'Bride & Groom',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-03'),
    });

    // 4. Create Household under Planner A's wedding
    initialTokenA = generateInviteToken();
    await db.insert(households).values({
      id: householdAId,
      weddingId: weddingAId,
      name: 'Revocation Test Family',
      primaryContactName: 'Test Contact',
      phone: '+919876543299',
      expectedPartySize: 4,
      inviteToken: initialTokenA,
    });
  });

  it('proves that regenerating an invite token revokes the old link and makes it return 404 immediately', async () => {
    // Step 1: Verify old token works on public RSVP route
    const initialCheck = await request(app).get(`/api/rsvp/${initialTokenA}`);
    expect(initialCheck.status).toBe(200);
    expect(initialCheck.body.household.name).toBe('Revocation Test Family');

    // Step 2: Planner A calls regenerate-token endpoint
    const regenRes = await request(app)
      .post(`/api/households/${householdAId}/regenerate-token`)
      .set('Cookie', cookiePlannerA);

    expect(regenRes.status).toBe(200);
    expect(regenRes.body.success).toBe(true);
    expect(regenRes.body.householdId).toBe(householdAId);

    const newToken = regenRes.body.inviteToken;
    expect(newToken).toBeDefined();
    expect(newToken).toHaveLength(32);
    expect(newToken).not.toBe(initialTokenA);

    // Step 3: Verify OLD token is now completely revoked and returns HTTP 404
    const oldCheck = await request(app).get(`/api/rsvp/${initialTokenA}`);
    expect(oldCheck.status).toBe(404);
    expect(oldCheck.body).toEqual({ error: 'Invitation not found' });

    // Step 4: Verify NEW token works and returns the household
    const newCheck = await request(app).get(`/api/rsvp/${newToken}`);
    expect(newCheck.status).toBe(200);
    expect(newCheck.body.household.name).toBe('Revocation Test Family');

    // Step 5: Verify an audit log entry was written
    const logs = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, householdAId));

    const regenAudit = logs.find((l) => l.action === 'regenerate_token');
    expect(regenAudit).toBeDefined();
    expect(regenAudit?.weddingId).toBe(weddingAId);
    expect(regenAudit?.actorType).toBe('planner');
    expect(regenAudit?.actorId).toBe(plannerAId);
    expect((regenAudit?.oldValues as any)?.inviteToken).toBe(initialTokenA);
    expect((regenAudit?.newValues as any)?.inviteToken).toBe(newToken);
  });

  it('prevents unauthorized or cross-planner token regeneration (IDOR protection)', async () => {
    // Unauthenticated request returns 401
    const unauthRes = await request(app)
      .post(`/api/households/${householdAId}/regenerate-token`);
    expect(unauthRes.status).toBe(401);

    // Cross-planner (Planner B tries to regenerate Planner A's household token) returns 404
    const crossPlannerRes = await request(app)
      .post(`/api/households/${householdAId}/regenerate-token`)
      .set('Cookie', cookiePlannerB);
    expect(crossPlannerRes.status).toBe(404);
    expect(crossPlannerRes.body).toEqual({ error: 'Household not found' });
  });
});
