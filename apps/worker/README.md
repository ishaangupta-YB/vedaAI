# @veda-ai/worker

BullMQ worker for the `assessment` queue. It generates question papers via an LLM
(Anthropic, structured outputs) and renders exam-paper PDFs — both as background
jobs. It owns no HTTP routes and never touches Socket.IO; all real-time updates
are published as `{ event, payload }` JSON to the Redis `ws:events` channel for
the API to re-emit. See the root `CLAUDE.md` for the frozen contract.

## Jobs

- **`generate-paper`** `{ assignmentId }` — load assignment → `generation:active` →
  cache lookup (`paper:<hash>`, reuse with fresh ids on hit, no LLM call) →
  deterministic prompt → Anthropic with structured outputs → re-validate against
  the shared Zod schema (one repair round-trip on failure) → assign ids, recompute
  `totalMarks`, persist, cache → `generation:completed` → enqueue `render-pdf`.
- **`render-pdf`** `{ paperId, assignmentId }` — render the stored paper to a PDF
  buffer with `@react-pdf/renderer` (no headless browser), store it on the paper
  document's `pdf` field, then publish `pdf:ready`.

## Environment variables

This is the only place in the app that reads `process.env` (via `src/config.ts`).
All variables are optional except `ANTHROPIC_API_KEY`, which is required for
`generate-paper` to do real generation; without it, generation jobs fail (PDF
rendering and everything else still work).

| Variable                  | Required | Default                              | Description                                                        |
| ------------------------- | -------- | ------------------------------------ | ------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`       | yes\*    | —                                    | Anthropic API key. \*Required for `generate-paper`.                |
| `REDIS_URL`               | no       | `redis://localhost:6379`             | Redis connection (BullMQ, cache, and the `ws:events` publisher).   |
| `MONGODB_URI`             | no       | `mongodb://localhost:27017/veda-ai`  | MongoDB connection string.                                         |
| `ANTHROPIC_MODEL`         | no       | `claude-sonnet-4-6`                  | Model used for paper generation.                                   |
| `ANTHROPIC_MAX_TOKENS`    | no       | `8192`                               | Max output tokens per generation call.                             |
| `WORKER_CONCURRENCY`      | no       | `5`                                  | BullMQ worker concurrency.                                         |
| `PAPER_CACHE_TTL_SECONDS` | no       | `86400`                              | TTL (seconds) for the `paper:<hash>` generation cache (24h).       |

`REDIS_URL` and `MONGODB_URI` are shared with the API and are also documented in
the root `.env.example`.

## Scripts

```bash
pnpm --filter @veda-ai/worker dev        # tsx watch
pnpm --filter @veda-ai/worker build      # tsc -> dist/
pnpm --filter @veda-ai/worker start      # node dist/index.js
pnpm --filter @veda-ai/worker typecheck
pnpm --filter @veda-ai/worker test       # vitest
```

`startWorker()` is also exported from `src/index.ts` so the API can run the worker
in-process in a co-located deployment.
