import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { eq, desc, asc } from 'drizzle-orm';
import { db } from '../db';
import { weddings, functions, households } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { getOwnedWedding } from '../middleware/tenant';
import { householdSchema } from './households';
import { generateInviteToken } from '../utils/auth';
import multer from 'multer';
import { processHouseholdCsv, checkDuplicates, normalizePhone } from '../services/csv';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max file size
});

export const weddingsRouter = Router();

// Require planner authentication for all wedding routes
weddingsRouter.use(requireAuth);

const weddingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  coupleNames: z.string().min(1, 'Couple names are required').max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

const functionSchema = z.object({
  name: z.string().min(1, 'Function name is required').max(100),
  dateTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid date and time is required',
  }),
  venue: z.string().min(1, 'Venue is required').max(255),
});

/**
 * GET /api/weddings - List all weddings belonging to the logged-in planner
 */
weddingsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const plannerWeddings = await db
      .select()
      .from(weddings)
      .where(eq(weddings.plannerId, req.user!.id))
      .orderBy(desc(weddings.createdAt));

    res.json(plannerWeddings);
  } catch (error) {
    console.error('[weddings] List error:', error);
    res.status(500).json({ error: 'Failed to retrieve weddings' });
  }
});

/**
 * POST /api/weddings - Create a new wedding for the logged-in planner
 */
weddingsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parseResult = weddingSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid wedding input' });
    return;
  }

  const { title, coupleNames, startDate, endDate } = parseResult.data;
  const weddingId = crypto.randomUUID();

  try {
    await db.insert(weddings).values({
      id: weddingId,
      plannerId: req.user!.id,
      title: title.trim(),
      coupleNames: coupleNames.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    const created = await getOwnedWedding(weddingId, req.user!.id);
    res.status(201).json(created);
  } catch (error) {
    console.error('[weddings] Create error:', error);
    res.status(500).json({ error: 'Failed to create wedding' });
  }
});

/**
 * GET /api/weddings/:id - Get a single wedding (enforcing planner ownership)
 */
weddingsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const weddingId = req.params.id;

  try {
    const wedding = await getOwnedWedding(weddingId, req.user!.id);
    if (!wedding) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    res.json(wedding);
  } catch (error) {
    console.error('[weddings] Get single error:', error);
    res.status(500).json({ error: 'Failed to retrieve wedding' });
  }
});

/**
 * PUT /api/weddings/:id - Update an existing wedding
 */
weddingsRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const weddingId = req.params.id;

  const parseResult = weddingSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid wedding input' });
    return;
  }

  try {
    const existing = await getOwnedWedding(weddingId, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    const { title, coupleNames, startDate, endDate } = parseResult.data;

    await db
      .update(weddings)
      .set({
        title: title.trim(),
        coupleNames: coupleNames.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
      .where(eq(weddings.id, weddingId));

    const updated = await getOwnedWedding(weddingId, req.user!.id);
    res.json(updated);
  } catch (error) {
    console.error('[weddings] Update error:', error);
    res.status(500).json({ error: 'Failed to update wedding' });
  }
});

/**
 * DELETE /api/weddings/:id - Delete a wedding and all related data (cascades)
 */
weddingsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const weddingId = req.params.id;

  try {
    const existing = await getOwnedWedding(weddingId, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    await db.delete(weddings).where(eq(weddings.id, weddingId));
    res.json({ success: true, deletedId: weddingId });
  } catch (error) {
    console.error('[weddings] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete wedding' });
  }
});

/**
 * GET /api/weddings/:id/functions - List functions under a wedding
 */
weddingsRouter.get('/:id/functions', async (req: Request, res: Response): Promise<void> => {
  const weddingId = req.params.id;

  try {
    const wedding = await getOwnedWedding(weddingId, req.user!.id);
    if (!wedding) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    const weddingFunctions = await db
      .select()
      .from(functions)
      .where(eq(functions.weddingId, weddingId))
      .orderBy(asc(functions.dateTime));

    res.json(weddingFunctions);
  } catch (error) {
    console.error('[weddings] List functions error:', error);
    res.status(500).json({ error: 'Failed to retrieve functions' });
  }
});

/**
 * POST /api/weddings/:id/functions - Create a new function under a wedding
 */
weddingsRouter.post('/:id/functions', async (req: Request, res: Response): Promise<void> => {
  const weddingId = req.params.id;

  const parseResult = functionSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid function input' });
    return;
  }

  try {
    const wedding = await getOwnedWedding(weddingId, req.user!.id);
    if (!wedding) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    const { name, dateTime, venue } = parseResult.data;
    const functionId = crypto.randomUUID();

    await db.insert(functions).values({
      id: functionId,
      weddingId,
      name: name.trim(),
      dateTime: new Date(dateTime),
      venue: venue.trim(),
    });

    const [created] = await db.select().from(functions).where(eq(functions.id, functionId)).limit(1);
    res.status(201).json(created);
  } catch (error) {
    console.error('[weddings] Create function error:', error);
    res.status(500).json({ error: 'Failed to create function' });
  }
});

