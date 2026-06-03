# VedaAI Assessment Creator

A pnpm + Turborepo monorepo. **Phase 0: scaffolding + shared contract only** — no
features, generation logic, or UI beyond stubs yet.

## Layout

```
apps/
  web/      # Next.js 16 (App Router) + Tailwind — scaffold only
  api/      # Express 5 + TypeScript (ESM) — boots and serves GET /api/health
  worker/   # BullMQ worker (ESM) — connects and logs "worker up"
packages/
  shared/   # Zod schemas, inferred types, enums, and shared constants (the contract)
  db/       # Mongoose 8 models + connectMongo + ioredis client factories
```

`packages/shared` and `packages/db` are the contract. Treat them as read-only from
inside `apps/*`: import from them, never redefine their types locally.

## Prerequisites

- Node 20+
- pnpm 11 (`corepack enable`)
- Docker (for local Mongo + Redis)

## Getting started

```bash
pnpm install
docker compose up -d        # start local mongo + redis
cp .env.example .env        # fill in values as needed
pnpm build                  # build all packages/apps
pnpm test                   # run unit tests
pnpm dev                    # run all apps in watch mode
```

## Environment variables

Documented in `.env.example`. Never commit real secrets. Each app reads env vars
**only** through its typed config module (`apps/*/src/config.ts`); never read
`process.env` ad hoc elsewhere.

| Var | Used by | Purpose |
|-----|---------|---------|
| `MONGODB_URI` | api, worker | MongoDB connection string |
| `REDIS_URL` | api, worker | Redis connection string |
| `ANTHROPIC_API_KEY` | api, worker | LLM key (later phase) |
| `PORT` | api | Express listen port |
| `CLIENT_ORIGIN` | api | CORS allowed origin |
| `NEXT_PUBLIC_API_URL` | web | REST base URL (browser) |
| `NEXT_PUBLIC_WS_URL` | web | WebSocket URL (browser) |

See `CLAUDE.md` for the full contract (schemas, REST + WebSocket + queue contracts).
