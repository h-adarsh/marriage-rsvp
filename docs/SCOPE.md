# SCOPE: Wedding RSVP & Headcount App

## 1. Goal
A portfolio-grade MVP that solves the wedding headcount guesswork for planners and families.
It collects RSVPs per function via private, mobile-friendly links and turns them into exact headcounts and dietary totals.
Built to showcase clean engineering, strict security practices, and reliable data integrity within free-tier constraints.

---

## 2. Clarifications & Open Questions
The following non-blocking questions from `PROJECT_CONTEXT.md` will be resolved as deployment approaches:
1. **App Name & Domain**: Working title "Wedding RSVP & Headcount App". Final domain to be decided before M4 deployment.
2. **Hosting Platform**: Target free-tier host (e.g., Render / Railway / Fly.io for Node backend, Vercel / Netlify for Vite frontend, PlanetScale / Aiven / Railway for MySQL).
3. **Pilot Event**: Select a real upcoming family event or wedding before M4 to validate real-world usage.

---

## 3. User Stories & Acceptance Criteria

### Story 1: Planner Authentication
> **As a planner**, I can register and log in with email and password so that my wedding data is secure and accessible only to me.

**Acceptance Criteria:**
- [x] Registration succeeds with a valid email and minimum 8-character password; duplicate emails are rejected with a clear message.
- [x] Login sets a secure, `httpOnly`, `sameSite=strict` session cookie upon correct credentials.
- [x] Failed login returns generic `401 Unauthorized` without revealing whether the email exists.
- [x] Passwords are never stored in plaintext (hashed using Argon2).
- [x] Logout invalidates the session and clears the session cookie.

---

### Story 2: Wedding & Functions Management
> **As a planner**, I can create a wedding and define multiple functions (e.g., Mehendi, Haldi, Sangeet, Wedding, Reception) so that events are organized individually.

**Acceptance Criteria:**
- [x] Planner can create a wedding with couple names and wedding date range.
- [x] Planner can add, edit, view, and delete multiple functions under a wedding (each having name, date/time, and venue/location).
- [x] Access control strictly prevents Planner A from viewing, editing, or deleting Planner B's wedding or functions (returns 403 or 404).
- [x] Deleting a wedding cascades cleanly to delete its functions, guests, invites, and RSVPs.

---

### Story 3: Guest & Household Management
> **As a planner**, I can add guest households manually or via CSV import with duplicate detection so that I maintain an organized guest registry.

**Acceptance Criteria:**
- [x] Planner can add a household with household name, primary contact name, phone number, expected party size, and optional notes.
- [x] Planner can upload a CSV file (columns: Household Name, Primary Contact, Phone, Expected Party Size).
- [x] CSV import flags duplicates matching existing records on phone number or normalized household name before committing.
- [x] CSV uploads exceeding 2MB or containing invalid formatting are rejected with descriptive errors.
- [x] Guest list displays all households with search and filter capabilities.

---

### Story 4: Function Invitation Assignment
> **As a planner**, I can select which households are invited to which specific functions so that sub-events have tailored guest lists.

**Acceptance Criteria:**
- [x] Planner can assign or unassign households to individual functions singly or in bulk with transaction atomicity.
- [x] The system distinguishes between "Not Invited" (no mapping exists) and "No Response" (invited, but no RSVP submitted).
- [x] Attendance protection locks uninviting households with confirmed attendance ('yes'/'maybe'), while allowing frictionless uninviting for 'no' responses and providing a dedicated Reset RSVP action.
- [ ] Changes to invitation assignments are recorded in the audit log.

---

### Story 5: Private Household Link & WhatsApp Share
> **As a planner**, I can generate an unguessable private invite link and a prefilled WhatsApp share link per household so that I can send personal invites manually.

**Acceptance Criteria:**
- [ ] Each household is assigned a cryptographically random, unguessable invite token (at least 128 bits / 32 hex characters).
- [ ] Planner can copy the direct URL (`/rsvp/:token`).
- [ ] Planner can click a "Share via WhatsApp" button that triggers a `wa.me/<phone>?text=<encoded_message>` containing the personalized invite link and greeting.
- [ ] Public RSVP routes only accept the token; no sequential IDs are exposed in URLs.

