# AUDIT: Wedding RSVP & Headcount App

## 1. Documentation Alignment & Cross-Check Findings

Documentation was reviewed and synchronized across `PROJECT_CONTEXT.md`, `docs/SCOPE.md`, and `docs/ARCHITECTURE.md` as of Milestone 2 (Tasks T2.1–T2.8):

| Architectural & Functional Area | Specification / Implementation Status | Synchronized Location |
| :--- | :--- | :--- |
| **Planners Authentication** | Native Argon2id hashing, 7-day session cookies (`HttpOnly`, `SameSite=Strict`), dummy verification timing attack protection. | `ARCHITECTURE.md` Sec 3.1 & `SCOPE.md` Story 1 |
| **Multi-Tenant Boundaries** | All planner endpoints join on `planner_id` from session cookie; cross-tenant operations return uniform 404. | `ARCHITECTURE.md` Sec 3.1 & 7.2 |
| **Function Invitations Join** | Explicit `household_functions` join table differentiates "Not Invited" from "No Response". Delta updates (`add`/`remove`) with 500-household batch cap and IDOR validation. | `ARCHITECTURE.md` Sec 2.6 & `SCOPE.md` Story 4 |
| **Row-Level Concurrency Locks** | Symmetrical `SELECT ... FOR UPDATE` row locks on `household_functions` and `rsvps` in both unassign and RSVP submission transactions. | `ARCHITECTURE.md` Sec 7.2 |
| **RSVP Unique Constraint** | Database unique index `uq_rsvp_func_hh` on `(function_id, household_id)`. | `server/src/db/schema.ts` |
| **Public Capability URL Security** | 128-bit unguessable tokens; zero PII returned on lookup (`primary_contact_name` stripped); uniform 404 on malformed/unknown tokens; anti-leak headers (`Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`); dual-key rate limiters. | `ARCHITECTURE.md` Sec 3.1 & `SCOPE.md` Story 5 |
| **Token Revocation & Regeneration** | `POST /api/households/:id/regenerate-token` revokes compromised tokens and generates new unguessable tokens with audit logging. | `ARCHITECTURE.md` Sec 3.1 & `SCOPE.md` T2.4b |
| **Dietary Rules & Math Validation** | `veg + nonveg = party_size` enforced for `yes` RSVPs on both client and server; `maybe` captures estimated headcount; dietary notes capped at 500 chars. | `ARCHITECTURE.md` Sec 4 & `SCOPE.md` Story 6 |
| **Headcount vs Household Metrics** | Resolved dimensional conflict: Planning Estimate is strictly calculated in **Headcount (People)**: $E_F = C_F^{\text{headcount}} + \lfloor \frac{P}{100} \times M_F^{\text{headcount}} \rfloor$. Household counts are maintained as a separate operational metric. | `ARCHITECTURE.md` Sec 4 & `SCOPE.md` Story 7 |
| **Check-In Architecture Decoupling** | Dedicated `checkins` table specified for Milestone 4 to cleanly support venue walk-ins and unresponded arrivals without polluting `rsvps`. | `ARCHITECTURE.md` Sec 2 & 3.1 |
| **Audit Log Integrity** | `audit_log` records actor (`planner`/`guest`), action, and JSON diffs atomically inside same transaction as data mutations; cascade deleted on wedding deletion. | `ARCHITECTURE.md` Sec 2.8 |

---

## 2. Codebase Mapping & Status

- **Current Repository State**: Milestone 1 complete (T1.1–T1.10); Milestone 2 in progress (T2.1, T2.2, T2.3, T2.4b, T2.5, T2.7, T2.8 complete; T2.4 and M2 deploy pending).
- **Automated Test Suite Status**:
  - **Server**: **19 test files, 140 passing tests** in Vitest (including multi-tenant security, concurrency serialization, rate limiting, and transaction rollback).
  - **Client**: Static TypeScript verification via `npm run typecheck` (`tsc --noEmit`); client-side DOM unit tests are not yet configured in Vitest.
- **Code Quality**: `eslint server/src client/src` passes with 0 errors, 0 warnings.
- **Build Status**: Full production build (`tsc && vite build`) succeeds in <2.0s with 0 errors.

---

## 3. Milestone 2 Transition Status

- **Completed M2 Tasks**:
  - `T2.1`: `household_functions` assignment APIs with delta add/remove, IDOR checks, active RSVP protection, and row-level locks.
  - `T2.2`: Function invitation management frontend modal with Reset RSVP action.
  - `T2.3`: Public capability URL token lookup service with zero PII, anti-leak headers, and dual-key rate limiting.
  - `T2.4b`: Invite link revocation & token regeneration endpoint.
  - `T2.5`: Public RSVP submission API with `SELECT ... FOR UPDATE` row locks, dietary math validation, and concurrency test.
  - `T2.7 & T2.8`: Mobile-first Guest RSVP UI and submission flow (`/rsvp/:token`), Yes/No/Maybe selectors, live validation, and return-to-edit.
- **Upcoming Tasks**:
  - `T2.4`: WhatsApp share link generator (`wa.me/<phone>?text=...`).
  - `M2-Deploy`: Deployment verification on live domain.
  - `Milestone 3`: Real-time Headcount Dashboard & Caterer CSV Export (T3.1–T3.6).
