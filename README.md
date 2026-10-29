# marriage-rsvp

A portfolio-grade Wedding RSVP & Headcount Web App for wedding planners and couples to eliminate catering headcount guesswork.

Collects RSVPs per function via private, mobile-friendly links and calculates exact headcounts and dietary totals.

## Technology Stack
- **Backend**: Node.js, Express, TypeScript, MySQL 8.0, Drizzle ORM
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router v7
- **Security**: Argon2id password hashing, SHA-256 session token hashing at rest, HttpOnly & SameSite=Strict cookies, CSRF protection, multi-tenant isolation, 128-bit unguessable capability URLs
- **Testing**: Vitest, Supertest (**19 server test suites, 140 passing tests**). Client workspace relies on strict TypeScript typechecking (`npm run typecheck`); no client DOM automated unit tests are configured.

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

## Deployment & Production Hosting
- **Origin & CSRF Configuration**: In production, set `CLIENT_URL=https://your-frontend-domain.com`. For multi-domain deployments, add comma-separated origins to `ALLOWED_ORIGINS`.
- **SameSite Cookies**: Because sessions use `SameSite=Strict`, the frontend and API should be hosted on the same root site (e.g., `app.example.com` and `api.example.com`, or behind a reverse proxy routing `/api` to the backend). If cross-site domains are used, `SameSite=Lax` or token authorization must be configured.

