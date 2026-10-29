# Multi-stage production Dockerfile using Debian slim for native argon2 compatibility
FROM node:22-slim AS builder

WORKDIR /app

# Copy root & workspace package manifests
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies for all workspaces
RUN npm ci --legacy-peer-deps

# Copy source files (excluding .dockerignore)
COPY . .

# Compile TypeScript backend and Vite frontend
RUN npm run build --workspace=server
RUN npm run build --workspace=client

# Prune development dependencies for minimal production footprint
RUN npm prune --omit=dev

# Production runtime stage
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy pruned production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/db/migrations ./server/dist/db/migrations
COPY --from=builder /app/client/dist ./client/dist

# Run container as non-root user for security
USER node

EXPOSE 5001

CMD ["sh", "-c", "node server/dist/db/migrate.js && node server/dist/index.js"]
