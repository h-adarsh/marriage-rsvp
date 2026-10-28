# AUDIT: Wedding RSVP & Headcount App

## 1. Documentation Alignment & Cross-Check Findings

A comprehensive cross-check between `PROJECT_CONTEXT.md`, `docs/SCOPE.md`, and `docs/ARCHITECTURE.md` was performed:

| Check Area | PROJECT_CONTEXT.md | docs/SCOPE.md | docs/ARCHITECTURE.md | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Planners Table** | Required in Sec 8 | Story 1 | Defined in Sec 2.1 | **Aligned** | UUID, email, Argon2 password hash. |
| **Household Functions Join** | Required in Sec 8 | Story 4 | Defined in Sec 2.6 | **Aligned** | Differentiates "Not Invited" from "No Response". |
| **RSVP Unique Constraint** | Required (func, household) | Story 6 | Defined in Sec 2.7 | **Aligned** | Unique index `uq_rsvp_func_hh`. |
| **Dietary Rules** | `veg + nonveg = party_size` | Story 6 AC | Defined in Sec 4.6 | **Aligned** | Enforced on client and server. |
| **Audit Log Table** | Required in Sec 8 | Story 4 & 6 | Defined in Sec 2.8 | **Aligned** | Captures actor, action, and JSON diffs. |
| **128-bit Invite Token** | Required in Sec 8 | Story 5 | Defined in Sec 2.5 | **Aligned** | Unguessable, stored in plaintext for MVP per decision log. |
| **Headcount Formulas** | Strict rules in Sec 6 | Story 7 | Defined in Sec 4 | **Aligned** | Confirmed strictly excludes Maybe and No Response. |
| **Security Isolation** | Planner checks on every route | Stories 1–9 | Defined in Sec 3.1 & 7.2 | **Aligned** | Ownership check returning 404 for tenant isolation. |
| **CSV Injection Defense** | Prefix `= + - @` | Story 8 | Defined in Sec 5 & 7.4 | **Aligned** | Prepend single quote `'` on export. |

**Result**: 100% concordance across all three core documents. No orphaned routes, no missing story mappings, and no unaccounted rules.

---

## 2. Codebase Mapping & Status

- **Current Repository State**: Milestone 1 complete, audited via `/check`, debugged via `/debug`, and synchronized via `/sync`.
- **Completed Components**:
  - Full relational Drizzle ORM schema for all 8 tables with initial migration (`0000_steady_texas_twister.sql`).
  - Native Argon2id password hashing and session cookie authentication backend and frontend with `HttpOnly` and `SameSite=Strict`.
  - Multi-tenant wedding and function CRUD with planner ownership validation on every route returning 404 for tenant isolation.
  - Guest household management (manual entry, search, party size tallies, and unique 128-bit capability invite link generation).
  - Robust CSV import engine handling 10-digit Indian numbers, Devanagari/Hindi Unicode names, blank rows, quoted fields, UTF-8 BOM/CRLF, and a 2MB upload limit returning clean HTTP 413.
  - Defense-in-depth CSRF middleware protecting state-changing API endpoints.
  - Root `.gitignore` explicitly ignoring `.env`, `node_modules`, and build artifacts.
- **Test Suite Status**: 13 test files, 67 tests passing (100% pass rate), including real database integration tests for multi-tenant isolation, CSV edge cases, and CSRF protection.
- **TypeScript & Build Status**: `npm run lint` and `npm run build` succeed with zero errors across both `server` (tsc) and `client` (tsc + vite build).

---

## 3. Milestone 1 Verdict & Transition to Milestone 2

### **Milestone 1 Status: CHECKED, DEBUGGED & VERIFIED**
### **Ready for Milestone 2: YES**

**Milestone 2 Scope Ahead (Weeks 3–4)**:
- T2.1: `household_functions` schema & backend assignment APIs (map households to functions).
- T2.2: Function invitation management frontend (Assign households to functions via checklists and bulk actions).
- T2.3: Public invite token verification & scoping backend (Resolve household & invited functions by 128-bit unguessable token; token generated in T1.7).
- T2.4: WhatsApp share link generator (`wa.me/<phone>?text=...` with personalized invite message and link on household cards).
- T2.5: Public RSVP backend API (`GET /api/rsvp/:token`, `POST /api/rsvp/:token` with unique `(function_id, household_id)` upsert and dietary validation).
- T2.6: Rate limiting & security middleware for public RSVP routes.
- T2.7: Mobile-first Guest RSVP UI (Clean layout, Yes/No/Maybe selectors, veg/non-veg inputs).
- T2.8: Guest RSVP submission flow (Client-side validation, submit handling, confirmation view).
- T2.9: Audit log recording for RSVP updates.
