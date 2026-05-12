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

# Copy Prisma schema + engine binaries from builder
COPY --from=builder /app/apps/server/prisma apps/server/prisma

# Copy the prisma CLI from the builder stage (it's a devDep, not in prod install)
COPY --from=builder /app/node_modules/.pnpm/prisma@6.19.3/node_modules/prisma node_modules/.pnpm/prisma@6.19.3/node_modules/prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+engines@6.19.3/node_modules/@prisma/engines node_modules/.pnpm/@prisma+engines@6.19.3/node_modules/@prisma/engines

# Regenerate Prisma client against the production node_modules
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "cd apps/server && npx prisma migrate deploy && node dist/index.js"]
