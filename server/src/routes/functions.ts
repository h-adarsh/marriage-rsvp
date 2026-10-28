import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { functions } from '../db/schema';
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
