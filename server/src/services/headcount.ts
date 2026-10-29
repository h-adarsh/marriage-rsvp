import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { householdFunctions, households, rsvps } from '../db/schema';

export interface HeadcountOptions {
  maybePct?: number;
  staleDays?: number;
}

export interface HeadcountHouseholdBreakdown {
  total: number;
  confirmed: number;
  maybe: number;
  declined: number;
  noResponse: number;
}

export interface StaleHouseholdItem {
  householdId: string;
  householdName: string;
  primaryContactName: string;
  phone: string | null;
  status: 'yes' | 'maybe';
  partySize: number;
  respondedAt: string;
  daysAgo: number;
}

export interface HeadcountResult {
  functionId: string;
  invitedCount: number; // Unit: Households
  totalInvitedHeadcount: number; // Unit: People
  confirmedHeadcount: number; // Unit: People
  vegCount: number; // Unit: Meals / People
  nonvegCount: number; // Unit: Meals / People
  maybeHeadcount: number; // Unit: People
  declinedHeadcount: number; // Unit: People
  noResponseHeadcount: number; // Unit: People
  planningEstimate: number; // Unit: People
  maybePct: number;
  staleCount: number;
  staleDays: number;
  staleHouseholds: StaleHouseholdItem[];
  households: HeadcountHouseholdBreakdown;
  formula: string;
}

/**
 * Pure calculation logic operating on fetched rows.
 * Separated to allow isolated unit testing with hand-checked data.
 */
export function calculateHeadcountFromRows(
  functionId: string,
  rows: Array<{
    householdId: string;
    householdName?: string;
    primaryContactName?: string;
    phone?: string | null;
    expectedPartySize: number;
    rsvpStatus: 'yes' | 'no' | 'maybe' | null;
    rsvpPartySize: number | null;
    rsvpVegCount: number | null;
    rsvpNonvegCount: number | null;
    rsvpRespondedAt: Date | string | null;
  }>,
  options?: HeadcountOptions
): HeadcountResult {
  const rawPct = options?.maybePct !== undefined ? Number(options.maybePct) : 50;
  const maybePct = isNaN(rawPct) ? 50 : Math.max(0, Math.min(100, Math.round(rawPct)));
  const rawStaleDays = options?.staleDays !== undefined ? Number(options.staleDays) : 14;
  const staleDays = isNaN(rawStaleDays) || rawStaleDays < 1 ? 14 : Math.round(rawStaleDays);

  const nowMs = Date.now();
  const staleThresholdMs = nowMs - staleDays * 24 * 60 * 60 * 1000;

  let confirmedHeadcount = 0;
  let vegCount = 0;
  let nonvegCount = 0;
  let maybeHeadcount = 0;
  let declinedHeadcount = 0;
  let noResponseHeadcount = 0;
  let totalInvitedHeadcount = 0;

  let confirmedHouseholds = 0;
  let maybeHouseholds = 0;
  let declinedHouseholds = 0;
  let noResponseHouseholds = 0;

  let staleCount = 0;
  const staleHouseholds: StaleHouseholdItem[] = [];

  for (const row of rows) {
    const expected = row.expectedPartySize || 1;
    totalInvitedHeadcount += expected;

    if (row.rsvpStatus === 'yes') {
      confirmedHouseholds += 1;
      const actualSize = row.rsvpPartySize !== null && row.rsvpPartySize > 0 ? row.rsvpPartySize : expected;
      confirmedHeadcount += actualSize;
      vegCount += row.rsvpVegCount || 0;
      nonvegCount += row.rsvpNonvegCount || 0;

      if (row.rsvpRespondedAt && new Date(row.rsvpRespondedAt).getTime() < staleThresholdMs) {
        staleCount += 1;
        const respTime = new Date(row.rsvpRespondedAt).getTime();
        staleHouseholds.push({
          householdId: row.householdId,
          householdName: row.householdName || 'Unknown Household',
          primaryContactName: row.primaryContactName || '',
          phone: row.phone || null,
          status: 'yes',
          partySize: actualSize,
          respondedAt: new Date(row.rsvpRespondedAt).toISOString(),
          daysAgo: Math.max(0, Math.floor((nowMs - respTime) / (24 * 60 * 60 * 1000))),
        });
      }
    } else if (row.rsvpStatus === 'maybe') {
      maybeHouseholds += 1;
      const actualSize = row.rsvpPartySize !== null && row.rsvpPartySize > 0 ? row.rsvpPartySize : expected;
      maybeHeadcount += actualSize;

      if (row.rsvpRespondedAt && new Date(row.rsvpRespondedAt).getTime() < staleThresholdMs) {
        staleCount += 1;
        const respTime = new Date(row.rsvpRespondedAt).getTime();
        staleHouseholds.push({
          householdId: row.householdId,
          householdName: row.householdName || 'Unknown Household',
          primaryContactName: row.primaryContactName || '',
          phone: row.phone || null,
          status: 'maybe',
          partySize: actualSize,
          respondedAt: new Date(row.rsvpRespondedAt).toISOString(),
          daysAgo: Math.max(0, Math.floor((nowMs - respTime) / (24 * 60 * 60 * 1000))),
        });
      }
    } else if (row.rsvpStatus === 'no') {
      declinedHouseholds += 1;
      declinedHeadcount += expected;
    } else {
      noResponseHouseholds += 1;
      noResponseHeadcount += expected;
    }
  }

  // Sort stale households by staleness descending (oldest first)
  staleHouseholds.sort((a, b) => b.daysAgo - a.daysAgo);

  const planningEstimate = confirmedHeadcount + Math.floor((maybePct / 100) * maybeHeadcount);
  const formula = `Planning Estimate = Confirmed (${confirmedHeadcount}) + ${maybePct}% of Maybe (${maybeHeadcount}) = ${planningEstimate} guests`;

  return {
    functionId,
    invitedCount: rows.length,
    totalInvitedHeadcount,
    confirmedHeadcount,
    vegCount,
    nonvegCount,
    maybeHeadcount,
    declinedHeadcount,
    noResponseHeadcount,
    planningEstimate,
    maybePct,
    staleCount,
    staleDays,
    staleHouseholds,
    households: {
      total: rows.length,
      confirmed: confirmedHouseholds,
      maybe: maybeHouseholds,
      declined: declinedHouseholds,
      noResponse: noResponseHouseholds,
    },
    formula,
  };
}

/**
 * Fetch and calculate complete headcount metrics for a wedding function.
 */
export async function getFunctionHeadcount(
  functionId: string,
  options?: HeadcountOptions
): Promise<HeadcountResult> {
  const rows = await db
    .select({
      householdId: householdFunctions.householdId,
      householdName: households.name,
      primaryContactName: households.primaryContactName,
      phone: households.phone,
      expectedPartySize: households.expectedPartySize,
      rsvpStatus: rsvps.status,
      rsvpPartySize: rsvps.partySize,
      rsvpVegCount: rsvps.vegCount,
      rsvpNonvegCount: rsvps.nonvegCount,
      rsvpRespondedAt: rsvps.respondedAt,
    })
    .from(householdFunctions)
    .innerJoin(households, eq(householdFunctions.householdId, households.id))
    .leftJoin(
      rsvps,
      and(
        eq(rsvps.functionId, householdFunctions.functionId),
        eq(rsvps.householdId, householdFunctions.householdId)
      )
    )
    .where(eq(householdFunctions.functionId, functionId));

  return calculateHeadcountFromRows(functionId, rows as any, options);
}

