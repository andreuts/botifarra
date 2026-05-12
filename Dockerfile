# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Manifests first — better layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/botifarra-core/package.json packages/botifarra-core/
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

# Source
COPY packages/ packages/
COPY apps/server/ apps/server/
COPY apps/web/ apps/web/

# Build dependency packages, then server, then web
RUN pnpm --filter @botifarra/core build
RUN pnpm --filter @botifarra/shared build
RUN pnpm --filter @botifarra/server build
RUN pnpm --filter @botifarra/web build

# pnpm deploy: creates a self-contained flat node_modules for the server
# This is the official pnpm approach for deploying monorepo packages — no
# virtual-store symlink issues, no Prisma path guessing.
RUN pnpm --filter @botifarra/server deploy --prod /deploy

# Copy built server dist + prisma into the deploy dir
RUN cp -r /app/apps/server/dist /deploy/dist \
 && cp -r /app/apps/server/prisma /deploy/prisma

# Generate Prisma client inside the self-contained deploy directory
RUN cd /deploy && ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runner

# Prisma query engine needs libssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the self-contained server deployment
COPY --from=builder /deploy ./

# Copy the web SPA build; server reads WEB_DIST_DIR at startup
COPY --from=builder /app/apps/web/dist ./web-dist

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIST_DIR=/app/web-dist

EXPOSE 3000

# Migrate then start
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma && node dist/index.js"]
