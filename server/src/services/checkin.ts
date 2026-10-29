import crypto from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  checkins,
  households,
  householdFunctions,
  rsvps,
  auditLog,
} from '../db/schema';

export interface CheckinSummary {
  totalCheckedInGuests: number;
  totalCheckedInHouseholds: number;
  walkinGuests: number;
  walkinCount: number;
  confirmedHeadcount: number;
  invitedHeadcount: number;
}

export interface CheckinDetailItem {
  id: string;
  weddingId: string;
  functionId: string;
  householdId: string | null;
  householdName: string | null;
  primaryContactName: string | null;
  phone: string | null;
  guestName: string;
  actualPartySize: number;
  isWalkin: boolean;
  notes: string | null;
  checkedInAt: string;
  rsvpStatus: 'yes' | 'no' | 'maybe' | null;
  rsvpPartySize: number | null;
}

export interface InvitedHouseholdCheckinStatus {
  householdId: string;
  householdName: string;
  primaryContactName: string;
  phone: string | null;
  expectedPartySize: number;
  notes: string | null;
  rsvpStatus: 'yes' | 'no' | 'maybe' | null;
  rsvpPartySize: number | null;
  isCheckedIn: boolean;
  checkinId: string | null;
  actualPartySize: number | null;
  checkedInAt: string | null;
}

export interface FunctionCheckinOverview {
  functionId: string;
  summary: CheckinSummary;
  checkins: CheckinDetailItem[];
  invitedHouseholds: InvitedHouseholdCheckinStatus[];
}

/**
 * Retrieve comprehensive check-in overview for a wedding function.
 */
export async function getFunctionCheckinOverview(functionId: string): Promise<FunctionCheckinOverview> {
  // 1. Fetch all check-in rows for this function with linked household and RSVP details
  const checkinRows = await db
    .select({
      id: checkins.id,
      weddingId: checkins.weddingId,
      functionId: checkins.functionId,
      householdId: checkins.householdId,
      householdName: households.name,
      primaryContactName: households.primaryContactName,
      phone: households.phone,
      guestName: checkins.guestName,
      actualPartySize: checkins.actualPartySize,
      isWalkin: checkins.isWalkin,
      notes: checkins.notes,
      checkedInAt: checkins.checkedInAt,
      rsvpStatus: rsvps.status,
      rsvpPartySize: rsvps.partySize,
    })
    .from(checkins)
    .leftJoin(households, eq(checkins.householdId, households.id))
    .leftJoin(
      rsvps,
      and(eq(checkins.functionId, rsvps.functionId), eq(checkins.householdId, rsvps.householdId))
    )
    .where(eq(checkins.functionId, functionId));

  // Map check-ins sorted by checked-in time descending
  const checkinList: CheckinDetailItem[] = checkinRows
    .map((r) => ({
      id: r.id,
      weddingId: r.weddingId,
      functionId: r.functionId,
      householdId: r.householdId,
      householdName: r.householdName,
      primaryContactName: r.primaryContactName,
      phone: r.phone,
      guestName: r.guestName,
      actualPartySize: r.actualPartySize,
      isWalkin: Boolean(r.isWalkin),
      notes: r.notes,
      checkedInAt: new Date(r.checkedInAt).toISOString(),
      rsvpStatus: r.rsvpStatus,
      rsvpPartySize: r.rsvpPartySize,
    }))
    .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());

  // 2. Fetch all households invited to this function
  const invitedRows = await db
    .select({
      householdId: households.id,
      householdName: households.name,
      primaryContactName: households.primaryContactName,
      phone: households.phone,
      expectedPartySize: households.expectedPartySize,
      notes: households.notes,
      rsvpStatus: rsvps.status,
      rsvpPartySize: rsvps.partySize,
    })
    .from(householdFunctions)
    .innerJoin(households, eq(householdFunctions.householdId, households.id))
    .leftJoin(
      rsvps,
      and(
        eq(householdFunctions.functionId, rsvps.functionId),
        eq(householdFunctions.householdId, rsvps.householdId)
      )
    )
    .where(eq(householdFunctions.functionId, functionId));

  // Index check-ins by householdId
  const checkinByHousehold = new Map<string, CheckinDetailItem>();
  for (const c of checkinList) {
    if (c.householdId) {
      checkinByHousehold.set(c.householdId, c);
    }
  }

  // Build invited households list with check-in state
  let confirmedHeadcount = 0;
  let invitedHeadcount = 0;

  const invitedHouseholds: InvitedHouseholdCheckinStatus[] = invitedRows.map((h) => {
    invitedHeadcount += h.expectedPartySize || 1;
    if (h.rsvpStatus === 'yes') {
      confirmedHeadcount += h.rsvpPartySize || h.expectedPartySize || 1;
    }

    const checkin = checkinByHousehold.get(h.householdId);
    return {
      householdId: h.householdId,
      householdName: h.householdName,
      primaryContactName: h.primaryContactName,
      phone: h.phone,
      expectedPartySize: h.expectedPartySize,
      notes: h.notes,
      rsvpStatus: h.rsvpStatus,
      rsvpPartySize: h.rsvpPartySize,
      isCheckedIn: Boolean(checkin),
      checkinId: checkin ? checkin.id : null,
      actualPartySize: checkin ? checkin.actualPartySize : null,
      checkedInAt: checkin ? checkin.checkedInAt : null,
    };
  });

  // Calculate summary metrics
  let totalCheckedInGuests = 0;
  let totalCheckedInHouseholds = 0;
  let walkinGuests = 0;
  let walkinCount = 0;

  for (const c of checkinList) {
    totalCheckedInGuests += c.actualPartySize;
    if (c.isWalkin) {
      walkinGuests += c.actualPartySize;
      walkinCount += 1;
    } else {
      totalCheckedInHouseholds += 1;
    }
  }

  return {
    functionId,
    summary: {
      totalCheckedInGuests,
      totalCheckedInHouseholds,
      walkinGuests,
      walkinCount,
      confirmedHeadcount,
      invitedHeadcount,
    },
    checkins: checkinList,
    invitedHouseholds,
  };
}

