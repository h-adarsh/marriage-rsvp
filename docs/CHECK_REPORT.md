# Milestone 1 Check Report

**Date:** 2026-10-28  
**Scope Checked:** Milestone 1 (T1.1 through T1.10 - Monorepo, Database, Auth, Weddings, Functions, Households, CSV Import, Security & Isolation)  
**Environment:** Node.js v22, MySQL 8.0 (Docker container `wedding-mysql`), Express API on `localhost:5001`, React + Vite SPA on `localhost:5173`.

---

## 1. Commands Run and Results

| Command | Status | Notes / Output |
| :--- | :--- | :--- |
| `npm run lint` | **FAIL** | Missing script `"lint"` in root `package.json`. No linter configured. |
| `npm run build` | **PASS** | `tsc` (server) and `tsc && vite build` (client) succeeded with 0 errors. |
| `npm test --workspace=server` | **PASS** | 10 test files, 46 tests passing (primarily Zod validation tests). |
| `docker ps` | **PASS** | `wedding-mysql` up on `0.0.0.0:3306->3306`. |
| `mysql SHOW TABLES` | **PASS** | 8 tables present: `planners`, `sessions`, `weddings`, `functions`, `households`, `household_functions`, `rsvps`, `audit_log`. |
| Live multi-tenant cross-access test | **PASS** | 11/11 endpoints returned 404 when Planner B attempted to read, update, or delete Planner A's wedding, functions, or households. |
| Live CSV import stress test | **FAIL** | Hindi names triggered false duplicates; file > 2MB returned 500 instead of 413; `+91` vs 10-digit phone equivalence failed. |
| Cookie security audit | **PASS** | `HttpOnly=true`, `SameSite=Strict`, `Secure=false` in dev (true in prod). |
| CSRF & secret hygiene audit | **FAIL** | No CSRF protection / custom header required on mutating routes; root `.gitignore` is missing so `.env` is unignored. |

---

## 2. Acceptance Criteria Table (Milestone 1)

| Area | Acceptance Criterion | Result | Evidence |
| :--- | :--- | :--- | :--- |
| **Auth** | Planner registration & login with Argon2id + dummy verify | **PASS** | Registered `alice@test.com`, verified password hash with Argon2id, dummy verify executed on nonexistent emails. |
| **Auth** | Session stored in DB with 7-day expiry & cookie | **PASS** | Session record created in `sessions` table, `sessionId` cookie returned with `HttpOnly` and `SameSite=Strict`. |
| **Tenant Isolation** | Planner A cannot read, edit, or delete Planner B's wedding | **PASS** | Planner B attempting `GET/PUT/DELETE /api/weddings/:id` returns `404 Not Found`. |
| **Tenant Isolation** | Planner A cannot add/edit/delete functions under Planner B's wedding | **PASS** | Planner B attempting function CRUD on Planner A's wedding returns `404 Not Found`. |
| **Tenant Isolation** | Planner A cannot add/edit/delete households under Planner B's wedding | **PASS** | Planner B attempting household CRUD on Planner A's wedding returns `404 Not Found`. |
| **Households** | 128-bit unguessable invite token generated per household | **PASS** | `households.invite_token` has 32 hex chars (128-bit CSPRNG `crypto.randomBytes(16)`). |
| **CSV Import** | Accepts standard 10-digit Indian numbers without country code | **PASS** | `9876543210` parses cleanly as valid row. |
| **CSV Import** | Disallows identical phone or name within batch or DB | **PASS** | Intra-batch duplicate phone and DB duplicate phone flagged in `duplicates` array. |
| **CSV Import** | Handles blank lines and quoted fields with commas | **PASS** | Intermediate and trailing blank lines ignored; `"Gupta, Mr. & Mrs."` with commas in quotes preserved. |
| **CSV Import** | Handles non-ASCII / Devanagari Hindi guest names | **FAIL** | `normalizeName` strips all non-ASCII characters (`[^a-z0-9]`), collapsing all Hindi names into `""` and triggering false duplicate rejection. |
| **CSV Import** | Equivalence between `9876543210` and `+919876543210` | **FAIL** | `normalizePhone` does not normalize country codes. `+919876543210` and `9876543210` do not match in duplicate detection. |
| **CSV Import** | Enforces 2MB upload limit gracefully | **FAIL** | Uploading >2MB file causes uncaught `MulterError: File too large` returning HTTP 500 with stack trace rather than clean 413. |
| **Security** | Secrets exclusion in version control | **FAIL** | Project lacks `.gitignore`. `.env` containing DB credentials and session secret is untracked and vulnerable to commit. |
| **Security** | Anti-CSRF defense on mutating endpoints | **FAIL** | Mutating endpoints (`POST`, `PUT`, `DELETE`) accept requests without checking custom headers (`X-Requested-With`) or anti-CSRF tokens. |

