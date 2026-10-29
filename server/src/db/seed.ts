import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, pool } from './index';
import { planners, weddings, functions, households, householdFunctions, rsvps } from './schema';
import { hashPassword, generateInviteToken } from '../utils/auth';

async function seed() {
  console.log('[seed] Seeding database with demo data...');

  // Ensure idempotent re-seeding: clean up existing demo planner if present
  const [existingPlanner] = await db
    .select({ id: planners.id })
    .from(planners)
    .where(eq(planners.email, 'planner@demo.com'))
    .limit(1);

  if (existingPlanner) {
    await db.delete(planners).where(eq(planners.id, existingPlanner.id));
    console.log('[seed] Cleaned up previous demo planner data');
  }

  const plannerId = crypto.randomUUID();
  const passwordHash = await hashPassword('password123');

  // 1. Create Demo Planner
  await db.insert(planners).values({
    id: plannerId,
    email: 'planner@demo.com',
    passwordHash,
    name: 'Pooja Verma',
  });
  console.log('[seed] Created planner: planner@demo.com (password: password123)');

  // 2. Create Sample Wedding
  const weddingId = crypto.randomUUID();
  await db.insert(weddings).values({
    id: weddingId,
    plannerId,
    title: "Ananya & Kabir's Wedding",
    coupleNames: 'Ananya Sharma & Kabir Malhotra',
    startDate: new Date('2026-12-10'),
    endDate: new Date('2026-12-12'),
  });
  console.log("[seed] Created wedding: Ananya & Kabir's Wedding");

  // 3. Create Wedding Functions
  const fnsData = [
    { name: 'Mehendi & High Tea', dateTime: new Date('2026-12-10T15:00:00Z'), venue: 'Poolside Terrace' },
    { name: 'Sangeet & Cocktail', dateTime: new Date('2026-12-10T19:30:00Z'), venue: 'The Grand Ballroom' },
    { name: 'Haldi Ceremony', dateTime: new Date('2026-12-11T10:00:00Z'), venue: 'Courtyard Lawns' },
    { name: 'Wedding Ceremony (Pheras)', dateTime: new Date('2026-12-11T18:00:00Z'), venue: 'Mandap by the Lake' },
    { name: 'Grand Reception Dinner', dateTime: new Date('2026-12-12T19:30:00Z'), venue: 'Royal Palace Banquet' },
  ];

  const createdFunctionIds: string[] = [];
  for (const fn of fnsData) {
    const fid = crypto.randomUUID();
    createdFunctionIds.push(fid);
    await db.insert(functions).values({
      id: fid,
      weddingId,
      name: fn.name,
      dateTime: fn.dateTime,
      venue: fn.venue,
    });
  }
  console.log(`[seed] Created ${fnsData.length} wedding functions`);

  const sangeetFunctionId = createdFunctionIds[1]; // Sangeet & Cocktail

  // 4. Create 10 Guest Households matching hand-checked numbers
  // 4 Confirmed (sizes 4, 3, 2, 5 -> 14 headcount, 8 veg, 6 nonveg)
  // 2 Maybe (sizes 2, 2 -> 4 headcount)
  // 1 Declined (size 3)
  // 3 Pending (sizes 2, 1, 3 -> 6 headcount)
  const hhsData = [
    { name: 'Kapoor Family', contact: 'Anil Kapoor', phone: '+919876543210', size: 4, notes: 'VIP family friends' },
    { name: 'Sharma Household', contact: 'Rajesh Sharma', phone: '+919876543211', size: 3, notes: 'Bride side elder uncle' },
    { name: 'Malhotra Family', contact: 'Vikram Malhotra', phone: '+919876543212', size: 2, notes: 'Groom side' },
    { name: 'Verma Family', contact: 'Sunita Verma', phone: '+919876543213', size: 5, notes: 'Requires ground floor room' },
    { name: 'Bhatia Household', contact: 'Rohan Bhatia', phone: '+919876543214', size: 2, notes: 'College friends' },
    { name: 'Deshmukh Family', contact: 'Priya Deshmukh', phone: '+919876543215', size: 2, notes: 'Travelling from Pune' },
    { name: 'Chopra Household', contact: 'Arun Chopra', phone: '+919876543216', size: 3, notes: 'School friends' },
    { name: 'Mehta Family', contact: 'Sanjay Mehta', phone: '+919876543217', size: 2, notes: 'Neighbours' },
    { name: 'Joshi Household', contact: 'Kavita Joshi', phone: '+919876543218', size: 1, notes: 'Solo attendee' },
    { name: 'Singhania Family', contact: 'Vijay Singhania', phone: '+919876543219', size: 3, notes: 'Extended family' },
  ];

  const createdHouseholdIds: string[] = [];
  const createdTokens: string[] = [];

  for (const hh of hhsData) {
    const hid = crypto.randomUUID();
    const token = generateInviteToken();
    createdHouseholdIds.push(hid);
    createdTokens.push(token);

    await db.insert(households).values({
      id: hid,
      weddingId,
      name: hh.name,
      primaryContactName: hh.contact,
      phone: hh.phone,
      expectedPartySize: hh.size,
      inviteToken: token,
      notes: hh.notes,
    });

    // Assign all 10 households to Sangeet
    await db.insert(householdFunctions).values({
      id: crypto.randomUUID(),
      householdId: hid,
      functionId: sangeetFunctionId,
    });
  }
  console.log(`[seed] Created 10 guest households and assigned all to Sangeet & Cocktail`);

  // 5. Seed RSVP responses on Sangeet & Cocktail:
  // HH 1 (size 4): yes (veg 3, nonveg 1)
  await db.insert(rsvps).values({
    id: crypto.randomUUID(),
    householdId: createdHouseholdIds[0],
    functionId: sangeetFunctionId,
    status: 'yes',
    partySize: 4,
    vegCount: 3,
    nonvegCount: 1,
    respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  });

  // HH 2 (size 3): yes (veg 2, nonveg 1)
  await db.insert(rsvps).values({
    id: crypto.randomUUID(),
    householdId: createdHouseholdIds[1],
    functionId: sangeetFunctionId,
    status: 'yes',
    partySize: 3,
    vegCount: 2,
    nonvegCount: 1,
    respondedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  });

  // HH 3 (size 2): yes (veg 2, nonveg 0) - stale (> 14 days ago)
  await db.insert(rsvps).values({
    id: crypto.randomUUID(),
    householdId: createdHouseholdIds[2],
    functionId: sangeetFunctionId,
    status: 'yes',
    partySize: 2,
    vegCount: 2,
    nonvegCount: 0,
    respondedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
  });

  // HH 4 (size 5): yes (veg 1, nonveg 4)
  await db.insert(rsvps).values({
    id: crypto.randomUUID(),
    householdId: createdHouseholdIds[3],
    functionId: sangeetFunctionId,
    status: 'yes',
    partySize: 5,
    vegCount: 1,
    nonvegCount: 4,
    respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  });

  // HH 5 (size 2): maybe (2 people)
  await db.insert(rsvps).values({
    id: crypto.randomUUID(),
    householdId: createdHouseholdIds[4],
    functionId: sangeetFunctionId,
    status: 'maybe',
    partySize: 2,
    vegCount: 0,
    nonvegCount: 0,
    respondedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  });

  // HH 6 (size 2): maybe (2 people)
  await db.insert(rsvps).values({
    id: crypto.randomUUID(),
    householdId: createdHouseholdIds[5],
    functionId: sangeetFunctionId,
    status: 'maybe',
    partySize: 2,
    vegCount: 0,
    nonvegCount: 0,
    respondedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  });

  // HH 7 (size 3): no (0 people)
  await db.insert(rsvps).values({
    id: crypto.randomUUID(),
    householdId: createdHouseholdIds[6],
    functionId: sangeetFunctionId,
    status: 'no',
    partySize: 0,
    vegCount: 0,
    nonvegCount: 0,
    respondedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  });

  // HH 8, 9, 10 remain Pending / No Response

  console.log('[seed] Hand-checked headcount seeded for Sangeet:');
  console.log('       Confirmed: 14 guests (8 Veg, 6 Non-Veg) across 4 households');
  console.log('       Maybe:      4 guests across 2 households');
  console.log('       Declined:   3 guests across 1 household');
  console.log('       Pending:    6 guests across 3 households');
  console.log('       Planning Estimate (50%): 14 + floor(0.5 * 4) = 16 guests');
  console.log('       Active demo Kapoor Family token:', createdTokens[0]);
  console.log('[seed] Done! You can now log in with planner@demo.com / password123');
  await pool.end();
}

seed().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
