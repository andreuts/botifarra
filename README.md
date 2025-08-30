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


## Bidding implemented
- Added basic auction: players act in turn (left of dealer starts). You can **Pass** or **Bid** a trump (OROS, COPES, ESPASES, BASTOS, BOTIFARRA).
- Once someone bids, opponents can **Double**, bidders can **Redouble**, and opponents can escalate to **Sant Vicens**.
- The UI shows current dealer, turn, contract, doubles, and passes.

## How to run

### Option A) With **pnpm** (recommended)
```bash
# install pnpm (if needed)
npm i -g pnpm

# install deps
pnpm i

# run server (terminal A)
pnpm dev:server

# run web (terminal B)
pnpm dev:web
```

### Option B) With plain **npm**
We replaced the unsupported `workspace:*` protocol in `apps/server` with a relative file dependency, so npm works too:

```bash
# install root workspaces
npm i

# build local packages first
npm run build --workspaces

# run server (terminal A)
npm run dev:server

# run web (terminal B)
npm run dev:web
```

Open http://localhost:5173 in two tabs to simulate two players.
