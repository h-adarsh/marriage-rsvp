import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { auditLog } from '../../src/db/schema';

describe('Multi-Tenant Isolation & Security (Planner A vs Planner B)', () => {
  let cookieA: string;
  let cookieB: string;
  let weddingAId: string;
  let functionAId: string;
  let householdAId: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    // 1. Register Planner A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        email: `alice_${timestamp}@integration.com`,
        password: 'Password123!',
        name: 'Alice Planner',
      });
    expect(resA.status).toBe(201);
    cookieA = resA.headers['set-cookie']?.[0]?.split(';')[0] || '';

    // 2. Register Planner B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        email: `bob_${timestamp}@integration.com`,
        password: 'Password123!',
        name: 'Bob Planner',
      });
    expect(resB.status).toBe(201);
    cookieB = resB.headers['set-cookie']?.[0]?.split(';')[0] || '';

    // 3. Planner A creates Wedding A
    const wedRes = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookieA)
      .send({
        title: "Alice's Secret Wedding",
        coupleNames: 'Alice & Alex',
        startDate: '2026-12-01',
        endDate: '2026-12-03',
      });
    expect(wedRes.status).toBe(201);
    weddingAId = wedRes.body.id;

    // 4. Planner A adds Function A
    const fnRes = await request(app)
      .post(`/api/weddings/${weddingAId}/functions`)
      .set('Cookie', cookieA)
      .send({
        name: 'Private Pheras',
        dateTime: '2026-12-02T18:00:00Z',
        venue: 'Private Island',
      });
    expect(fnRes.status).toBe(201);
    functionAId = fnRes.body.id;

    // 5. Planner A adds Household A
    const hhRes = await request(app)
      .post(`/api/weddings/${weddingAId}/households`)
      .set('Cookie', cookieA)
      .send({
        name: 'Alice VIP Guest',
        primaryContactName: 'VIP Contact',
        phone: '+919876543210',
        expectedPartySize: 4,
      });
    expect(hhRes.status).toBe(201);
    householdAId = hhRes.body.id;
  });

  it('prevents Planner B from reading Planner A wedding (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/weddings/${weddingAId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/wedding not found/i);
  });

  it('prevents Planner B from updating Planner A wedding (returns 404)', async () => {
    const res = await request(app)
      .put(`/api/weddings/${weddingAId}`)
      .set('Cookie', cookieB)
      .send({
        title: 'Tampered by Bob',
        coupleNames: 'Bob & Evil',
        startDate: '2026-12-01',
        endDate: '2026-12-03',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/wedding not found/i);
  });

  it('prevents Planner B from deleting Planner A wedding (returns 404)', async () => {
    const res = await request(app)
      .delete(`/api/weddings/${weddingAId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/wedding not found/i);
  });

  it('prevents Planner B from reading Planner A functions list (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/weddings/${weddingAId}/functions`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/wedding not found/i);
  });

  it('prevents Planner B from creating a function under Planner A wedding (returns 404)', async () => {
    const res = await request(app)
      .post(`/api/weddings/${weddingAId}/functions`)
      .set('Cookie', cookieB)
      .send({
        name: 'Bob Injected Function',
        dateTime: '2026-12-02T20:00:00Z',
        venue: 'Unauthorized Venue',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/wedding not found/i);
  });

  it('prevents Planner B from modifying Planner A function directly (returns 404)', async () => {
    const res = await request(app)
      .put(`/api/functions/${functionAId}`)
      .set('Cookie', cookieB)
      .send({
        name: 'Hijacked Function Name',
        dateTime: '2026-12-02T21:00:00Z',
        venue: 'Hijacked Venue',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/function not found/i);
  });

  it('prevents Planner B from deleting Planner A function directly (returns 404)', async () => {
    const res = await request(app)
      .delete(`/api/functions/${functionAId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/function not found/i);
  });

  it('prevents Planner B from listing Planner A households (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/weddings/${weddingAId}/households`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/wedding not found/i);
  });

  it('prevents Planner B from modifying Planner A household directly (returns 404)', async () => {
    const res = await request(app)
      .put(`/api/households/${householdAId}`)
      .set('Cookie', cookieB)
      .send({
        name: 'Hijacked Guest',
        primaryContactName: 'Hijacked Contact',
        phone: '+919999999999',
        expectedPartySize: 2,
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/household not found/i);
  });

  it('prevents Planner B from deleting Planner A household directly (returns 404)', async () => {
    const res = await request(app)
      .delete(`/api/households/${householdAId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/household not found/i);
  });

  it('rejects unauthenticated requests (missing session) with 401 across all routes', async () => {
    const resWed = await request(app).get(`/api/weddings/${weddingAId}`);
    expect(resWed.status).toBe(401);

    const resFns = await request(app).get(`/api/weddings/${weddingAId}/functions`);
    expect(resFns.status).toBe(401);

    const resHhs = await request(app).get(`/api/weddings/${weddingAId}/households`);
    expect(resHhs.status).toBe(401);
  });

  it('cascades deletion of wedding to automatically remove all associated audit_log entries', async () => {
    // 1. Planner A creates a disposable wedding for cascade testing
    const wedRes = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookieA)
      .send({
        title: 'Cascade Test Wedding',
        coupleNames: 'Cascade & Partner',
        startDate: '2026-12-20',
        endDate: '2026-12-22',
      });
    expect(wedRes.status).toBe(201);
    const tempWeddingId = wedRes.body.id;

    // 2. Insert audit log entries associated with this wedding
    const auditId = crypto.randomUUID();
    await db.insert(auditLog).values({
      id: auditId,
      weddingId: tempWeddingId,
      actorType: 'planner',
      actorId: 'test-planner',
      action: 'reset_rsvp',
      entityType: 'rsvp',
      entityId: 'some-rsvp-id',
      oldValues: { status: 'yes', partySize: 2 },
      newValues: null,
    });

    // Verify audit log entry exists
    const beforeAudit = await db.select().from(auditLog).where(eq(auditLog.id, auditId));
    expect(beforeAudit).toHaveLength(1);

    // 3. Delete the wedding
    const delRes = await request(app)
      .delete(`/api/weddings/${tempWeddingId}`)
      .set('Cookie', cookieA);
    expect(delRes.status).toBe(200);

    // 4. Verify that foreign key ON DELETE CASCADE deleted the audit_log entry
    const afterAudit = await db.select().from(auditLog).where(eq(auditLog.id, auditId));
    expect(afterAudit).toHaveLength(0);
  });
});
