import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { eq, and, inArray, asc, sql } from 'drizzle-orm';
import { db } from '../db';
import { functions, households, householdFunctions, rsvps, auditLog } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { getOwnedFunction } from '../middleware/tenant';
import { getFunctionHeadcount } from '../services/headcount';
import { generateCatererCsvData } from '../services/csvExport';
import {
  getFunctionCheckinOverview,
  recordCheckin,
  undoCheckin,
  updateCheckin,
} from '../services/checkin';

export const functionsRouter = Router();

// Require planner authentication for all function operations
functionsRouter.use(requireAuth);

const functionSchema = z.object({
  name: z.string().min(1, 'Function name is required').max(100),
  dateTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid date and time is required',
  }),
  venue: z.string().min(1, 'Venue is required').max(255),
});

/**
 * PUT /api/functions/:id - Update an existing wedding function
 */
functionsRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const functionId = req.params.id;

  const parseResult = functionSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid function input' });
    return;
  }

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    const { name, dateTime, venue } = parseResult.data;

    await db
      .update(functions)
      .set({
        name: name.trim(),
        dateTime: new Date(dateTime),
        venue: venue.trim(),
      })
      .where(eq(functions.id, functionId));

    const [updated] = await db.select().from(functions).where(eq(functions.id, functionId)).limit(1);
    res.json(updated);
  } catch (error) {
    console.error('[functions] Update error:', error);
    res.status(500).json({ error: 'Failed to update function' });
  }
});

/**
 * DELETE /api/functions/:id - Delete a function
 */
functionsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const functionId = req.params.id;

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    await db.delete(functions).where(eq(functions.id, functionId));
    res.json({ success: true, deletedId: functionId });
  } catch (error) {
    console.error('[functions] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete function' });
  }
});

const invitationAssignmentSchema = z
  .object({
    // Delta interface: preferred to prevent stale browser tab overwrites
    add: z.array(z.string()).max(500, 'Add list cannot exceed 500 households').optional(),
    remove: z.array(z.string()).max(500, 'Remove list cannot exceed 500 households').optional(),
    // Full-list replacement interface: supported for backwards compatibility
    householdIds: z.array(z.string()).max(500, 'Household list cannot exceed 500 households').optional(),
  })
  .refine(
    (data) => data.add !== undefined || data.remove !== undefined || data.householdIds !== undefined,
    { message: 'Must provide either "add"/"remove" lists or "householdIds"' }
  )
  .refine(
    (data) => {
      // Disallow mixing householdIds with add/remove
      if (data.householdIds !== undefined && (data.add !== undefined || data.remove !== undefined)) {
        return false;
      }
      return true;
    },
    { message: 'Cannot mix "householdIds" with "add" or "remove"' }
  )
  .refine(
    (data) => {
      // Disallow same ID in both add and remove
      if (data.add && data.remove) {
        const removeSet = new Set(data.remove);
        const hasOverlap = data.add.some((id) => removeSet.has(id));
        return !hasOverlap;
      }
      return true;
    },
    { message: 'The same household ID cannot be present in both add and remove' }
  );

/**
 * GET /api/functions/:id/invitations - List all households in wedding with invited status
 */
