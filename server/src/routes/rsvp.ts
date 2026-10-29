import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { eq, asc, and } from 'drizzle-orm';
import { db } from '../db';
import { households, weddings, functions, householdFunctions, rsvps, auditLog } from '../db/schema';
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

/**
 * Validation schema for a single function RSVP response
 */
export const rsvpItemSchema = z
  .object({
    functionId: z.string().uuid('Invalid function ID'),
    status: z.enum(['yes', 'no', 'maybe']),
    partySize: z.number().int().min(0, 'Party size cannot be negative').max(50, 'Party size cannot exceed 50').default(0),
    vegCount: z.number().int().min(0, 'Veg count cannot be negative').max(50, 'Veg count cannot exceed 50').default(0),
    nonvegCount: z.number().int().min(0, 'Non-veg count cannot be negative').max(50, 'Non-veg count cannot exceed 50').default(0),
    dietaryNotes: z.string().max(500, 'Dietary notes cannot exceed 500 characters').optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.status === 'yes') {
        return data.partySize >= 1 && data.vegCount + data.nonvegCount === data.partySize;
      }
      if (data.status === 'no') {
        return true;
      }
      if (data.status === 'maybe') {
        if (data.partySize > 0) {
          return data.vegCount + data.nonvegCount === data.partySize;
        }
        return true;
      }
      return true;
    },
    {
      message: 'For confirmed attendance ("yes"), party size must be at least 1 and Veg + Non-Veg count must equal party size.',
    }
  );

export const submitRsvpBodySchema = z.union([
  z.object({
    responses: z.array(rsvpItemSchema).min(1, 'At least one RSVP response is required'),
  }),
  z.array(rsvpItemSchema).min(1, 'At least one RSVP response is required'),
  rsvpItemSchema,
]);

/**
 * POST /api/rsvp/:token - Public RSVP submission API
 * Atomically records or updates guest RSVP responses with SELECT ... FOR UPDATE row-level locks
 * Enforces veg + nonveg == party_size and verifies the household was invited to each event.
 */
rsvpRouter.post('/:token', async (req: Request, res: Response): Promise<void> => {
  const token = req.params.token;

  // Strict format check: 32 hex chars. Malformed tokens return uniform 404
  if (!token || !TOKEN_REGEX.test(token)) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }

  const parseResult = submitRsvpBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid RSVP input' });
    return;
  }

  // Normalize input into an array of items
  let items: z.infer<typeof rsvpItemSchema>[];
  if ('responses' in parseResult.data) {
    items = parseResult.data.responses;
  } else if (Array.isArray(parseResult.data)) {
    items = parseResult.data;
  } else {
    items = [parseResult.data];
  }

  // Reject duplicate function IDs within the same request
  const seenFunctionIds = new Set<string>();
  for (const item of items) {
    if (seenFunctionIds.has(item.functionId)) {
      res.status(400).json({ error: 'Duplicate function responses are not allowed in the same submission' });
      return;
    }
    seenFunctionIds.add(item.functionId);
  }

  try {
    // 1. Look up household by unguessable inviteToken
    const [household] = await db
      .select({
        id: households.id,
        weddingId: households.weddingId,
      })
      .from(households)
      .where(eq(households.inviteToken, token))
      .limit(1);

    if (!household) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    // 2. Process all RSVP items inside a transaction with explicit row-level locks
    await db.transaction(async (tx) => {
      for (const item of items) {
        // Explicit row lock on household_functions: ensures household is invited and blocks concurrent unassignment
        const [invitation] = await tx
          .select()
          .from(householdFunctions)
          .where(
            and(
              eq(householdFunctions.householdId, household.id),
              eq(householdFunctions.functionId, item.functionId)
            )
          )
          .for('update')
          .limit(1);

        if (!invitation) {
          throw new Error(`Household is not invited to function ${item.functionId}`);
        }

        // Explicit row lock on rsvps: serializes concurrent RSVP submissions
        const [existingRsvp] = await tx
          .select()
          .from(rsvps)
          .where(
            and(
              eq(rsvps.householdId, household.id),
              eq(rsvps.functionId, item.functionId)
            )
          )
          .for('update')
          .limit(1);

        const normalizedPartySize = item.status === 'no' ? 0 : item.partySize;
        const normalizedVeg = item.status === 'no' ? 0 : item.vegCount;
        const normalizedNonveg = item.status === 'no' ? 0 : item.nonvegCount;
        const dietaryNotes = item.dietaryNotes ? item.dietaryNotes.trim() : null;

        if (existingRsvp) {
          // Update existing RSVP response
          await tx
            .update(rsvps)
            .set({
              status: item.status,
              partySize: normalizedPartySize,
              vegCount: normalizedVeg,
              nonvegCount: normalizedNonveg,
              dietaryNotes,
              respondedAt: new Date(),
            })
            .where(eq(rsvps.id, existingRsvp.id));

          await tx.insert(auditLog).values({
            id: crypto.randomUUID(),
            weddingId: household.weddingId,
            actorType: 'guest',
            actorId: household.id,
            action: 'update_rsvp',
            entityType: 'rsvp',
            entityId: existingRsvp.id,
            oldValues: {
              status: existingRsvp.status,
              partySize: existingRsvp.partySize,
              vegCount: existingRsvp.vegCount,
              nonvegCount: existingRsvp.nonvegCount,
            },
            newValues: {
              status: item.status,
              partySize: normalizedPartySize,
              vegCount: normalizedVeg,
              nonvegCount: normalizedNonveg,
            },
            ipAddress: null,
          });
        } else {
          // Create new RSVP response
          const newRsvpId = crypto.randomUUID();
          await tx.insert(rsvps).values({
            id: newRsvpId,
            functionId: item.functionId,
            householdId: household.id,
            status: item.status,
            partySize: normalizedPartySize,
            vegCount: normalizedVeg,
            nonvegCount: normalizedNonveg,
            dietaryNotes,
          });

          await tx.insert(auditLog).values({
            id: crypto.randomUUID(),
            weddingId: household.weddingId,
            actorType: 'guest',
            actorId: household.id,
            action: 'submit_rsvp',
            entityType: 'rsvp',
            entityId: newRsvpId,
            oldValues: null,
            newValues: {
              status: item.status,
              partySize: normalizedPartySize,
              vegCount: normalizedVeg,
              nonvegCount: normalizedNonveg,
            },
            ipAddress: null,
          });
        }
      }
    });

    res.json({
      success: true,
      message: 'RSVP submitted successfully',
      submittedCount: items.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Household is not invited to function')) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('[rsvp] Submit RSVP error:', err);
    res.status(500).json({ error: 'Failed to submit RSVP' });
  }
});