---

### Story 6: Mobile-Friendly Guest RSVP Submission
> **As a guest**, I can open the private link on my phone and submit/update RSVPs for my invited functions without an account so that the planner knows who is attending.

**Acceptance Criteria:**
- [ ] Accessing `/rsvp/:token` displays only the functions that this specific household was invited to attend.
- [ ] For each function, guest can choose status: `yes`, `no`, or `maybe`.
- [ ] When status is `yes`, guest specifies `party_size` ($\ge 1$), `veg_count`, and `nonveg_count`.
- [ ] Validation enforces `veg_count + nonveg_count == party_size` on both client and server.
- [ ] Negative party sizes, oversized inputs, or invalid tokens are rejected with HTTP 400/404.
- [ ] Guests can revisit the token link to update an earlier response; the existing function RSVP row is updated without creating duplicate entries.

---

### Story 7: Real-Time Headcount Dashboard & Planning Estimate
> **As a planner**, I can view clear headcount totals and an adjustable planning estimate per function so that I have dependable numbers for catering.

**Acceptance Criteria:**
- [ ] Dashboard displays counts per function: Invited households, Confirmed headcount ($\sum \text{party\_size}$ where status = `yes`), Declined count, Maybe count, and No Response count.
- [ ] Confirmed headcount strictly excludes "Maybe" and "No Response" entries.
- [ ] Veg and Non-Veg totals are calculated exclusively from Confirmed guests.
- [ ] Planning Estimate is calculated and displayed as: $\text{Confirmed} + (P\% \times \text{Maybe count})$, where $P$ is planner-adjustable (default 50%, with 0% of No Response). The exact formula and percentage are visible on screen.
- [ ] RSVPs not updated for $N$ days (configurable, default 14) are marked with a "Stale" indicator badge.

---

### Story 8: Caterer CSV Export
> **As a planner**, I can export headcount summaries and detailed dietary lists to CSV so that I can provide them to catering vendors.

**Acceptance Criteria:**
- [ ] Generates a cleanly formatted CSV including export timestamp, function name, summary headcount (confirmed, veg, non-veg), and detailed guest breakdown.
- [ ] CSV formula injection defense neutralizes cells starting with `=`, `+`, `-`, or `@` by prepending a quote (`'`).
- [ ] Filename contains the wedding name, function name, and export timestamp.

---

### Story 9: Venue Check-In Screen
> **As a planner**, I can use a simple check-in interface on mobile at the venue to record arrivals and compare actual attendance with confirmed RSVPs.

**Acceptance Criteria:**
- [ ] Fast search by household or primary contact name for guests invited to that function.
- [ ] One-tap check-in toggle with ability to record the actual arrived party size.
- [ ] Real-time counter showing: Confirmed RSVPs vs. Actual Arrived guests.

---

## 4. Ordered Task List & Estimates

### Milestone 1: Setup, Auth, Weddings, Functions & Guest CRUD (Weeks 1–2) — [COMPLETED]
- [x] **T1.1**: Project initialization & structure setup (Node.js/Express TypeScript backend, Vite/React TypeScript frontend, Tailwind CSS, linting configs). *[2.0h]*
- [x] **T1.2**: Database schema foundation with MySQL & Drizzle ORM (`planners`, `weddings`, `functions`, `audit_log`, `households`, `household_functions`, `rsvps`, `sessions`) and initial migrations. *[2.0h]*
- [x] **T1.3**: Planner authentication backend (Argon2 hashing, session cookie management, `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`). *[2.0h]*
- [x] **T1.4**: Planner auth frontend (Registration and login pages, AuthContext, protected route guard). *[2.0h]*
- [x] **T1.5**: Wedding & Function backend endpoints (CRUD for weddings and functions, strict planner ownership validation). *[2.0h]*
- [x] **T1.6**: Wedding & Function frontend views (Wedding setup wizard, function creation and edit forms). *[1.5h]*
- [x] **T1.7**: Household schema & backend CRUD (`households` table, `/api/weddings/:id/households`, planner ownership check). *[2.0h]*
- [x] **T1.8**: Household list & manual entry frontend (Household management screen, manual add modal, search filter). *[2.0h]*
- [x] **T1.9**: CSV import backend (Multipart upload, 2MB size cap, row validation, duplicate check matching phone/name). *[2.0h]*
- [x] **T1.10**: CSV import frontend (Upload dropzone, import preview table, duplicate warning prompt, error banners). *[2.0h]*
*M1 Subtotal: 19.5 hours (All 10 tasks completed)*

