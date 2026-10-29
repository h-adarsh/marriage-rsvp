import { describe, it, expect } from 'vitest';
import { calculateHeadcountFromRows } from '../../src/services/headcount';

describe('Task T3.1 & T3.2: Headcount Calculation Engine (Pure Arithmetic Verification)', () => {
  const functionId = 'test-func-id';

  // Seed fixture matching hand-calculated arithmetic:
  // 10 households: 4 yes, 2 maybe, 1 no, 3 pending.
  // Total expected invited = 27 people.
  const handCheckedRows = [
    // 4 Confirmed (Yes) households: Headcount = 4 + 3 + 2 + 5 = 14 people (Veg = 8, Non-Veg = 6)
    {
      householdId: 'hh-1',
      expectedPartySize: 4,
      rsvpStatus: 'yes' as const,
      rsvpPartySize: 4,
      rsvpVegCount: 3,
      rsvpNonvegCount: 1,
      rsvpRespondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (fresh)
    },
    {
      householdId: 'hh-2',
      expectedPartySize: 3,
      rsvpStatus: 'yes' as const,
      rsvpPartySize: 3,
      rsvpVegCount: 2,
      rsvpNonvegCount: 1,
      rsvpRespondedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (fresh)
    },
    {
      householdId: 'hh-3',
      expectedPartySize: 2,
      rsvpStatus: 'yes' as const,
      rsvpPartySize: 2,
      rsvpVegCount: 2,
      rsvpNonvegCount: 0,
      rsvpRespondedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago (stale > 14 days)
    },
    {
      householdId: 'hh-4',
      expectedPartySize: 5,
      rsvpStatus: 'yes' as const,
      rsvpPartySize: 5,
      rsvpVegCount: 1,
      rsvpNonvegCount: 4,
      rsvpRespondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (fresh)
    },

    // 2 Tentative (Maybe) households: Headcount = 2 + 2 = 4 people
    {
      householdId: 'hh-5',
      expectedPartySize: 2,
      rsvpStatus: 'maybe' as const,
      rsvpPartySize: 2,
      rsvpVegCount: 0,
      rsvpNonvegCount: 0,
      rsvpRespondedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (fresh)
    },
    {
      householdId: 'hh-6',
      expectedPartySize: 2,
      rsvpStatus: 'maybe' as const,
      rsvpPartySize: 2,
      rsvpVegCount: 0,
      rsvpNonvegCount: 0,
      rsvpRespondedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), // 18 days ago (stale > 14 days)
    },

    // 1 Declined (No) household: Expected size = 3 people
    {
      householdId: 'hh-7',
      expectedPartySize: 3,
      rsvpStatus: 'no' as const,
      rsvpPartySize: 0,
      rsvpVegCount: 0,
      rsvpNonvegCount: 0,
      rsvpRespondedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },

    // 3 Pending / No Response households: Expected sizes = 2, 1, 3 (Total = 6 people)
    {
      householdId: 'hh-8',
      expectedPartySize: 2,
      rsvpStatus: null,
      rsvpPartySize: null,
      rsvpVegCount: null,
      rsvpNonvegCount: null,
      rsvpRespondedAt: null,
    },
    {
      householdId: 'hh-9',
      expectedPartySize: 1,
      rsvpStatus: null,
      rsvpPartySize: null,
      rsvpVegCount: null,
      rsvpNonvegCount: null,
      rsvpRespondedAt: null,
    },
    {
      householdId: 'hh-10',
      expectedPartySize: 3,
      rsvpStatus: null,
      rsvpPartySize: null,
      rsvpVegCount: null,
      rsvpNonvegCount: null,
      rsvpRespondedAt: null,
    },
  ];

  it('calculates exact hand-checked metrics with default 50% maybe ratio', () => {
    const result = calculateHeadcountFromRows(functionId, handCheckedRows);

    // Household logistics counts
    expect(result.invitedCount).toBe(10);
    expect(result.households).toEqual({
      total: 10,
      confirmed: 4,
      maybe: 2,
      declined: 1,
      noResponse: 3,
    });

    // Catering headcount metrics (Unit: People)
    expect(result.totalInvitedHeadcount).toBe(27);
    expect(result.confirmedHeadcount).toBe(14); // 4 + 3 + 2 + 5
    expect(result.vegCount).toBe(8); // 3 + 2 + 2 + 1
    expect(result.nonvegCount).toBe(6); // 1 + 1 + 0 + 4
    expect(result.vegCount + result.nonvegCount).toBe(result.confirmedHeadcount);

    expect(result.maybeHeadcount).toBe(4); // 2 + 2
    expect(result.declinedHeadcount).toBe(3); // 3
    expect(result.noResponseHeadcount).toBe(6); // 2 + 1 + 3

    // Sum of confirmed + maybe + declined + noResponse must equal totalInvitedHeadcount (14 + 4 + 3 + 6 = 27)
    expect(
      result.confirmedHeadcount +
        result.maybeHeadcount +
        result.declinedHeadcount +
        result.noResponseHeadcount
    ).toBe(result.totalInvitedHeadcount);

    // Planning estimate: 14 + floor(50% * 4) = 14 + 2 = 16
    expect(result.planningEstimate).toBe(16);
    expect(result.formula).toBe('Planning Estimate = Confirmed (14) + 50% of Maybe (4) = 16 guests');

    // Stale responses (> 14 days): hh-3 (20 days) and hh-6 (18 days) = 2
    expect(result.staleCount).toBe(2);
    expect(result.staleDays).toBe(14);
  });

  it('accurately computes planning estimates across different slider percentages', () => {
    // 0%: 14 + floor(0) = 14
    expect(calculateHeadcountFromRows(functionId, handCheckedRows, { maybePct: 0 }).planningEstimate).toBe(14);

    // 25%: 14 + floor(0.25 * 4) = 14 + 1 = 15
    expect(calculateHeadcountFromRows(functionId, handCheckedRows, { maybePct: 25 }).planningEstimate).toBe(15);

    // 50%: 14 + floor(0.50 * 4) = 14 + 2 = 16
    expect(calculateHeadcountFromRows(functionId, handCheckedRows, { maybePct: 50 }).planningEstimate).toBe(16);

    // 75%: 14 + floor(0.75 * 4) = 14 + 3 = 17
    expect(calculateHeadcountFromRows(functionId, handCheckedRows, { maybePct: 75 }).planningEstimate).toBe(17);

    // 100%: 14 + floor(1.00 * 4) = 14 + 4 = 18
    expect(calculateHeadcountFromRows(functionId, handCheckedRows, { maybePct: 100 }).planningEstimate).toBe(18);
  });

  it('clamps out-of-range percentage values to [0, 100]', () => {
    expect(calculateHeadcountFromRows(functionId, handCheckedRows, { maybePct: -20 }).planningEstimate).toBe(14);
    expect(calculateHeadcountFromRows(functionId, handCheckedRows, { maybePct: 150 }).planningEstimate).toBe(18);
  });

  it('supports custom staleDays threshold', () => {
    // With staleDays = 30, none are older than 30 days
    const res30 = calculateHeadcountFromRows(functionId, handCheckedRows, { staleDays: 30 });
    expect(res30.staleCount).toBe(0);

    // With staleDays = 3, responses older than or equal to 3 days: hh-2 (5d), hh-3 (20d), hh-5 (3d), hh-6 (18d) -> 4
    const res3 = calculateHeadcountFromRows(functionId, handCheckedRows, { staleDays: 3 });
    expect(res3.staleCount).toBe(4);
  });

  it('handles empty function invitation list gracefully', () => {
    const emptyResult = calculateHeadcountFromRows(functionId, []);
    expect(emptyResult.invitedCount).toBe(0);
    expect(emptyResult.totalInvitedHeadcount).toBe(0);
    expect(emptyResult.confirmedHeadcount).toBe(0);
    expect(emptyResult.vegCount).toBe(0);
    expect(emptyResult.nonvegCount).toBe(0);
    expect(emptyResult.maybeHeadcount).toBe(0);
    expect(emptyResult.declinedHeadcount).toBe(0);
    expect(emptyResult.noResponseHeadcount).toBe(0);
    expect(emptyResult.planningEstimate).toBe(0);
    expect(emptyResult.households).toEqual({
      total: 0,
      confirmed: 0,
      maybe: 0,
      declined: 0,
      noResponse: 0,
    });
  });
});
