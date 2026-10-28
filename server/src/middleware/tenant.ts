import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { weddings, functions, households } from '../db/schema';

/**
 * Verify that a wedding belongs to the specified planner.
 * Returns the wedding record if owned, or null if not found/unauthorized.
 */
export async function getOwnedWedding(weddingId: string, plannerId: string) {
  const records = await db
    .select()
    .from(weddings)
    .where(
      and(
        eq(weddings.id, weddingId),
        eq(weddings.plannerId, plannerId)
      )
    )
    .limit(1);

  return records.length > 0 ? records[0] : null;
}

/**
 * Verify that a function belongs to a wedding owned by the specified planner.
 * Returns the function and wedding records if owned, or null if unauthorized.
 */
export async function getOwnedFunction(functionId: string, plannerId: string) {
  const records = await db
    .select({
      function: functions,
      wedding: weddings,
    })
    .from(functions)
    .innerJoin(weddings, eq(functions.weddingId, weddings.id))
    .where(
      and(
        eq(functions.id, functionId),
        eq(weddings.plannerId, plannerId)
      )
    )
    .limit(1);

  return records.length > 0 ? records[0] : null;
}

/**
 * Verify that a household belongs to a wedding owned by the specified planner.
 * Returns the household and wedding records if owned, or null if unauthorized.
 */
export async function getOwnedHousehold(householdId: string, plannerId: string) {
  const records = await db
    .select({
      household: households,
      wedding: weddings,
    })
    .from(households)
    .innerJoin(weddings, eq(households.weddingId, weddings.id))
    .where(
      and(
        eq(households.id, householdId),
        eq(weddings.plannerId, plannerId)
      )
    )
    .limit(1);

  return records.length > 0 ? records[0] : null;
}