---

### Milestone 2: Invitations per Function, Private Links & Mobile RSVP (Weeks 3–4)
- [x] **T2.1**: `household_functions` backend assignment APIs (`GET /api/functions/:id/invitations`, `POST /api/functions/:id/invitations` with bulk IDOR verification across weddings, batch cap of 500, idempotency, mode exclusivity, and protection preventing unassigning households with active RSVPs). *[2.0h]*
- [x] **T2.2**: Function invitation management frontend (Assign households to functions via checklists, delta save, bulk actions, and Reset RSVP action). *[2.0h]*
- [x] **T2.3**: Public token lookup & verification service (Finds household by 128-bit token, dual-key rate limiting with strict invalid token per-IP limit and generous valid lookup limit, reads `TRUST_PROXY` from env var, returns uniform 404 for invalid/unknown tokens, minimal response payload with zero PII, anti-leak headers: `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`). *[1.5h]*
- [x] **T2.4b**: Invite link revocation & token regeneration endpoint (`POST /api/households/:id/regenerate-token`, invalidates leaked token, issues new unguessable 128-bit token, tests that old token returns 404 - must be built before public deploy). *[1.0h]*
- **T2.5**: Public RSVP submission API (`POST /api/rsvp/:token` with `SELECT ... FOR UPDATE` row lock on `household_functions`, `veg + nonveg = party_size` validation, and concurrency test). *[2.0h]*
- **T2.7 & T2.8**: Mobile-first Guest RSVP UI & submission flow (Mobile layout, function list cards, Yes/No/Maybe selectors, veg/non-veg inputs, instant validation, confirmation view, return-to-edit). *[2.5h]*
- **M2-Deploy**: Deployment to free-tier hosting (Verify cookie, CORS, origin, and capability URLs on live domain). *[1.0h]*
- **T2.4**: WhatsApp share link generator (`wa.me/<phone>?text=...` with personalized invite message and live domain link on household cards). *[1.5h]*
- **T2.9**: Audit log recording for guest RSVP submissions and updates (tracking timestamp, changes, source). *[1.0h]*
*M2 Subtotal: 17.5 hours*


---

### Milestone 3: Headcount Dashboard, Planning Estimate & CSV Export (Weeks 5–6)
- **T3.1**: Headcount calculation queries & backend endpoint (`/api/functions/:id/headcount` for confirmed, declined, maybe, no response, veg/non-veg totals). *[2.0h]*
- **T3.2**: Planning estimate calculation & stale RSVP flagging logic (configurable $N$ days, default 14; estimate formula). *[1.5h]*
- **T3.3**: Planner Dashboard UI (Function switcher, summary cards for Confirmed, Declined, Maybe, No Response, Veg/Non-Veg). *[2.0h]*
- **T3.4**: Planning estimate interactive controls UI (Adjustable Maybe % slider, explicit formula explanation banner). *[1.5h]*
- **T3.5**: Stale RSVP indicators & filters on dashboard and guest lists. *[1.5h]*
- **T3.6**: Caterer CSV export backend (Stream/build CSV, formatted caterer header, formula injection neutralization for `= + - @`). *[2.0h]*
- **T3.7**: Caterer CSV export button & download trigger in dashboard. *[1.0h]*
*M3 Subtotal: 11.5 hours*

---

