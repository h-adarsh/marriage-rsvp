# Wedding RSVP & Headcount App

A portfolio-grade MVP for wedding planners and couples to eliminate catering headcount guesswork.
It collects RSVPs per function via private, mobile-friendly links and calculates exact headcounts and dietary totals.
Demonstrates robust multi-tenant authorization, defense-in-depth security, and strict data integrity.

## Commands
```bash
# Install dependencies across all workspaces
npm install

# Run backend and frontend concurrently in development
npm run dev

# Run server only (port 5001) / client only (port 5173)
npm run dev:server
npm run dev:client

# Type check and build
npm run build

# Run unit and integration tests
npm test
npm run test:unit
npm run test:api

# Run database migrations
npm run db:migrate --workspace=server
```

## Folder Structure
- `client/`: React + TypeScript + Vite + Tailwind SPA (Planner dashboard & mobile RSVP).
- `server/`: Node.js + Express + TypeScript API with MySQL via Drizzle ORM.
- `docs/`: `PROJECT_CONTEXT.md`, `docs/SCOPE.md`, `docs/ARCHITECTURE.md`, `docs/AUDIT.md`.

## Coding & Security Rules
- **TypeScript Strict**: Enable `strict: true` in all tsconfigs; no implicit `any`.
- **Authorization Check**: Every planner route MUST verify `wedding.planner_id === session.planner_id`.
- **Token-Only Public Access**: Public RSVP routes only accept 128-bit tokens; no sequential IDs.
- **Server-Side Validation**: Validate all inputs on the server (types, bounds, dietary sum matches party size).
- **No Token/Phone Logging**: Never log invite tokens or raw guest phone numbers in logs.
- **CSV Defense**: Prepend `'` to export cells starting with `=`, `+`, `-`, or `@`.
- **Formulas**: Confirmed strictly excludes Maybe and No Response. Display calculation formula on screen.

## Out of Scope (Do Not Build in Phase 1)
- Automated WhatsApp Business API / automated reminders / SMS bots.
- Payments, subscriptions, or billing.
- AI/ML attendance prediction models.
- Native mobile apps, seating chart planners, vendor marketplace, multi-user planner teams.

## Documentation References
- Scope & acceptance criteria: `docs/SCOPE.md`
- System architecture, schema & APIs: `docs/ARCHITECTURE.md`
- Master project context: `PROJECT_CONTEXT.md`
