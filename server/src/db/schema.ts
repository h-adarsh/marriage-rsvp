import {
  mysqlTable,
  varchar,
  text,
  int,
  boolean,
  timestamp,
  datetime,
  date,
  mysqlEnum,
  json,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// 1. Planners: Authenticated event planners/hosts
export const planners = mysqlTable('planners', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

// 2. Sessions: Stateful session cookies
export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  plannerId: varchar('planner_id', { length: 36 })
    .notNull()
    .references(() => planners.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 3. Weddings: Top-level wedding project container
export const weddings = mysqlTable('weddings', {
  id: varchar('id', { length: 36 }).primaryKey(),
  plannerId: varchar('planner_id', { length: 36 })
    .notNull()
    .references(() => planners.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  coupleNames: varchar('couple_names', { length: 200 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  plannerIdx: index('idx_weddings_planner').on(table.plannerId),
}));

// 4. Functions: Individual events under a wedding (Haldi, Mehendi, Wedding, Reception)
export const functions = mysqlTable('functions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  weddingId: varchar('wedding_id', { length: 36 })
    .notNull()
    .references(() => weddings.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  dateTime: datetime('date_time').notNull(),
  venue: varchar('venue', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  weddingIdx: index('idx_functions_wedding').on(table.weddingId),
}));

// 5. Households: Family units receiving collective invitations
export const households = mysqlTable('households', {
  id: varchar('id', { length: 36 }).primaryKey(),
  weddingId: varchar('wedding_id', { length: 36 })
    .notNull()
    .references(() => weddings.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  primaryContactName: varchar('primary_contact_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  expectedPartySize: int('expected_party_size').notNull().default(1),
  // 128-bit unguessable random token stored directly for MVP capability links
  inviteToken: varchar('invite_token', { length: 64 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  tokenUq: uniqueIndex('uq_households_token').on(table.inviteToken),
  weddingPhoneIdx: index('idx_households_wedding_phone').on(table.weddingId, table.phone),
}));

// 6. HouseholdFunctions: Explicit join table recording who is invited to what
export const householdFunctions = mysqlTable('household_functions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  householdId: varchar('household_id', { length: 36 })
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  functionId: varchar('function_id', { length: 36 })
    .notNull()
    .references(() => functions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  householdFunctionUq: uniqueIndex('uq_household_function').on(table.householdId, table.functionId),
  functionIdx: index('idx_hf_function').on(table.functionId),
}));

// 7. RSVPs: Exactly one row per (function, household)
export const rsvps = mysqlTable('rsvps', {
  id: varchar('id', { length: 36 }).primaryKey(),
  functionId: varchar('function_id', { length: 36 })
    .notNull()
    .references(() => functions.id, { onDelete: 'cascade' }),
  householdId: varchar('household_id', { length: 36 })
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  status: mysqlEnum('status', ['yes', 'no', 'maybe']).notNull(),
  partySize: int('party_size').notNull().default(0),
  vegCount: int('veg_count').notNull().default(0),
  nonvegCount: int('nonveg_count').notNull().default(0),
  checkedIn: boolean('checked_in').notNull().default(false),
  actualPartySize: int('actual_party_size'),
  dietaryNotes: text('dietary_notes'),
  respondedAt: timestamp('responded_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  rsvpFuncHhUq: uniqueIndex('uq_rsvp_func_hh').on(table.functionId, table.householdId),
}));

// 8. AuditLog: Records critical mutations (who changed what, when)
export const auditLog = mysqlTable('audit_log', {
  id: varchar('id', { length: 36 }).primaryKey(),
  weddingId: varchar('wedding_id', { length: 36 })
    .notNull()
    .references(() => weddings.id, { onDelete: 'cascade' }),
  actorType: mysqlEnum('actor_type', ['planner', 'guest', 'system']).notNull(),
  actorId: varchar('actor_id', { length: 36 }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 36 }).notNull(),
  oldValues: json('old_values'),
  newValues: json('new_values'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  auditWeddingCreatedIdx: index('idx_audit_wedding_created').on(table.weddingId, table.createdAt),
}));

// 9. Checkins: Venue arrivals tracking (supporting both invited households and walk-ins)
export const checkins = mysqlTable('checkins', {
  id: varchar('id', { length: 36 }).primaryKey(),
  weddingId: varchar('wedding_id', { length: 36 })
    .notNull()
    .references(() => weddings.id, { onDelete: 'cascade' }),
  functionId: varchar('function_id', { length: 36 })
    .notNull()
    .references(() => functions.id, { onDelete: 'cascade' }),
  householdId: varchar('household_id', { length: 36 })
    .references(() => households.id, { onDelete: 'set null' }),
  guestName: varchar('guest_name', { length: 150 }).notNull(),
  actualPartySize: int('actual_party_size').notNull().default(1),
  isWalkin: boolean('is_walkin').notNull().default(false),
  notes: text('notes'),
  checkedInAt: timestamp('checked_in_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  funcHhIdx: index('idx_checkins_func_hh').on(table.functionId, table.householdId),
  funcIdx: index('idx_checkins_func').on(table.functionId),
  weddingIdx: index('idx_checkins_wedding').on(table.weddingId),
}));

// Drizzle ORM Relations definitions for type-safe relational queries
export const plannersRelations = relations(planners, ({ many }) => ({
  weddings: many(weddings),
  sessions: many(sessions),
}));

export const weddingsRelations = relations(weddings, ({ one, many }) => ({
  planner: one(planners, {
    fields: [weddings.plannerId],
    references: [planners.id],
  }),
  functions: many(functions),
  households: many(households),
  checkins: many(checkins),
  auditLogs: many(auditLog),
}));

export const functionsRelations = relations(functions, ({ one, many }) => ({
  wedding: one(weddings, {
    fields: [functions.weddingId],
    references: [weddings.id],
  }),
  householdFunctions: many(householdFunctions),
  rsvps: many(rsvps),
  checkins: many(checkins),
}));

export const householdsRelations = relations(households, ({ one, many }) => ({
  wedding: one(weddings, {
    fields: [households.weddingId],
    references: [weddings.id],
  }),
  householdFunctions: many(householdFunctions),
  rsvps: many(rsvps),
  checkins: many(checkins),
}));

export const householdFunctionsRelations = relations(householdFunctions, ({ one }) => ({
  household: one(households, {
    fields: [householdFunctions.householdId],
    references: [households.id],
  }),
  function: one(functions, {
    fields: [householdFunctions.functionId],
    references: [functions.id],
  }),
}));

export const rsvpsRelations = relations(rsvps, ({ one }) => ({
  function: one(functions, {
    fields: [rsvps.functionId],
    references: [functions.id],
  }),
  household: one(households, {
    fields: [rsvps.householdId],
    references: [households.id],
  }),
}));

export const checkinsRelations = relations(checkins, ({ one }) => ({
  wedding: one(weddings, {
    fields: [checkins.weddingId],
    references: [weddings.id],
  }),
  function: one(functions, {
    fields: [checkins.functionId],
    references: [functions.id],
  }),
  household: one(households, {
    fields: [checkins.householdId],
    references: [households.id],
  }),
}));
