import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { planners, weddings, functions, households, householdFunctions, rsvps } from '../../src/db/schema';
import { hashPassword, generateInviteToken } from '../../src/utils/auth';

describe('Task T3.6 Integration Tests: Caterer CSV Export API (GET /api/functions/:id/export-csv)', () => {
  let cookiePlannerA: string;
  let cookiePlannerB: string;
  const plannerAId = crypto.randomUUID();
  const plannerBId = crypto.randomUUID();
  const weddingAId = crypto.randomUUID();
  const weddingBId = crypto.randomUUID();
  const functionAId = crypto.randomUUID();
  const functionBId = crypto.randomUUID();

  const householdIds: string[] = [];

  beforeAll(async () => {
    // 1. Planner A setup
    const passHash = await hashPassword('Password123!');
    const emailA = `planner-csvexport-a-${Date.now()}@example.com`;
    await db.insert(planners).values({
      id: plannerAId,
      email: emailA,
      passwordHash: passHash,
      name: 'Planner A (Catering Lead)',
    });

    const loginResA = await request(app).post('/api/auth/login').send({
      email: emailA,
      password: 'Password123!',
    });
    cookiePlannerA = loginResA.headers['set-cookie'][0];

    // 2. Planner B setup (Multi-tenant adversary)
    const emailB = `planner-csvexport-b-${Date.now()}@example.com`;
    await db.insert(planners).values({
      id: plannerBId,
      email: emailB,
      passwordHash: passHash,
      name: 'Planner B (Unauthorized)',
    });

    const loginResB = await request(app).post('/api/auth/login').send({
      email: emailB,
      password: 'Password123!',
    });
    cookiePlannerB = loginResB.headers['set-cookie'][0];

    // 3. Weddings
    await db.insert(weddings).values([
      {
        id: weddingAId,
        plannerId: plannerAId,
        title: "Ananya & Kabir's Wedding",
        coupleNames: 'Ananya Sharma & Kabir Malhotra',
        startDate: new Date('2026-12-10'),
        endDate: new Date('2026-12-12'),
      },
      {
        id: weddingBId,
        plannerId: plannerBId,
        title: 'Unauthorized Wedding',
        coupleNames: 'Stranger & Stranger',
        startDate: new Date('2026-12-12'),
        endDate: new Date('2026-12-14'),
      },
    ]);

    // 4. Functions
    await db.insert(functions).values([
      {
        id: functionAId,
        weddingId: weddingAId,
        name: 'Sangeet & Cocktail',
        dateTime: new Date('2026-12-10T19:30:00Z'),
        venue: 'The Grand Ballroom',
      },
      {
        id: functionBId,
        weddingId: weddingBId,
        name: 'Private Function B',
        dateTime: new Date('2026-12-12T19:00:00Z'),
        venue: 'Lakeside Lawn',
      },
    ]);

    // 5. Seed 3 households with different dietary and formula test cases
    // Household 1: Confirmed with malicious formula in dietary notes
    const hid1 = crypto.randomUUID();
    householdIds.push(hid1);
    await db.insert(households).values({
      id: hid1,
      weddingId: weddingAId,
      name: 'Kapoor Family',
      primaryContactName: 'Anil Kapoor',
      phone: '+919876543210',
      expectedPartySize: 4,
      inviteToken: generateInviteToken(),
    });

    await db.insert(householdFunctions).values({
      id: crypto.randomUUID(),
      householdId: hid1,
      functionId: functionAId,
    });

    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      householdId: hid1,
      functionId: functionAId,
      status: 'yes',
      partySize: 4,
      vegCount: 3,
      nonvegCount: 1,
      dietaryNotes: '=cmd|\' /C calc\'!A0', // Malicious formula input from guest
    });

    // Household 2: Confirmed with allergy starting with '+' and '@'
    const hid2 = crypto.randomUUID();
    householdIds.push(hid2);
    await db.insert(households).values({
      id: hid2,
      weddingId: weddingAId,
      name: 'Sharma Household',
      primaryContactName: 'Rajesh Sharma',
      phone: '+919876543211',
      expectedPartySize: 2,
      inviteToken: generateInviteToken(),
    });

    await db.insert(householdFunctions).values({
      id: crypto.randomUUID(),
      householdId: hid2,
      functionId: functionAId,
    });

    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      householdId: hid2,
      functionId: functionAId,
      status: 'yes',
      partySize: 2,
      vegCount: 2,
      nonvegCount: 0,
      dietaryNotes: '+severe peanut allergy, @table 4', // Formula trigger symbols
    });

    // Household 3: Maybe response
    const hid3 = crypto.randomUUID();
    householdIds.push(hid3);
    await db.insert(households).values({
      id: hid3,
      weddingId: weddingAId,
      name: 'Verma Family',
      primaryContactName: 'Sunita Verma',
      phone: '+919876543212',
      expectedPartySize: 3,
      inviteToken: generateInviteToken(),
    });

    await db.insert(householdFunctions).values({
      id: crypto.randomUUID(),
      householdId: hid3,
      functionId: functionAId,
    });

    await db.insert(rsvps).values({
      id: crypto.randomUUID(),
      householdId: hid3,
      functionId: functionAId,
      status: 'maybe',
      partySize: 2,
      vegCount: 0,
      nonvegCount: 0,
      dietaryNotes: '-tentative guest count',
    });
  });

  it('blocks unauthenticated access to GET /api/functions/:id/export-csv with 401', async () => {
    const res = await request(app).get(`/api/functions/${functionAId}/export-csv`);
    expect(res.status).toBe(401);
  });

  it('enforces multi-tenant isolation: Planner B cannot export Planner A function CSV (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/functions/${functionAId}/export-csv`)
      .set('Cookie', cookiePlannerB);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Function not found/i);
  });

  it('returns 404 for non-existent function ID', async () => {
    const nonExistent = crypto.randomUUID();
    const res = await request(app)
      .get(`/api/functions/${nonExistent}/export-csv`)
      .set('Cookie', cookiePlannerA);

    expect(res.status).toBe(404);
  });

  it('successfully streams/exports caterer CSV with proper headers and sanitized filename', async () => {
    const res = await request(app)
      .get(`/api/functions/${functionAId}/export-csv?maybePct=50`)
      .set('Cookie', cookiePlannerA);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="ananya_kabir_s_wedding_sangeet_cocktail_caterer_/);
    expect(res.headers['cache-control']).toMatch(/no-store/);

    const csv = res.text;

    // 1. Must contain UTF-8 BOM
    expect(csv.charCodeAt(0)).toBe(0xfeff);

    // 2. Header Metadata
    expect(csv).toContain("Wedding Title,Ananya & Kabir's Wedding");
    expect(csv).toContain('Couple Names,Ananya Sharma & Kabir Malhotra');
    expect(csv).toContain('Function Name,Sangeet & Cocktail');
    expect(csv).toContain('Venue,The Grand Ballroom');

    // 3. Catering Headcount Summary
    // Confirmed = 4 + 2 = 6 people
    expect(csv).toContain('Confirmed Headcount (People),6');
    // Veg = 3 + 2 = 5 meals
    expect(csv).toContain('Vegetarian Meals (Confirmed),5');
    // Non-Veg = 1 + 0 = 1 meal
    expect(csv).toContain('Non-Vegetarian Meals (Confirmed),1');
    // Maybe = 2 people
    expect(csv).toContain('Tentative (Maybe) Headcount,2');
    // Planning estimate with 50%: 6 + floor(0.50 * 2) = 7 guests
    expect(csv).toContain('Planning Estimate (50% Maybe Buffer),7');
    expect(csv).toContain('Total Invited Households,3');

    // 4. Formula Injection Neutralization Defense (CWE-1236)
    // Phone numbers starting with '+' must be neutralized with a leading single quote (')
    expect(csv).toContain("'+919876543210");
    expect(csv).toContain("'+919876543211");
    expect(csv).toContain("'+919876543212");

    // Malicious free-text dietary notes from guests starting with '=', '+', or '-' must be neutralized
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).toContain("'+severe peanut allergy, @table 4");
    expect(csv).toContain("'-tentative guest count");
  });

  it('updates planning estimate in CSV summary when maybePct query parameter is adjusted', async () => {
    // maybePct = 100%: 6 + floor(1.00 * 2) = 8 guests
    const res100 = await request(app)
      .get(`/api/functions/${functionAId}/export-csv?maybePct=100`)
      .set('Cookie', cookiePlannerA);

    expect(res100.status).toBe(200);
    expect(res100.text).toContain('Planning Estimate (100% Maybe Buffer),8');
  });
});
