# marriage-rsvp

A portfolio-grade Wedding RSVP & Headcount Web App for wedding planners and couples to eliminate catering headcount guesswork.

Collects RSVPs per function via private, mobile-friendly links and calculates exact headcounts and dietary totals.

## Technology Stack
- **Backend**: Node.js, Express, TypeScript, MySQL 8.0, Drizzle ORM
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router v7
- **Security**: Argon2id password hashing, SHA-256 session token hashing at rest, HttpOnly & SameSite=Strict cookies, CSRF protection, multi-tenant isolation, 128-bit unguessable capability URLs
- **Testing**: Vitest, Supertest (13 test suites, 70 passing tests)

## Getting Started
```bash
# Install dependencies
npm install

# Start local MySQL Docker container
docker run -d --name wedding-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=wedding_rsvp mysql:8.0

# Apply database migrations
npm run db:migrate --workspace=server

# Seed demo data
npm run db:seed --workspace=server

# Start development servers (frontend on :5173, backend on :5001)
npm run dev
```
