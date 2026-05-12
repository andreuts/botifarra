# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

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

# Generate Prisma client + build everything
RUN pnpm --filter @botifarra/server exec prisma generate
RUN pnpm --filter @botifarra/core build
RUN pnpm --filter @botifarra/shared build
RUN pnpm --filter @botifarra/server build
RUN pnpm --filter @botifarra/web build

# Prune dev dependencies in-place
RUN CI=true pnpm prune --prod

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runner

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the entire workspace with prod-only node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/botifarra-core/dist ./packages/botifarra-core/dist
COPY --from=builder /app/packages/botifarra-core/package.json ./packages/botifarra-core/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/apps/web/dist ./web-dist
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIST_DIR=/app/web-dist

EXPOSE 3000

WORKDIR /app/apps/server

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