export interface RecordCheckinInput {
  weddingId: string;
  functionId: string;
  householdId?: string | null;
  guestName?: string;
  actualPartySize: number;
  isWalkin?: boolean;
  notes?: string | null;
  ipAddress?: string | null;
  plannerId: string;
}

/**
 * Record or update a check-in for an invited household or walk-in guest.
 */
export async function recordCheckin(input: RecordCheckinInput): Promise<{
  checkin: CheckinDetailItem;
  isNew: boolean;
}> {
  const {
    weddingId,
    functionId,
    householdId,
    actualPartySize,
    notes,
    ipAddress,
    plannerId,
  } = input;

  let finalGuestName = input.guestName ? input.guestName.trim() : '';
  let finalIsWalkin = Boolean(input.isWalkin);

  // If householdId is provided, verify it belongs to this function
  if (householdId) {
    const [assignment] = await db
      .select({
        householdId: householdFunctions.householdId,
        householdName: households.name,
        primaryContactName: households.primaryContactName,
        phone: households.phone,
        weddingId: households.weddingId,
      })
      .from(householdFunctions)
      .innerJoin(households, eq(householdFunctions.householdId, households.id))
      .where(
        and(
          eq(householdFunctions.functionId, functionId),
          eq(householdFunctions.householdId, householdId)
        )
      )
      .limit(1);

    if (!assignment) {
      throw new Error('Household is not invited to this function');
    }

    if (assignment.weddingId !== weddingId) {
      throw new Error('Household does not belong to this wedding');
    }

    if (!finalGuestName) {
      finalGuestName = assignment.primaryContactName || assignment.householdName;
    }
    finalIsWalkin = false;
  } else {
    // Walk-in requires a guest name
    if (!finalGuestName) {
      throw new Error('Guest name is required for walk-in arrivals');
    }
    finalIsWalkin = true;
  }

  // Execute check-in inside a transaction with row lock to serialize concurrent check-in attempts
  return await db.transaction(async (tx) => {
    // Check if a check-in already exists for this (functionId, householdId)
    if (householdId) {
      const [existing] = await tx
        .select()
        .from(checkins)
        .where(and(eq(checkins.functionId, functionId), eq(checkins.householdId, householdId)))
        .for('update');

      if (existing) {
        // Update existing checkin
        await tx
          .update(checkins)
          .set({
            guestName: finalGuestName,
            actualPartySize,
            notes: notes !== undefined ? notes : existing.notes,
            checkedInAt: new Date(),
          })
          .where(eq(checkins.id, existing.id));

        // Record audit log
        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          weddingId,
          actorType: 'planner',
          actorId: plannerId,
          action: 'update_checkin',
          entityType: 'checkin',
          entityId: existing.id,
          oldValues: {
            actualPartySize: existing.actualPartySize,
            guestName: existing.guestName,
            notes: existing.notes,
          },
          newValues: {
            actualPartySize,
            guestName: finalGuestName,
            notes: notes !== undefined ? notes : existing.notes,
          },
          ipAddress: ipAddress || null,
        });

        const [updated] = await tx.select().from(checkins).where(eq(checkins.id, existing.id));

        return {
          checkin: {
            id: updated.id,
            weddingId: updated.weddingId,
            functionId: updated.functionId,
            householdId: updated.householdId,
            householdName: null,
            primaryContactName: null,
            phone: null,
            guestName: updated.guestName,
            actualPartySize: updated.actualPartySize,
            isWalkin: Boolean(updated.isWalkin),
            notes: updated.notes,
            checkedInAt: new Date(updated.checkedInAt).toISOString(),
            rsvpStatus: null,
            rsvpPartySize: null,
          },
          isNew: false,
        };
      }
    }

    // Create new check-in record
    const checkinId = crypto.randomUUID();
    await tx.insert(checkins).values({
      id: checkinId,
      weddingId,
      functionId,
      householdId: householdId || null,
      guestName: finalGuestName,
      actualPartySize,
      isWalkin: finalIsWalkin,
      notes: notes || null,
      checkedInAt: new Date(),
    });

    // Record audit log
    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      weddingId,
      actorType: 'planner',
      actorId: plannerId,
      action: 'venue_checkin',
      entityType: 'checkin',
      entityId: checkinId,
      newValues: {
        householdId: householdId || null,
        guestName: finalGuestName,
        actualPartySize,
        isWalkin: finalIsWalkin,
        notes: notes || null,
      },
      ipAddress: ipAddress || null,
    });

    const [created] = await tx.select().from(checkins).where(eq(checkins.id, checkinId));

    return {
      checkin: {
        id: created.id,
        weddingId: created.weddingId,
        functionId: created.functionId,
        householdId: created.householdId,
        householdName: null,
        primaryContactName: null,
        phone: null,
        guestName: created.guestName,
        actualPartySize: created.actualPartySize,
        isWalkin: Boolean(created.isWalkin),
        notes: created.notes,
        checkedInAt: new Date(created.checkedInAt).toISOString(),
        rsvpStatus: null,
        rsvpPartySize: null,
      },
      isNew: true,
    };
  });
}

