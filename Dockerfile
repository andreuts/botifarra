# ── Stage 1: install & build ──────────────────────────────────────────────────
FROM node:20-slim AS builder

# pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy manifests first for better layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/botifarra-core/package.json packages/botifarra-core/
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY apps/server/ apps/server/
COPY apps/web/ apps/web/

# Generate Prisma client
RUN pnpm --filter @botifarra/server db:generate

# Build packages → server → web (respects dependency order)
RUN pnpm -r build

# ── Stage 2: production runtime ──────────────────────────────────────────────
FROM node:20-slim AS runner

RUN corepack enable && corepack prepare pnpm@10 --activate

# OpenSSL is needed by Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/botifarra-core/package.json packages/botifarra-core/
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

# Production-only install
RUN pnpm install --frozen-lockfile --prod

# Copy built outputs
COPY --from=builder /app/packages/botifarra-core/dist packages/botifarra-core/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/server/dist apps/server/dist
COPY --from=builder /app/apps/web/dist apps/web/dist

# Copy Prisma schema then regenerate the client for this platform
COPY --from=builder /app/apps/server/prisma apps/server/prisma
RUN cd apps/server && ./node_modules/.bin/prisma generate


ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "cd apps/server && ./node_modules/.bin/prisma migrate deploy && node dist/index.js"]
