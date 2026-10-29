# marriage-rsvp

A portfolio-grade Wedding RSVP & Headcount Web App for wedding planners and couples to eliminate catering headcount guesswork.

Collects RSVPs per function via private, mobile-friendly links and calculates exact headcounts and dietary totals.

## Technology Stack
- **Backend**: Node.js, Express, TypeScript, MySQL 8.0, Drizzle ORM
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router v7
- **Security**: Argon2id password hashing, SHA-256 session token hashing at rest, HttpOnly & SameSite=Strict cookies, CSRF origin/referer protection, CSP (`frame-ancestors 'none'`, `script-src 'self'`), `X-Powered-By` disabled, multi-tenant isolation, 128-bit unguessable capability URLs
- **Testing**: Vitest, Supertest (**25 server test suites, 205 passing tests** passing under `TZ=UTC`, `TZ=America/New_York`, and local machine timezones). Client workspace relies on strict TypeScript typechecking (`npm run typecheck`); no client DOM automated unit tests are configured.

## Phone Number & WhatsApp Integration
- **Indian Phone Support**: Phone numbers are normalized to 10 digits with standard `+91` country code. Non-digit characters, leading zeros, and spaces are automatically stripped.
- **WhatsApp Share Direct Link**: The WhatsApp share button generates direct `https://wa.me/91XXXXXXXXXX?text=...` links for pre-filling invite links.
- **Graceful Fallback**: For households without a recorded phone number, the share button automatically falls back to `https://wa.me/?text=...`, opening WhatsApp's native contact selector so planners can select the contact on their phone.

## Timezone Architecture
- **Per-Wedding Timezone**: Each wedding stores its venue timezone as an IANA timezone identifier (e.g. `'Asia/Kolkata'`, `'Asia/Dubai'`, `'Europe/London'`, `'America/New_York'`), defaulting to `'Asia/Kolkata'`.
- **Wall-Clock Consistency**: Function start times are captured as local wall-clock values and deterministically mapped to UTC points in time for storage.
- **Universal NRI & Device Compatibility**: All guest RSVP forms, planner dashboards, check-in arrival stamps, and caterer CSV exports format dates and times in the wedding venue's timezone in 12-hour AM/PM format. Guests opening invitations abroad (e.g. US, UK, Gulf) always see the actual local venue time (e.g. 7:30 PM) rather than their phone's local time.

## Venue Check-In & Idempotency
- **Fast Search & Arrival Tracking**: Volunteer gate attendants can search by guest name or phone, check in households with 1 tap, adjust party sizes with $\ge 48$px mobile-friendly steppers, and register walk-ins.
- **Idempotent Walk-In Submission**: Walk-in arrivals generate a client-side UUID idempotency key that persists during submission. If a volunteer retries on a slow mobile connection, duplicate records are prevented at the database transaction level.

## Getting Started
```bash
# Install dependencies
npm install

# Start local MySQL Docker container (configured via .env)
docker run -d --name wedding-mysql -p 3306:3306 -e MYSQL_DATABASE=wedding_rsvp mysql:8.0

# Apply database migrations
npm run db:migrate --workspace=server

# Seed demo data
npm run db:seed --workspace=server

# Start development servers (frontend on :5173, backend on :5001)
npm run dev
```

## Production Deployment (Render / Docker / Self-Hosted)

### 1. Build & Run via Docker
```bash
# Build the production multi-stage container
docker build -t wedding-rsvp-app:latest .

# Run container (runs migrations automatically on startup as non-root user)
docker run -p 5001:5001 \
  -e DATABASE_URL="mysql://user:password@host:3306/dbname" \
  -e SESSION_SECRET="your-high-entropy-64-byte-secret" \
  -e TRUST_PROXY=1 \
  -e CLIENT_URL="https://your-domain.com" \
  -e ALLOWED_ORIGINS="https://your-domain.com" \
  wedding-rsvp-app:latest
```

### 2. Environment Variables Checklist
| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | MySQL 8.0 connection string | `mysql://user:pass@dbhost:3306/wedding_rsvp` |
| `SESSION_SECRET` | 64+ character random hex or base64 string for session auth | `openssl rand -hex 32` |
| `TRUST_PROXY` | Set to `1` or `true` when deployed behind Render / Cloudflare / Nginx reverse proxy | `1` |
| `CLIENT_URL` | Primary public URL for invite links and redirects | `https://your-app.onrender.com` |
| `ALLOWED_ORIGINS` | Comma-separated list of permitted origins for CSRF & CORS | `https://your-app.onrender.com` |
| `NODE_ENV` | Environment mode | `production` |

### 3. Database Migrations
Migrations are fully automated. On container boot, `node server/dist/db/migrate.js` applies any pending migrations before the Express server starts listening. No manual `drizzle-kit` CLI execution is required in production.