functionsRouter.get('/:id/invitations', async (req: Request, res: Response): Promise<void> => {
  const functionId = req.params.id;

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    // 1. Get all households belonging to the function's wedding
    const allHouseholds = await db
      .select({
        id: households.id,
        name: households.name,
        primaryContactName: households.primaryContactName,
        phone: households.phone,
        expectedPartySize: households.expectedPartySize,
        notes: households.notes,
      })
      .from(households)
      .where(eq(households.weddingId, owned.wedding.id))
      .orderBy(asc(households.name));

    // 2. Get assigned household IDs for this function
    const assignedRows = await db
      .select({ householdId: householdFunctions.householdId })
      .from(householdFunctions)
      .where(eq(householdFunctions.functionId, functionId));

    const assignedSet = new Set(assignedRows.map((r) => r.householdId));

    // 3. Get existing RSVPs for this function to display reply status
    const rsvpRows = await db
      .select({
        householdId: rsvps.householdId,
        status: rsvps.status,
        partySize: rsvps.partySize,
        respondedAt: rsvps.respondedAt,
      })
      .from(rsvps)
      .where(eq(rsvps.functionId, functionId));

    const rsvpMap = new Map(rsvpRows.map((r) => [r.householdId, r]));

    const rawStaleDays = req.query.staleDays !== undefined ? Number(req.query.staleDays) : 14;
    const staleDays = isNaN(rawStaleDays) || rawStaleDays < 1 ? 14 : Math.round(rawStaleDays);
    const nowMs = Date.now();
    const staleCutoffMs = nowMs - staleDays * 24 * 60 * 60 * 1000;

    // 4. Map to result array with invited flag, reply status, and stale metrics
    const result = allHouseholds.map((h) => {
      const rsvp = rsvpMap.get(h.id);
      const isReplied = Boolean(rsvp && (rsvp.status === 'yes' || rsvp.status === 'maybe'));
      const isStale = Boolean(
        isReplied && rsvp?.respondedAt && new Date(rsvp.respondedAt).getTime() < staleCutoffMs
      );
      const daysAgo = rsvp?.respondedAt
        ? Math.max(0, Math.floor((nowMs - new Date(rsvp.respondedAt).getTime()) / (24 * 60 * 60 * 1000)))
        : null;

      return {
        ...h,
        invited: assignedSet.has(h.id),
        rsvpStatus: rsvp ? rsvp.status : null,
        rsvpPartySize: rsvp ? rsvp.partySize : null,
        rsvpRespondedAt: rsvp?.respondedAt || null,
        isStale,
        daysAgo,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[functions] Get invitations error:', error);
    res.status(500).json({ error: 'Failed to retrieve function invitations' });
  }
});

/**
 * POST /api/functions/:id/invitations - Bulk assign/unassign households to a function
 *
 * Invariants & Protections:
 * 1. Bulk-endpoint IDOR: Every household ID in add/remove/householdIds must belong to the function's wedding.
 * 2. Capped at 500 households per batch operation.
 * 3. Atomic Database Transaction: Wrapped in db.transaction to prevent partial failures and race conditions.
 * 4. Mutual exclusivity: Cannot mix 'householdIds' with delta 'add'/'remove', and cannot send the same ID in both.
 * 5. RSVP Protection: Cannot unassign a household that has an active RSVP ('yes' or 'maybe') protecting headcount.
 *    Households that replied 'no' can be unassigned, cleanly deleting their decline response.
 */
functionsRouter.post('/:id/invitations', async (req: Request, res: Response): Promise<void> => {
  const functionId = req.params.id;

  const parseResult = invitationAssignmentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid assignment input' });
    return;
  }

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    const { add, remove, householdIds } = parseResult.data;

    // Fetch existing assignments
    const currentAssigned = await db
      .select({ householdId: householdFunctions.householdId })
      .from(householdFunctions)
      .where(eq(householdFunctions.functionId, functionId));

    const currentSet = new Set(currentAssigned.map((r) => r.householdId));

    let toAssign: string[] = [];
    let toUnassign: string[] = [];
    let allReferencedIds: string[] = [];

    if (add !== undefined || remove !== undefined) {
      // Delta mode: add / remove
      const rawAdd = add || [];
      const rawRemove = remove || [];
      const uniqueAdd = Array.from(new Set(rawAdd));
      const uniqueRemove = Array.from(new Set(rawRemove));

      toAssign = uniqueAdd.filter((id) => !currentSet.has(id));
      toUnassign = uniqueRemove.filter((id) => currentSet.has(id));
      allReferencedIds = Array.from(new Set([...uniqueAdd, ...uniqueRemove]));
    } else if (householdIds !== undefined) {
      // Full replacement mode
      const targetIds = Array.from(new Set(householdIds));
      const targetSet = new Set(targetIds);

      toAssign = targetIds.filter((id) => !currentSet.has(id));
      toUnassign = currentAssigned
        .filter((r) => !targetSet.has(r.householdId))
        .map((r) => r.householdId);
      allReferencedIds = targetIds;
    }

    // Bulk-endpoint IDOR defense:
    // Verify that every single referenced household belongs to this wedding
    if (allReferencedIds.length > 0) {
      const matchingHouseholds = await db
        .select({ id: households.id })
        .from(households)
        .where(and(eq(households.weddingId, owned.wedding.id), inArray(households.id, allReferencedIds)));

      if (matchingHouseholds.length !== allReferencedIds.length) {
        res.status(400).json({ error: 'One or more households do not belong to this wedding' });
        return;
      }
    }

    // Atomic Database Transaction: all-or-nothing with race condition prevention
    try {
      await db.transaction(async (tx) => {
        if (toUnassign.length > 0) {
          // Explicit row-level lock on assignments to prevent concurrency races
          await tx
            .select()
            .from(householdFunctions)
            .where(
              and(
                eq(householdFunctions.functionId, functionId),
                inArray(householdFunctions.householdId, toUnassign)
              )
            )
            .for('update');

          // Check for existing active RSVPs with row-level lock to prevent races
          const repliedRsvps = await tx
            .select({ householdId: rsvps.householdId, status: rsvps.status })
            .from(rsvps)
            .where(
              and(
                eq(rsvps.functionId, functionId),
                inArray(rsvps.householdId, toUnassign)
              )
            )
            .for('update');

          const activeReplied = repliedRsvps.filter(
            (r) => r.status === 'yes' || r.status === 'maybe'
          );

          if (activeReplied.length > 0) {
            throw new Error(
              "Cannot unassign household that has already submitted an active RSVP ('yes' or 'maybe'). Reset RSVP first."
            );
          }

          // For households that replied 'no', record audit log and remove their decline RSVP record
          const declinedHouseholds = repliedRsvps
            .filter((r) => r.status === 'no')
            .map((r) => r.householdId);

          if (declinedHouseholds.length > 0) {
            for (const declinedId of declinedHouseholds) {
              await tx.insert(auditLog).values({
                id: crypto.randomUUID(),
                weddingId: owned.wedding.id,
                actorType: 'planner',
                actorId: req.user!.id,
                action: 'uninvite_declined_household',
                entityType: 'rsvp',
                entityId: declinedId,
                oldValues: { functionId, status: 'no' },
                newValues: null,
              });
            }

            await tx
              .delete(rsvps)
              .where(
                and(
                  eq(rsvps.functionId, functionId),
                  inArray(rsvps.householdId, declinedHouseholds)
                )
              );
          }

          await tx
            .delete(householdFunctions)
            .where(
              and(
                eq(householdFunctions.functionId, functionId),
                inArray(householdFunctions.householdId, toUnassign)
              )
            );
        }

        if (toAssign.length > 0) {
          const newRows = toAssign.map((householdId) => ({
            id: crypto.randomUUID(),
            householdId,
            functionId,
          }));
          await tx.insert(householdFunctions).values(newRows);
        }
      });
    } catch (txError: unknown) {
      const msg = txError instanceof Error ? txError.message : String(txError);
      if (msg.includes('Cannot unassign household that has already submitted an active RSVP')) {
        res.status(400).json({ error: msg });
        return;
      }
      throw txError;
    }

    // Query accurate total invited count
    const totalInvited = await db
      .select({ count: sql<number>`count(*)` })
      .from(householdFunctions)
      .where(eq(householdFunctions.functionId, functionId));
    const invitedCount = Number(totalInvited[0]?.count || 0);

    res.json({
      success: true,
      addedCount: toAssign.length,
      removedCount: toUnassign.length,
      invitedCount,
    });
  } catch (error) {
    console.error('[functions] Update invitations error:', error);
    res.status(500).json({ error: 'Failed to update function invitations' });
  }
});