---

## 3. Bugs Found

### Bug B1 (Blocker): Non-ASCII / Hindi Names Cause False Duplicate Detection
- **Severity:** Blocker
- **How to Reproduce:**
  1. Upload a CSV containing two different Hindi household names:
     - Row 2: `कपूर परिवार,अदिति शर्मा,+919876500030,4,शाकाहारी`
     - Row 3: `मेहता परिवार,राजेश मेहता,+919876500031,2,जैन खाना`
  2. Send `POST /api/weddings/:id/households/import-csv?dryRun=true`.
- **Expected:** Both rows parsed as valid, distinct households. `duplicates: []`.
- **Actual:** Row 3 is flagged as duplicate: `reason: "Duplicate household name within the uploaded file"`.
- **Root Cause:** In [csv.ts](file:///Users/adarshsingh/Desktop/project/server/src/services/csv.ts#L83), `normalizeName` uses `name.toLowerCase().replace(/[^a-z0-9]/g, '')`. This strips all Unicode/Devanagari characters, reducing every Hindi name to empty string `""`. When the second row is processed, `seenNames.has("")` evaluates to `true`.

---

### Bug B2 (Major): Over-2MB File Upload Throws HTTP 500 With Stack Trace
- **Severity:** Major
- **How to Reproduce:**
  1. Generate a CSV file slightly larger than 2MB (> 2,097,152 bytes).
  2. Send `POST /api/weddings/:id/households/import-csv`.
- **Expected:** HTTP 413 Payload Too Large with JSON `{ error: "File exceeds 2MB limit" }`.
- **Actual:** HTTP 500 Internal Server Error returning raw Multer exception stack trace.
- **Root Cause:** Express global error handler does not inspect `err.name === 'MulterError'` or `err.code === 'LIMIT_FILE_SIZE'` to set HTTP 413.

---

### Bug B3 (Major): Missing Root `.gitignore` Exposes `.env` to Git
- **Severity:** Major
- **How to Reproduce:**
  1. Inspect directory `/Users/adarshsingh/Desktop/project/.gitignore`.
  2. Observe file does not exist.
  3. Running `git status` shows `.env` untracked.
- **Expected:** `.gitignore` present, explicitly ignoring `.env`, `node_modules`, `dist`, and OS metadata (`.DS_Store`).
- **Actual:** No `.gitignore`. Plaintext `.env` with database credentials and session secrets is exposed.

---

### Bug B4 (Major): Phone Number Equivalence Failure in Duplicate Detection
- **Severity:** Major
- **How to Reproduce:**
  1. Add a household with phone `+919876543210` via API.
  2. Import a CSV containing the same guest with phone `9876543210` (standard 10-digit format).
- **Expected:** Duplicate detection flags the matching phone number.
- **Actual:** Duplicate detection reports 0 duplicates because `"9876543210" !== "+919876543210"`.
- **Root Cause:** [csv.ts](file:///Users/adarshsingh/Desktop/project/server/src/services/csv.ts#L75) only removes spaces and dashes. It does not normalize 10-digit Indian numbers to E.164 (`+91`) or compare the last 10 digits.

---

### Bug B5 (Minor): Missing CSRF Defense / Custom Header Requirement on Mutating Routes
- **Severity:** Minor
- **How to Reproduce:**
  1. Authenticate a session and obtain cookie `sessionId`.
  2. Dispatch a cross-site mutating request (`POST /api/weddings`) without custom headers.
- **Expected:** Defense-in-depth rejects mutating requests lacking expected origin or custom application headers (e.g., `X-Requested-With`).
- **Actual:** Request succeeds. While `SameSite=Strict` is configured on modern browsers, no defense-in-depth layer exists on the API for older clients or form-based vectors.

---

### Bug B6 (Minor): Missing Lint Script in Monorepo
- **Severity:** Minor
- **How to Reproduce:**
  1. Run `npm run lint`.
  2. Observe `Missing script: "lint"`.
- **Expected:** A functioning linting command or clear documentation of static analysis scripts.
- **Actual:** Only `build` (`tsc`) exists; no ESLint configuration.

---

## 4. Security Findings
1. **Multi-Tenant Ownership:** **STRONG.** Verified that all wedding, function, and household mutating and reading endpoints strictly filter by `planner_id` via `getOwnedWedding`, `getOwnedFunction`, and `getOwnedHousehold`. Cross-tenant ID enumeration returns 404.
2. **Session Security:** **STRONG.** Argon2id hashing with 64MB memory cost, 3 iterations; dummy verify for constant-time comparison on nonexistent accounts; cookie marked `HttpOnly` and `SameSite=Strict`.
3. **Defense Gaps:**
   - `.env` unprotected by `.gitignore`.
   - Missing error handler for Multer file size exhaustion.
   - Missing custom header / CSRF defense on state-changing endpoints.

---

## 5. Scope Alignment & Overlap
- **T1.7 vs T2.3 Overlap:** 128-bit unguessable tokens (`invite_token`) were implemented in T1.7 and verified in database and API. T2.3 in `docs/SCOPE.md` currently re-lists "128-bit invite token generation". This must be updated in `/sync` so T2.3 focuses strictly on public token retrieval and lookup, rather than redundant token generation.
- **Copy Link on Household Card:** Household list currently offers "Copy Link" pointing to `/rsvp/:token`. Because `/rsvp/:token` is a Milestone 2 deliverable, clicking or pasting the link currently yields a 404 until T2.7 is built. This is normal phased development, but needs to be documented clearly.

---

## 6. Verdict (Milestone 1 Resolution)
**RESOLVED & ACCEPTED (`v0.1.1`).**  
All 6 bugs (B1 through B6) were fixed, tested, and verified. 80 server tests passing, 0 type errors, 0 lint warnings.

---

# Milestone 2 Check Report (Tasks T2.1 & T2.2)

**Date:** 2026-10-28  
**Scope Checked:**
- **T2.1**: `household_functions` backend assignment APIs with transaction atomicity, race condition prevention, input mode exclusivity, IDOR defense, and RSVP protection.
- **T2.2**: Function invitation management frontend with checklist tabs, delta save, Reset RSVP action, and unlocked declined replies.
- **CSV Engine Hardening**: `fileHash` integrity verification, capped integer validation, and negative unit tests for name+contact overrides.
- **Database Test Separation**: Dedicated `wedding_rsvp_test` database routing for test isolation.

---

## 1. Commands Run and Results

| Command | Status | Notes / Output |
| :--- | :--- | :--- |
| `npm run typecheck` | **PASS** | 0 errors across server and client workspaces. |
| `npm run lint` | **PASS** | 0 errors, 0 warnings across `server/src` and `client/src`. |
| `npm test --workspace=server` | **PASS** | **14 test files, 101 passing tests** (86 → 95 → 101 tests, covering all review scenarios). |
| `manage_task list` | **PASS** | Confirmed 0 scheduled timers or cron jobs; only dev server daemon running. |
| MySQL Schema Verification | **PASS** | `uq_household_function` confirmed in `0000_steady_texas_twister.sql` line 33 and `server/src/db/schema.ts` line 99. |
| Test DB Migrations | **PASS** | `drizzle-kit migrate` executed cleanly on empty `wedding_rsvp_test` database. |

---

## 2. Review Findings & Fixes Matrix

| Feedback Item | Issue / Gap | Fix Implemented | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Schedule tool audit** | Unreported `schedule` tool call in log | One-shot wait timer from step 884 ended; audited running background tasks (`manage_task list`) confirming 0 active timers or cron tasks. | `manage_task list` output: only `task-422` (dev daemon) is active. |
| **T2.2 Dead-end tooltip** | "Cannot uninvite without resetting RSVP" with no reset feature | Built `POST /api/functions/:id/rsvps/:householdId/reset` backend endpoint and added "Reset RSVP" button in modal next to replied guests. | Tested in `function_invitations.test.ts` (reset then uninvite succeeds). |
| **T2.2 Locking 'No' replies** | Declining has 0 headcount to protect; locking blocked planners | Unlocked 'no' replies in UI and backend: uninviting 'no' replies is permitted and deletes the decline record atomically. Only 'yes' and 'maybe' are locked. | Tested in `function_invitations.test.ts` (`allows uninviting a household that replied "no"`). |
| **T2.2 Missing backend test** | `GET /invitations` returned `rsvpStatus` without tests | Added test in `function_invitations.test.ts` verifying uninvited, pending, yes (with headcount), and no (with 0 headcount). | `GET /api/functions/:id/invitations returns accurate rsvpStatus and partySize for all states` passes. |
| **Reset RSVP Cross-Planner Check** | Route needed verification that function belongs to planner and household belongs to same wedding | Checked in route handler and added automated cross-planner security tests. | `cross-planner protection: Planner B cannot reset Planner A RSVP (returns 404)` and `cross-wedding protection: cannot reset household from another wedding (returns 404)`. |
| **Reset RSVP Audit Logging & Confirm** | Erasing guest responses risks data loss | Added `window.confirm` in client modal and recorded `audit_log` entries on both RSVP resets and declined uninvites. | Verified in `function_invitations.test.ts` checking `audit_log` table insertion. |
| **Real Transaction Rollback Proof** | Previous test only checked pre-write validation abort | Added real transaction rollback test: executes `tx.delete(householdFunctions)` inside transaction, verifies delete occurred inside tx, throws error, and proves outside tx that row remained intact. | `proves database transaction rollback: mutations are rolled back when an error is thrown midway` passes. |
| **T2.1 Race condition** | Guest could reply between read and delete | Placed in transaction; row lock `SELECT ... FOR UPDATE` scheduled for T2.5 when guest RSVP endpoint is introduced. | Criteria formally recorded in T2.5 scope with concurrency test. |
| **T2.1 Input modes & conflicting IDs** | `add`, `remove`, and `householdIds` could be mixed or have overlapping IDs | Added Zod schema refinements enforcing mutual exclusivity (cannot mix `householdIds` with `add`/`remove`) and rejecting requests with the same ID in both `add` and `remove`. | Integration tests in `function_invitations.test.ts` assert 400 for mixed modes and overlapping IDs. |
| **T2.1 IDOR on delta lists** | Cross-wedding check only verified `householdIds` | Updated IDOR check to verify all IDs referenced in `add`, `remove`, and `householdIds`. | Integration tests assert 400 for foreign IDs in both `add` and `remove`. |
| **CSV Override safety** | Server did not enforce file integrity or capped integers; no negative test for name+contact | Added `fileHash` (SHA-256) check between preview and commit, capped integer validation (max 500 rows, >= 2), and negative unit test proving name+contact collisions can never be overridden. | `tests/unit/csv.test.ts` and `csv_robustness.test.ts` (mismatch hash test & invalid overrideRows test). |
| **Test Database Separation** | Tests shared `wedding_rsvp` development database | Created `wedding_rsvp_test` in MySQL Docker container; updated `server/src/db/index.ts` to strictly require database name ending in `_test`. | All 101 server tests run against isolated test database; dev DB test data cleaned. |
| **Password Hygiene** | Root password was logged on command line (`-ppassword`) | Switched all Docker MySQL commands to use `MYSQL_PWD` environment variable or `.env` file; zero passwords exposed in command arguments or documentation. | Clean terminal invocations. |

---

## 3. Verdict
**READY TO PROCEED TO T2.3.**  
All review criteria for T2.1 and T2.2 are resolved, verified by automated tests (101 passing), and committed with atomic commits.


