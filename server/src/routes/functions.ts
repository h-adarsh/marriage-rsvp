import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { db } from '../db';
import { functions, households, householdFunctions, rsvps } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { getOwnedFunction } from '../middleware/tenant';

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

const invitationAssignmentSchema = z.object({
  householdIds: z.array(z.string()).max(500, 'Household list cannot exceed 500 households'),
});

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

    // 3. Map to result array with invited flag
    const result = allHouseholds.map((h) => ({
      ...h,
      invited: assignedSet.has(h.id),
    }));

    res.json(result);
  } catch (error) {
    console.error('[functions] Get invitations error:', error);
    res.status(500).json({ error: 'Failed to retrieve function invitations' });
  }
});

/**
 * POST /api/functions/:id/invitations - Bulk assign/unassign households to a function
 *
 * Invariants:
 * 1. Bulk-endpoint IDOR: Every household ID must belong to the function's wedding.
 * 2. Capped at 500 households per batch.
 * 3. Duplicate IDs in the input array are handled idempotently.
 * 4. RSVP Protection: Cannot unassign a household that has already submitted an RSVP.
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

    // Deduplicate input household IDs
    const targetIds = Array.from(new Set(parseResult.data.householdIds));

    // Bulk-endpoint IDOR defense:
    // Verify that all requested households belong to the function's parent wedding
    if (targetIds.length > 0) {
      const matchingHouseholds = await db
        .select({ id: households.id })
        .from(households)
        .where(and(eq(households.weddingId, owned.wedding.id), inArray(households.id, targetIds)));

      if (matchingHouseholds.length !== targetIds.length) {
        res.status(400).json({ error: 'One or more households do not belong to this wedding' });
        return;
      }
    }

    // Query current assignments
    const currentAssigned = await db
      .select({ householdId: householdFunctions.householdId })
      .from(householdFunctions)
      .where(eq(householdFunctions.functionId, functionId));

    const currentSet = new Set(currentAssigned.map((r) => r.householdId));
    const targetSet = new Set(targetIds);

    // Identify households to be unassigned
    const toUnassign = currentAssigned
      .filter((r) => !targetSet.has(r.householdId))
      .map((r) => r.householdId);

    // RSVP Protection Rule:
    // Block unassigning any household that has already submitted an RSVP for this function
    if (toUnassign.length > 0) {
      const activeRsvps = await db
        .select({ householdId: rsvps.householdId })
        .from(rsvps)
        .where(and(eq(rsvps.functionId, functionId), inArray(rsvps.householdId, toUnassign)));

      if (activeRsvps.length > 0) {
        res.status(400).json({
          error: 'Cannot unassign household that has already submitted an RSVP. Delete or clear the RSVP first.',
        });
        return;
      }

      // Remove unassigned households
      await db
        .delete(householdFunctions)
        .where(
          and(
            eq(householdFunctions.functionId, functionId),
            inArray(householdFunctions.householdId, toUnassign)
          )
        );
    }

    // Identify households to be newly assigned
    const toAssign = targetIds.filter((id) => !currentSet.has(id));
    if (toAssign.length > 0) {
      const newRows = toAssign.map((householdId) => ({
        id: crypto.randomUUID(),
        householdId,
        functionId,
      }));
      await db.insert(householdFunctions).values(newRows);
    }

    res.json({ success: true, invitedCount: targetIds.length });
  } catch (error) {
    console.error('[functions] Update invitations error:', error);
    res.status(500).json({ error: 'Failed to update function invitations' });
  }
});

