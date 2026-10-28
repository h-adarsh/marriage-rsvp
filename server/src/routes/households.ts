import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { households } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { getOwnedHousehold } from '../middleware/tenant';

export const householdsRouter = Router();

// Require planner authentication
householdsRouter.use(requireAuth);

export const householdSchema = z.object({
  name: z.string().min(1, 'Household name is required').max(150),
  primaryContactName: z.string().min(1, 'Primary contact name is required').max(100),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone number must be between 7 and 15 digits (optional leading +)'),
  expectedPartySize: z.number().int().min(1, 'Party size must be at least 1').max(50, 'Party size cannot exceed 50'),
  notes: z.string().max(1000).optional().nullable(),
});

/**
 * PUT /api/households/:id - Update an existing household
 */
householdsRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const householdId = req.params.id;

  const parseResult = householdSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid household input' });
    return;
  }

  try {
    const owned = await getOwnedHousehold(householdId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Household not found' });
      return;
    }

    const { name, primaryContactName, phone, expectedPartySize, notes } = parseResult.data;

    await db
      .update(households)
      .set({
        name: name.trim(),
        primaryContactName: primaryContactName.trim(),
        phone: phone.trim(),
        expectedPartySize,
        notes: notes ? notes.trim() : null,
      })
      .where(eq(households.id, householdId));

    const [updated] = await db.select().from(households).where(eq(households.id, householdId)).limit(1);
    res.json(updated);
  } catch (error) {
    console.error('[households] Update error:', error);
    res.status(500).json({ error: 'Failed to update household' });
  }
});

/**
 * DELETE /api/households/:id - Delete a household (cascades to household_functions and rsvps)
 */
householdsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const householdId = req.params.id;

  try {
    const owned = await getOwnedHousehold(householdId, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: 'Household not found' });
      return;
    }

    await db.delete(households).where(eq(households.id, householdId));
    res.json({ success: true, deletedId: householdId });
  } catch (error) {
    console.error('[households] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete household' });
  }
});
