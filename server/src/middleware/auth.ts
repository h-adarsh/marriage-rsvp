import { Request, Response, NextFunction } from 'express';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db';
import { sessions, planners } from '../db/schema';
import { COOKIE_NAME } from '../utils/auth';

/**
 * Authentication middleware that verifies session cookie against database sessions
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.cookies?.[COOKIE_NAME];

  if (!sessionId || typeof sessionId !== 'string') {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const records = await db
      .select({
        sessionId: sessions.id,
        plannerId: planners.id,
        plannerEmail: planners.email,
        plannerName: planners.name,
      })
      .from(sessions)
      .innerJoin(planners, eq(sessions.plannerId, planners.id))
      .where(
        and(
          eq(sessions.id, sessionId),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (records.length === 0) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const record = records[0];
    req.user = {
      id: record.plannerId,
      email: record.plannerEmail,
      name: record.plannerName,
      sessionId: record.sessionId,
    };

    next();
  } catch (error) {
    console.error('[auth] Error validating session:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}
