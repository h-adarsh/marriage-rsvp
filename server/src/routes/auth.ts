import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { planners, sessions } from '../db/schema';
import {
  hashPassword,
  verifyPassword,
  generateSessionId,
  getSessionCookieOptions,
  getClearCookieOptions,
  COOKIE_NAME,
} from '../utils/auth';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1, 'Name is required').max(100),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

// Dummy hash used for constant-time comparison when email is not found
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHQ$RdescudvJCsgqlfreSaAcw';

/**
 * POST /api/auth/register
 */
authRouter.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid input data' });
    return;
  }

  const { email, password, name } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await db
      .select({ id: planners.id })
      .from(planners)
      .where(eq(planners.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const plannerId = crypto.randomUUID();
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Insert planner
    await db.insert(planners).values({
      id: plannerId,
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
    });

    // Create active session
    await db.insert(sessions).values({
      id: sessionId,
      plannerId,
      expiresAt,
    });

    res.cookie(COOKIE_NAME, sessionId, getSessionCookieOptions());
    res.status(201).json({
      id: plannerId,
      email: normalizedEmail,
      name: name.trim(),
    });
  } catch (error) {
    console.error('[auth] Register error:', error);
    res.status(500).json({ error: 'Failed to create planner account' });
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid email or password format' });
    return;
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const userRecords = await db
      .select({
        id: planners.id,
        email: planners.email,
        passwordHash: planners.passwordHash,
        name: planners.name,
      })
      .from(planners)
      .where(eq(planners.email, normalizedEmail))
      .limit(1);

    if (userRecords.length === 0) {
      // Execute dummy verify to avoid timing discrepancy revealing email non-existence
      await verifyPassword(password, DUMMY_HASH);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const planner = userRecords[0];
    const passwordValid = await verifyPassword(password, planner.passwordHash);

    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(sessions).values({
      id: sessionId,
      plannerId: planner.id,
      expiresAt,
    });

    res.cookie(COOKIE_NAME, sessionId, getSessionCookieOptions());
    res.status(200).json({
      id: planner.id,
      email: planner.email,
      name: planner.name,
    });
  } catch (error) {
    console.error('[auth] Login error:', error);
    res.status(500).json({ error: 'Failed to authenticate planner' });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.cookies?.[COOKIE_NAME];

  if (sessionId && typeof sessionId === 'string') {
    try {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    } catch (error) {
      console.error('[auth] Logout session cleanup error:', error);
    }
  }

  res.clearCookie(COOKIE_NAME, getClearCookieOptions());
  res.status(200).json({ success: true });
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.status(200).json({
    id: req.user!.id,
    email: req.user!.email,
    name: req.user!.name,
  });
});
