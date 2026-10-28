# PROJECT CONTEXT: Wedding RSVP & Headcount App (working title)

Every command reads this file first. If something here is wrong, fix it here, not in the code.

## 1. Goal
- Phase 1: a portfolio MVP that works end to end and shows good engineering and security work.
- Phase 2 (later, only if Phase 1 gets real users): grow into a paid SaaS for wedding planners.
- Do NOT build Phase 2 features in Phase 1. Design so they can be added, but do not build them.

## 2. Constraints
- One developer, 1-2 hours per day (about 10 hours per week).
- Realistic time to MVP: 8-10 weeks. The blueprint's "4 weeks" assumed full-time work. Ignore it.
- Budget: close to zero. Free tiers only.
- Every task must fit in one 1-2 hour session. If it does not, split it.

## 3. The problem
- Families and planners guess guest counts for catering. Guesses are unreliable.
- The app collects RSVPs per wedding function and turns them into a clear headcount.
- The app does NOT promise savings or less food waste. It only improves the information.

## 4. Users
- Planner (main user): logs in, manages weddings, guests, functions, and dashboard.
- Guest (no account): opens a private link, answers RSVP on a phone.
- Families are a secondary user. Same product, no separate app.

## 5. MVP scope

### In scope
1. Planner login (email + password).
2. Create wedding with multiple functions (haldi, mehendi, wedding, reception, etc.).
3. Guest list: add manually, CSV import, group by household, duplicate check.
4. Choose which households are invited to which function.
5. Private invite link per household + prefilled WhatsApp share link (planner sends it manually).
6. Mobile-friendly RSVP page, no guest account. RSVP is per function: yes / no / maybe, party size, veg / non-veg counts.
7. Dashboard per function: invited, confirmed, declined, maybe, no response, veg / non-veg totals, last updated.
8. CSV export for the caterer with clear labels and timestamp.
9. Simple check-in screen (to compare final RSVPs with real arrivals).

### Out of scope (do not build)
- WhatsApp Business API / automatic sending / automatic reminders
- Payments, billing, subscriptions
- AI or ML attendance prediction
- Native mobile app, seating planner, vendor marketplace
- Multi-user planner teams
- Microservices, queues, Kubernetes

## 6. Attendance numbers (strict rules)
- Confirmed headcount = sum of party_size where status = yes.
- Declined = count where status = no.
- Maybe and No response are shown separately. Never add them into confirmed.
- Planning estimate = confirmed + a stated percentage of maybe. The percentage and method must be shown on screen. Default: 50% of maybe, 0% of no response. The planner can change it.
- A stale RSVP (old, not updated for N days) is flagged. N is configurable, default 14.

## 7. Tech stack
- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node.js + Express + TypeScript
- Database: MySQL + Drizzle ORM
- Auth: email + password, argon2 hashing, httpOnly session cookie. No third-party auth library.
- Tests: Vitest (unit), Supertest (API), Playwright (one or two end-to-end flows)
- Hosting: pick the cheapest option that gives a public URL. A background worker is NOT needed in MVP.

## 8. Data model rules (fixes to the blueprint's draft)
- Add a `planners` table. The blueprint's `planner_id` pointed at nothing.
- Add a `household_functions` table (household_id, function_id) to record who is invited to what. Without it, you cannot tell "not invited" from "no response".
- RSVP is one row per (function, household). Unique constraint on that pair.
- Dietary counts stay at household level in MVP (veg_count + nonveg_count must equal party_size when status = yes). Per-guest diet is Phase 2.
- Add `audit_log` (who changed what, when) from day one. Cheap now, painful later.
- Invite token: random, at least 128 bits, unique index, scoped to one household. Decision: store the token itself in MVP so the planner can re-copy the link. Note the tradeoff in ARCHITECTURE.md: a database leak exposes all links. Revisit in Phase 2.

## 9. Security requirements (this is what makes the project stand out)
- Every planner API route checks that the wedding belongs to the logged-in planner. No exceptions.
- Public RSVP routes only accept the token. No sequential IDs in any public URL.
- Rate limit the RSVP and login routes.
- Validate all input on the server (length, type, ranges, party_size >= 0, diet counts add up).
- CSV import: limit file size, reject formulas that start with = + - @ in exports (CSV injection).
- Never log tokens or phone numbers.
- Guest names and phone numbers are personal data. Collect only what is needed, allow deletion of a wedding and all its data. Note the DPDP Act in the docs as a Phase 2 item to check properly.
- Write a short THREAT_MODEL section in ARCHITECTURE.md.

## 10. Milestones (about 10 hours per week)
- M1 (weeks 1-2): project setup, planner auth, wedding + functions, guest CRUD, CSV import, duplicate check.
- M2 (weeks 3-4): invitations per function, private links, mobile RSVP page.
- M3 (weeks 5-6): dashboard, planning estimate, CSV export, WhatsApp share links.
- M4 (weeks 7-8): check-in screen, security pass, tests, deploy, README.
- Buffer (weeks 9-10): bugs, polish, demo video.

## 11. Definition of done (portfolio MVP)
- A stranger can open the live URL, create a wedding, import guests, share a link, RSVP from a phone, and see the dashboard update.
- Tests pass. Authorization tests prove one planner cannot read another planner's wedding.
- README has: what it is, screenshots, how to run, architecture diagram, security notes, known limits.
- At least 1 real wedding or event used it, or the limits are honestly stated if not.

## 12. Workflow and files
Order: /scope -> /architect -> /audit -> /develop -> /test -> /check -> /debug -> /sync -> /document

| Command | Reads | Writes |
| --- | --- | --- |
| /scope | PROJECT_CONTEXT.md | docs/SCOPE.md |
| /architect | docs/SCOPE.md | docs/ARCHITECTURE.md |
| /audit | all docs + code | docs/AUDIT.md, CLAUDE.md |
| /develop | SCOPE, ARCHITECTURE, AUDIT | source code |
| /test | spec + code | test files |
| /check | code + tests | docs/CHECK_REPORT.md |
| /debug | CHECK_REPORT.md | code fixes |
| /sync | everything | docs updates |
| /document | everything | README.md, docs/USAGE.md, CHANGELOG.md |

## 13. Open questions (answer these as they come up)
- App name and domain.
- Where it will be hosted.
- Which real wedding or event will be used for the pilot.