/**
 * GET /api/weddings/:id/households - List all households under an owned wedding
 */
weddingsRouter.get('/:id/households', async (req: Request, res: Response): Promise<void> => {
  const weddingId = req.params.id;

  try {
    const wedding = await getOwnedWedding(weddingId, req.user!.id);
    if (!wedding) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    const list = await db
      .select()
      .from(households)
      .where(eq(households.weddingId, weddingId))
      .orderBy(asc(households.name));

    res.json(list);
  } catch (error) {
    console.error('[weddings] List households error:', error);
    res.status(500).json({ error: 'Failed to retrieve households' });
  }
});

/**
 * POST /api/weddings/:id/households - Add a household to an owned wedding
 */
weddingsRouter.post('/:id/households', async (req: Request, res: Response): Promise<void> => {
  const weddingId = req.params.id;

  const parseResult = householdSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid household input' });
    return;
  }

  try {
    const wedding = await getOwnedWedding(weddingId, req.user!.id);
    if (!wedding) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    const { name, primaryContactName, phone, expectedPartySize, notes } = parseResult.data;
    const householdId = crypto.randomUUID();
    const inviteToken = generateInviteToken(); // 128-bit unguessable random token

    await db.insert(households).values({
      id: householdId,
      weddingId,
      name: name.trim(),
      primaryContactName: primaryContactName.trim(),
      phone: normalizePhone(phone),
      expectedPartySize,
      inviteToken,
      notes: notes ? notes.trim() : null,
    });

    const [created] = await db.select().from(households).where(eq(households.id, householdId)).limit(1);
    res.status(201).json(created);
  } catch (error) {
    console.error('[weddings] Create household error:', error);
    res.status(500).json({ error: 'Failed to create household' });
  }
});

/**
 * POST /api/weddings/:id/households/import-csv - Upload and parse guest CSV with duplicate detection
 */
weddingsRouter.post(
  '/:id/households/import-csv',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = req.params.id;

    if (!req.file) {
      res.status(400).json({ error: 'Please upload a CSV file' });
      return;
    }

    try {
      const wedding = await getOwnedWedding(weddingId, req.user!.id);
      if (!wedding) {
        res.status(404).json({ error: 'Wedding not found' });
        return;
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const { validRows, invalidRows } = processHouseholdCsv(csvContent);

      if (validRows.length === 0 && invalidRows.length === 0) {
        res.status(400).json({ error: 'CSV file is empty or missing data rows' });
        return;
      }

      // Fetch existing households for this wedding to detect duplicates
      const existingHouseholds = await db
        .select({
          id: households.id,
          name: households.name,
          primaryContactName: households.primaryContactName,
          phone: households.phone,
        })
        .from(households)
        .where(eq(households.weddingId, weddingId));

      const allowSharedPhone = req.query.allowSharedPhone === 'true';
      const overrideRowsRaw = req.query.overrideRows || (req.body && req.body.overrideRows);
      const overriddenRowNumbers = overrideRowsRaw
        ? String(overrideRowsRaw)
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n))
        : [];

      const { duplicates, uniqueRows } = checkDuplicates(validRows, existingHouseholds, {
        allowSharedPhone,
        overriddenRowNumbers,
      });

      // Dry run / preview mode
      const isDryRun = req.query.dryRun === 'true';
      if (isDryRun) {
        res.json({
          dryRun: true,
          totalParsed: validRows.length + invalidRows.length,
          validCount: validRows.length,
          invalidCount: invalidRows.length,
          duplicateCount: duplicates.length,
          toImportCount: uniqueRows.length,
          duplicates,
          invalidRows,
          previewRows: uniqueRows,
        });
        return;
      }

      // Commit unique valid rows into database
      const createdHouseholds = [];
      for (const row of uniqueRows) {
        const householdId = crypto.randomUUID();
        const inviteToken = generateInviteToken();

        await db.insert(households).values({
          id: householdId,
          weddingId,
          name: row.name.trim(),
          primaryContactName: row.primaryContactName.trim(),
          phone: row.phone.trim(),
          expectedPartySize: row.expectedPartySize,
          inviteToken,
          notes: row.notes ? row.notes.trim() : null,
        });

        createdHouseholds.push({
          id: householdId,
          name: row.name.trim(),
          primaryContactName: row.primaryContactName.trim(),
          phone: row.phone.trim(),
          expectedPartySize: row.expectedPartySize,
          inviteToken,
        });
      }

      res.status(200).json({
        success: true,
        importedCount: createdHouseholds.length,
        duplicateCount: duplicates.length,
        invalidCount: invalidRows.length,
        duplicates,
        invalidRows,
        importedHouseholds: createdHouseholds,
      });
    } catch (error) {
      console.error('[weddings] CSV import error:', error);
      res.status(500).json({ error: 'Failed to process CSV file' });
    }
  }
);
