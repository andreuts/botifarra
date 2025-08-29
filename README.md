# Butifarra Online (web-first → Android-ready)

This is a minimal, working monorepo starter:
- **apps/server**: Fastify + WebSocket (authoritative rooms)
- **apps/web**: React + Vite client (PWA-ready)
- **packages/protocol**: zod schemas & typed messages
- **packages/engine**: rules & scoring skeleton

## Quickstart
```bash
# 0) Node 20+ and pnpm installed
corepack enable
corepack prepare pnpm@latest --activate

# 1) install
pnpm i

# 2) build shared packages
pnpm -r --filter @buti/protocol --filter @buti/engine build

# 3) run server (terminal A)
pnpm dev:server

# 4) run web (terminal B)
pnpm dev:web

# open http://localhost:5173 and watch the log
```


## Seat rules implemented
- Join room with a display name (from the web app input; default "Guest").
- Sit only in **empty** seats. If a seat is occupied by **you**, you can re-sit the same seat (no effect).
- You cannot take a seat occupied by **another player** (you'll get an error toast).
- Click **Unsit** (or close the tab) to vacate your seat. Disconnecting also frees your seat.