### Milestone 4: Check-In Screen, Security Pass, Tests & Deploy (Weeks 7–8)
- **T4.1**: Check-in backend endpoint (`/api/functions/:id/checkin`, toggle checked-in state, update actual arrival count). *[2.0h]*
- **T4.2**: Mobile check-in UI (Fast name search, tap-to-check-in, actual party size adjuster, live confirmed vs. arrived tally). *[2.0h]*
- **T4.3**: Security review pass (Verify wedding ownership checks on every planner route, verify no token leaks in logs, test rate limits). *[2.0h]*
- **T4.4**: Test suite implementation (Vitest unit tests for headcount/estimate formulas, Supertest for auth & tenant isolation, Playwright for end-to-end invite-to-RSVP flow). *[2.0h]*
- **T4.5**: Production build & deployment setup (Environment configuration, Docker/build scripts, deployment to free-tier hosting). *[2.0h]*
*M4 Subtotal: 10.0 hours*

---

### Buffer & Documentation (Weeks 9–10)
- **TB.1**: Bug fixing, edge-case UI polish, empty states, and responsive styling adjustments. *[4.0h]*
- **TB.2**: Documentation suite (`README.md`, `docs/USAGE.md`, `CHANGELOG.md`) and demo walk-through video/GIF preparation. *[4.0h]*
*Buffer Subtotal: 8.0 hours*

---

## 5. Not Building (Out of Scope for MVP)
As strictly defined in `PROJECT_CONTEXT.md`, the following are excluded from Phase 1:
- Automatic WhatsApp messaging via WhatsApp Business API / Twilio / automated SMS.
- Payment gateways, billing, deposits, or subscription management.
- AI or machine-learning-based attendance predictions.
- Native iOS/Android mobile apps.
- Seating chart planners, table assignments, or floor plan builders.
- Vendor marketplace or vendor coordination messaging.
- Multi-user planner teams, permissions, or role-based access control.
- Microservices, distributed message queues, Kafka, RabbitMQ, or Kubernetes.
- Per-guest individual dietary breakdown (kept at household aggregate level for MVP).

---

## 6. Risks & Mitigations

| Risk | Probability | Impact | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| **1. Cross-Tenant Data Leakage** (Planner A accesses Planner B's wedding/guest data via ID manipulation) | Med | Critical | Implement an authorization middleware on every planner route that explicitly verifies wedding ownership via `planner_id`. Enforce with automated Supertest security tests. |
| **2. CSV Formula Injection / Malicious Import Data** | Med | High | Sanitize and prefix formula characters (`=`, `+`, `-`, `@`) upon export; validate strict types and length limits on all imported CSV columns upon ingestion. |
| **3. Guest RSVP Form Confusion / Validation Drop-off** | High | Med | Keep the mobile RSVP form frictionless: zero login, clear toggle buttons for Yes/No/Maybe, and instant client-side math showing `Veg + Non-Veg == Party Size`. |
| **4. Database Schema Rework Due to Invitation Nuances** | Low | High | Fix data model upfront as specified: use distinct `household_functions` join table so "Not Invited" is never confused with "No Response". |
| **5. Scope Creep into Phase 2 Features (Auto WhatsApp / Payments)** | High | Med | Strictly enforce the "Not Building" list during `/develop` and reject features not explicitly declared in this document. |

---

## 7. Summary & Next Steps

- **Total Estimated Hours**: **65.0 hours** (inclusive of buffer).
- **Available Hours**: **80 – 100 hours** (8–10 weeks @ 1-2 hours/day, ~10 hours/week).
- **Feasibility Assessment**: The estimated 65 hours provides a comfortable ~25-hour safety margin within the 8-10 week timeframe.

### First 3 Tasks to Start With:
1. **T1.1**: Project initialization & structure setup (Express TypeScript backend + Vite React TypeScript frontend monorepo).
2. **T1.2**: Database schema foundation with MySQL & Drizzle ORM (`planners`, `weddings`, `functions`, `audit_log`).
3. **T1.3**: Planner authentication backend (Argon2 hashing, session cookie management, auth endpoints).
