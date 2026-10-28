import crypto from 'crypto';
import { db, pool } from './index';
import { planners, weddings, functions, households } from './schema';
import { hashPassword, generateInviteToken } from '../utils/auth';

async function seed() {
  console.log('[seed] Seeding database with demo data...');

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
  const fns = [
    { name: 'Mehendi & High Tea', dateTime: new Date('2026-12-10T15:00:00Z'), venue: 'Poolside Terrace' },
    { name: 'Sangeet & Cocktail', dateTime: new Date('2026-12-10T19:30:00Z'), venue: 'The Grand Ballroom' },
    { name: 'Haldi Ceremony', dateTime: new Date('2026-12-11T10:00:00Z'), venue: 'Courtyard Lawns' },
    { name: 'Wedding Ceremony (Pheras)', dateTime: new Date('2026-12-11T18:00:00Z'), venue: 'Mandap by the Lake' },
    { name: 'Grand Reception Dinner', dateTime: new Date('2026-12-12T19:30:00Z'), venue: 'Royal Palace Banquet' },
  ];

  for (const fn of fns) {
    await db.insert(functions).values({
      id: crypto.randomUUID(),
      weddingId,
      name: fn.name,
      dateTime: fn.dateTime,
      venue: fn.venue,
    });
  }
  console.log(`[seed] Created ${fns.length} wedding functions`);

  // 4. Create Sample Guest Households
  const hhs = [
    { name: 'Kapoor Family', contact: 'Anil Kapoor', phone: '+919876543210', size: 4, notes: 'VIP family friends' },
    { name: 'Sharma Household', contact: 'Rajesh Sharma', phone: '+919876543211', size: 3, notes: 'Bride side elder uncle' },
    { name: 'Malhotra Family', contact: 'Vikram Malhotra', phone: '+919876543212', size: 2, notes: 'Groom side' },
    { name: 'Verma Family', contact: 'Sunita Verma', phone: '+919876543213', size: 5, notes: 'Requires ground floor room' },
    { name: 'Bhatia Household', contact: 'Rohan Bhatia', phone: '+919876543214', size: 2, notes: 'College friends' },
  ];

  for (const hh of hhs) {
    await db.insert(households).values({
      id: crypto.randomUUID(),
      weddingId,
      name: hh.name,
      primaryContactName: hh.contact,
      phone: hh.phone,
      expectedPartySize: hh.size,
      inviteToken: generateInviteToken(),
      notes: hh.notes,
    });
  }
  console.log(`[seed] Created ${hhs.length} guest households with invite tokens`);

  console.log('[seed] Done! You can now log in with planner@demo.com / password123');
  await pool.end();
}

seed().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