/**
 * Remove/undo a check-in record.
 */
export async function undoCheckin(params: {
  functionId: string;
  checkinId: string;
  weddingId: string;
  plannerId: string;
  ipAddress?: string | null;
}): Promise<boolean> {
  const { functionId, checkinId, weddingId, plannerId, ipAddress } = params;

  const [existing] = await db
    .select()
    .from(checkins)
    .where(and(eq(checkins.id, checkinId), eq(checkins.functionId, functionId)))
    .limit(1);

  if (!existing) {
    return false;
  }

  await db.delete(checkins).where(eq(checkins.id, checkinId));

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    weddingId,
    actorType: 'planner',
    actorId: plannerId,
    action: 'undo_checkin',
    entityType: 'checkin',
    entityId: checkinId,
    oldValues: {
      householdId: existing.householdId,
      guestName: existing.guestName,
      actualPartySize: existing.actualPartySize,
      isWalkin: existing.isWalkin,
    },
    ipAddress: ipAddress || null,
  });

  return true;
}

/**
 * Update an existing check-in (party size or notes).
 */
export async function updateCheckin(params: {
  functionId: string;
  checkinId: string;
  weddingId: string;
  plannerId: string;
  actualPartySize?: number;
  guestName?: string;
  notes?: string | null;
  ipAddress?: string | null;
}): Promise<CheckinDetailItem | null> {
  const { functionId, checkinId, weddingId, plannerId, actualPartySize, guestName, notes, ipAddress } =
    params;

  const [existing] = await db
    .select()
    .from(checkins)
    .where(and(eq(checkins.id, checkinId), eq(checkins.functionId, functionId)))
    .limit(1);

  if (!existing) {
    return null;
  }

  const updates: Record<string, any> = {};
  if (actualPartySize !== undefined) {
    updates.actualPartySize = actualPartySize;
  }
  if (guestName !== undefined) {
    updates.guestName = guestName.trim();
  }
  if (notes !== undefined) {
    updates.notes = notes;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(checkins).set(updates).where(eq(checkins.id, checkinId));

    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      weddingId,
      actorType: 'planner',
      actorId: plannerId,
      action: 'update_checkin',
      entityType: 'checkin',
      entityId: checkinId,
      oldValues: {
        actualPartySize: existing.actualPartySize,
        guestName: existing.guestName,
        notes: existing.notes,
      },
      newValues: updates,
      ipAddress: ipAddress || null,
    });
  }

  const [updated] = await db.select().from(checkins).where(eq(checkins.id, checkinId));

  return {
    id: updated.id,
    weddingId: updated.weddingId,
    functionId: updated.functionId,
    householdId: updated.householdId,
    householdName: null,
    primaryContactName: null,
    phone: null,
    guestName: updated.guestName,
    actualPartySize: updated.actualPartySize,
    isWalkin: Boolean(updated.isWalkin),
    notes: updated.notes,
    checkedInAt: new Date(updated.checkedInAt).toISOString(),
    rsvpStatus: null,
    rsvpPartySize: null,
  };
}