/**
 * POST /api/functions/:id/rsvps/:householdId/reset - Reset an RSVP response for a household
 */
functionsRouter.post('/:id/rsvps/:householdId/reset', async (req: Request, res: Response): Promise<void> => {
  const { id: functionId, householdId } = req.params;

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    // Verify household belongs to this wedding (IDOR defense)
    const [household] = await db
      .select({ id: households.id })
      .from(households)
      .where(and(eq(households.id, householdId), eq(households.weddingId, owned.wedding.id)))
      .limit(1);

    if (!household) {
      res.status(404).json({ error: 'Household not found' });
      return;
    }

    // Fetch existing RSVP to record in audit log before erasing
    const [existingRsvp] = await db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.functionId, functionId), eq(rsvps.householdId, householdId)))
      .limit(1);

    if (existingRsvp) {
      await db.transaction(async (tx) => {
        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          weddingId: owned.wedding.id,
          actorType: 'planner',
          actorId: req.user!.id,
          action: 'reset_rsvp',
          entityType: 'rsvp',
          entityId: existingRsvp.id,
          oldValues: {
            status: existingRsvp.status,
            partySize: existingRsvp.partySize,
            vegCount: existingRsvp.vegCount,
            nonvegCount: existingRsvp.nonvegCount,
          },
          newValues: null,
        });

        await tx
          .delete(rsvps)
          .where(and(eq(rsvps.functionId, functionId), eq(rsvps.householdId, householdId)));
      });
    }

    res.json({ success: true, message: 'RSVP reset successfully' });
  } catch (error) {
    console.error('[functions] Reset RSVP error:', error);
    res.status(500).json({ error: 'Failed to reset RSVP' });
  }
});

/**
 * GET /api/functions/:id/headcount - Headcount metrics & planning estimate
 */
functionsRouter.get('/:id/headcount', async (req: Request, res: Response): Promise<void> => {
  const functionId = req.params.id;

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    const maybePct = req.query.maybePct !== undefined ? Number(req.query.maybePct) : undefined;
    const staleDays = req.query.staleDays !== undefined ? Number(req.query.staleDays) : undefined;

    const result = await getFunctionHeadcount(functionId, { maybePct, staleDays });

    res.json({
      ...result,
      functionName: owned.function.name,
      weddingId: owned.wedding.id,
    });
  } catch (error) {
    console.error('[functions] Get headcount error:', error);
    res.status(500).json({ error: 'Failed to calculate headcount metrics' });
  }
});

