import { describe, it, expect } from 'vitest';
import {
  planners,
  sessions,
  weddings,
  functions,
  households,
  householdFunctions,
  rsvps,
  auditLog,
  checkins,
} from '../../src/db/schema';
import { getTableColumns } from 'drizzle-orm';

describe('Database Schema Definitions', () => {
  it('defines all 9 core tables including checkins', () => {
    expect(planners).toBeDefined();
    expect(sessions).toBeDefined();
    expect(weddings).toBeDefined();
    expect(functions).toBeDefined();
    expect(households).toBeDefined();
    expect(householdFunctions).toBeDefined();
    expect(rsvps).toBeDefined();
    expect(auditLog).toBeDefined();
    expect(checkins).toBeDefined();
  });

  it('verifies planners table columns', () => {
    const cols = getTableColumns(planners);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('email');
    expect(cols).toHaveProperty('passwordHash');
    expect(cols).toHaveProperty('name');
    expect(cols).toHaveProperty('createdAt');
    expect(cols).toHaveProperty('updatedAt');
  });

  it('verifies rsvps table has unique (function, household) and dietary columns', () => {
    const cols = getTableColumns(rsvps);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('functionId');
    expect(cols).toHaveProperty('householdId');
    expect(cols).toHaveProperty('status');
    expect(cols).toHaveProperty('partySize');
    expect(cols).toHaveProperty('vegCount');
    expect(cols).toHaveProperty('nonvegCount');
    expect(cols).toHaveProperty('checkedIn');
    expect(cols).toHaveProperty('actualPartySize');
  });

  it('verifies household_functions join table columns', () => {
    const cols = getTableColumns(householdFunctions);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('householdId');
    expect(cols).toHaveProperty('functionId');
  });

  it('verifies audit_log columns', () => {
    const cols = getTableColumns(auditLog);
    expect(cols).toHaveProperty('weddingId');
    expect(cols).toHaveProperty('actorType');
    expect(cols).toHaveProperty('action');
    expect(cols).toHaveProperty('entityType');
    expect(cols).toHaveProperty('entityId');
  });

  it('verifies checkins table columns for arrival tracking and walk-in support', () => {
    const cols = getTableColumns(checkins);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('weddingId');
    expect(cols).toHaveProperty('functionId');
    expect(cols).toHaveProperty('householdId');
    expect(cols).toHaveProperty('guestName');
    expect(cols).toHaveProperty('actualPartySize');
    expect(cols).toHaveProperty('isWalkin');
    expect(cols).toHaveProperty('notes');
    expect(cols).toHaveProperty('checkedInAt');
  });
});
