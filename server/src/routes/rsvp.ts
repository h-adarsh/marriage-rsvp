import { Router, Request, Response } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db';
import { households, weddings, functions, householdFunctions, rsvps } from '../db/schema';
import { rsvpGeneralLimiter, rsvpInvalidTokenLimiter } from '../middleware/rateLimit';
import { antiLeakHeaders } from '../middleware/securityHeaders';

export const rsvpRouter = Router();

// Apply security headers and dual-key rate limiters
rsvpRouter.use(antiLeakHeaders);
rsvpRouter.use(rsvpGeneralLimiter);
rsvpRouter.use(rsvpInvalidTokenLimiter);

/**
 * Token format validator: 32 hexadecimal characters (128-bit unguessable random token)
 */
const TOKEN_REGEX = /^[a-f0-9]{32}$/i;

/**
 * GET /api/rsvp/:token - Public token lookup & verification service
 * Returns household details, wedding details, and invited functions for the guest.
 * Zero PII exposed (no phone, no internal notes, no database IDs).
 * Returns uniform 404 for invalid, malformed, or unknown tokens.
 */
rsvpRouter.get('/:token', async (req: Request, res: Response): Promise<void> => {
  const token = req.params.token;

  // Strict format check: 32 hex chars. Malformed tokens return uniform 404
  if (!token || !TOKEN_REGEX.test(token)) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }

  try {
    // 1. Look up household by unguessable inviteToken
    const [household] = await db
      .select({
        id: households.id,
        weddingId: households.weddingId,
        name: households.name,
        expectedPartySize: households.expectedPartySize,
      })
      .from(households)
      .where(eq(households.inviteToken, token))
      .limit(1);

    if (!household) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    // 2. Look up wedding details (title, couple names)
    const [wedding] = await db
      .select({
        title: weddings.title,
        coupleNames: weddings.coupleNames,
      })
      .from(weddings)
      .where(eq(weddings.id, household.weddingId))
      .limit(1);

    if (!wedding) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    // 3. Look up functions that this specific household was explicitly invited to
    const invitedFunctions = await db
      .select({
        id: functions.id,
        name: functions.name,
        dateTime: functions.dateTime,
        venue: functions.venue,
      })
      .from(householdFunctions)
      .innerJoin(functions, eq(householdFunctions.functionId, functions.id))
      .where(eq(householdFunctions.householdId, household.id))
      .orderBy(asc(functions.dateTime));

    // 4. Look up existing RSVPs for this household
    const existingRsvps = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.householdId, household.id));

    const rsvpMap = new Map(existingRsvps.map((r) => [r.functionId, r]));

    // 5. Build minimal response payload with zero PII
    const functionsList = invitedFunctions.map((f) => {
      const rsvp = rsvpMap.get(f.id);
      return {
        id: f.id,
        name: f.name,
        dateTime: f.dateTime instanceof Date ? f.dateTime.toISOString() : new Date(f.dateTime).toISOString(),
        venue: f.venue,
        rsvpStatus: rsvp ? rsvp.status : 'no_response',
        partySize: rsvp ? rsvp.partySize : 0,
        vegCount: rsvp ? rsvp.vegCount : 0,
        nonvegCount: rsvp ? rsvp.nonvegCount : 0,
        dietaryNotes: rsvp?.dietaryNotes || null,
        respondedAt: rsvp?.respondedAt ? (rsvp.respondedAt instanceof Date ? rsvp.respondedAt.toISOString() : new Date(rsvp.respondedAt).toISOString()) : null,
      };
    });

    res.json({
      household: {
        name: household.name,
        expectedPartySize: household.expectedPartySize,
      },
      wedding: {
        title: wedding.title,
        coupleNames: wedding.coupleNames,
      },
      functions: functionsList,
    });
  } catch (error) {
    console.error('[rsvp] Token lookup error:', error);
    res.status(500).json({ error: 'Failed to look up invitation' });
  }
});
