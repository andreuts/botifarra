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

# Create a standalone prod-only deployment for the server.
# pnpm deploy correctly resolves workspace:* packages into a flat node_modules,
# unlike `pnpm prune --prod` which removes hoisted workspace deps at the root level.
RUN pnpm deploy --filter @botifarra/server --prod --legacy /app/server-deploy

# Re-run prisma generate inside the deploy directory so the generated client
# binary (.prisma/client/default) is present in the isolated node_modules.
RUN cp -r apps/server/prisma /app/server-deploy/prisma \
 && cd /app/server-deploy \
 && node_modules/.bin/prisma generate

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runner

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/server

# node_modules from pnpm deploy (flat, prod-only, workspace packages inlined)
COPY --from=builder /app/server-deploy/node_modules ./node_modules
# Server build output and config
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/prisma ./prisma
COPY --from=builder /app/apps/server/package.json ./package.json
# Web frontend (served as static files by Fastify)
COPY --from=builder /app/apps/web/dist /app/web-dist

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIST_DIR=/app/web-dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma@6 migrate deploy && node dist/index.js"]
