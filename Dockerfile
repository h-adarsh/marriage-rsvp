# Multi-stage production Dockerfile for Wedding RSVP & Headcount App
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies for all workspaces
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm ci

# Copy full source
COPY . .

# Build server and client
RUN npm run build --workspace=server
RUN npm run build --workspace=client

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY server/package*.json ./server/

# Install only production dependencies for server
RUN npm ci --omit=dev --workspace=server

# Copy compiled artifacts and migrations
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/db/migrations ./server/dist/db/migrations
COPY --from=builder /app/server/src/db/migrations ./server/src/db/migrations
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 5001

# Run migrations and start unified Express + Vite production server
CMD ["sh", "-c", "npm run db:migrate --workspace=server && node server/dist/index.js"]