/**
 * GET /api/functions/:id/export-csv - Download sanitized caterer CSV with headcount and dietary breakdown
 * Enforces CWE-1236 formula injection neutralization (=, +, -, @)
 */
functionsRouter.get('/:id/export-csv', async (req: Request, res: Response): Promise<void> => {
  const functionId = req.params.id;

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    const maybePct = req.query.maybePct !== undefined ? Number(req.query.maybePct) : undefined;
    const { filename, csvContent } = await generateCatererCsvData(functionId, { maybePct });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    res.send(csvContent);
  } catch (error) {
    console.error('[functions] Export CSV error:', error);
    res.status(500).json({ error: 'Failed to generate caterer CSV export' });
  }
});

const recordCheckinSchema = z.object({
  householdId: z.string().uuid().optional().nullable(),
  guestName: z.string().max(150).optional(),
  actualPartySize: z.number().int().min(1, 'Actual party size must be at least 1').max(50, 'Party size exceeds limit'),
  isWalkin: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
}).refine((data) => data.householdId || (data.guestName && data.guestName.trim().length > 0), {
  message: 'Guest name is required for walk-in arrivals',
  path: ['guestName'],
});

const updateCheckinSchema = z.object({
  actualPartySize: z.number().int().min(1).max(50).optional(),
  guestName: z.string().min(1).max(150).optional(),
  notes: z.string().max(500).optional().nullable(),
});

/**
 * GET /api/functions/:id/checkins - Venue check-in dashboard & guest arrival status
 */
functionsRouter.get('/:id/checkins', async (req: Request, res: Response): Promise<void> => {
  const functionId = req.params.id;

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    const overview = await getFunctionCheckinOverview(functionId);

    res.json({
      ...overview,
      functionName: owned.function.name,
      functionVenue: owned.function.venue,
      weddingId: owned.wedding.id,
      weddingTitle: owned.wedding.title,
    });
  } catch (error) {
    console.error('[functions] Get checkins error:', error);
    res.status(500).json({ error: 'Failed to retrieve check-in overview' });
  }
});

/**
 * POST /api/functions/:id/checkins - Record guest arrival (invited household or walk-in)
 */
functionsRouter.post('/:id/checkins', async (req: Request, res: Response): Promise<void> => {
  const functionId = req.params.id;

  const parseResult = recordCheckinSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid check-in data' });
    return;
  }

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

    const result = await recordCheckin({
      weddingId: owned.wedding.id,
      functionId,
      householdId: parseResult.data.householdId || null,
      guestName: parseResult.data.guestName,
      actualPartySize: parseResult.data.actualPartySize,
      isWalkin: parseResult.data.isWalkin,
      notes: parseResult.data.notes || null,
      ipAddress: clientIp,
      plannerId: req.user!.id,
    });

    res.status(result.isNew ? 201 : 200).json(result);
  } catch (error: any) {
    console.error('[functions] Record check-in error:', error);
    const message = error?.message || 'Failed to record check-in';
    const isClientError =
      message.includes('not invited') ||
      message.includes('not belong') ||
      message.includes('required');
    res.status(isClientError ? 400 : 500).json({ error: message });
  }
});

/**
 * DELETE /api/functions/:id/checkins/:checkinId - Undo guest check-in
 */
functionsRouter.delete('/:id/checkins/:checkinId', async (req: Request, res: Response): Promise<void> => {
  const { id: functionId, checkinId } = req.params;

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

    const success = await undoCheckin({
      functionId,
      checkinId,
      weddingId: owned.wedding.id,
      plannerId: req.user!.id,
      ipAddress: clientIp,
    });

    if (!success) {
      res.status(404).json({ error: 'Check-in record not found' });
      return;
    }

    res.json({ success: true, message: 'Check-in undone successfully' });
  } catch (error) {
    console.error('[functions] Undo check-in error:', error);
    res.status(500).json({ error: 'Failed to undo check-in' });
  }
});

/**
 * PATCH /api/functions/:id/checkins/:checkinId - Update check-in record
 */
functionsRouter.patch('/:id/checkins/:checkinId', async (req: Request, res: Response): Promise<void> => {
  const { id: functionId, checkinId } = req.params;

  const parseResult = updateCheckinSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid update data' });
    return;
  }

  try {
    const owned = await getOwnedFunction(functionId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Function not found' });
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

    const updated = await updateCheckin({
      functionId,
      checkinId,
      weddingId: owned.wedding.id,
      plannerId: req.user!.id,
      actualPartySize: parseResult.data.actualPartySize,
      guestName: parseResult.data.guestName,
      notes: parseResult.data.notes,
      ipAddress: clientIp,
    });

    if (!updated) {
      res.status(404).json({ error: 'Check-in record not found' });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error('[functions] Update check-in error:', error);
    res.status(500).json({ error: 'Failed to update check-in' });
  }
});



