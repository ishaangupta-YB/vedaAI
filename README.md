# VedaAI Assessment Creator

A teacher fills in an assignment (optional PDF/text upload, due date, question
types, counts + marks, instructions). The system generates a structured question
paper with an LLM **as a background job**, streams **real-time progress** to the
browser over WebSocket, stores the validated result, and renders it as a clean,
exam-paper-style page with a PDF export.

The interesting part is the *plumbing and the parsing discipline*, not feature
breadth. The hardest rule, enforced end to end: **never render the raw LLM
response.** Model output is validated against a Zod schema, the validated object
is stored, and every renderer (web and PDF) draws only from stored, validated
data.

> This README is self-contained: it covers the architecture, the end-to-end
> flow, and the **complete contract** (enums, schemas, REST + WebSocket + queue
> shapes) below. `CLAUDE.md` mirrors the same contract for coding agents and
> keeps the contract change log.

---

## Architecture

A pnpm + Turborepo monorepo with three runtimes (web, api, worker) and two shared
packages (`shared` = the contract, `db` = models + connections). MongoDB stores
state; Redis is the BullMQ broker, the paper cache, **and** the pub/sub bridge
that lets the worker push real-time updates without owning any sockets.

```mermaid
flowchart LR
  subgraph browser["Browser"]
    W["Next.js 16 web<br/>Zustand store · socket.io-client"]
  end

  subgraph apihost["API host (persistent)"]
    A["Express 5 REST"]
    S["Socket.IO server<br/>assignment:&lt;id&gt; rooms"]
    BR["ws:events subscriber<br/>(pub/sub bridge)"]
  end

  subgraph workerhost["Worker host (persistent)"]
    G["generate-paper job"]
    P["render-pdf job"]
  end

  M[("MongoDB<br/>assignments · papers")]
  R[("Redis<br/>BullMQ · cache · pub/sub")]
  L[["AWS Bedrock<br/>Claude · Converse API"]]

  W -- "POST /api/assignments" --> A
  A -- "persist + enqueue" --> M
  A -- "add generate-paper" --> R
  W <-. "join assignment:&lt;id&gt;" .-> S

  R -- "job" --> G
  G -- "cache check / store" --> R
  G -- "LLM call (cache miss only)" --> L
  G -- "validated QuestionPaper" --> M
  G -- "enqueue render-pdf" --> R
  R -- "job" --> P
  P -- "store PDF bytes" --> M

  G -- "publish {event,payload}" --> R
  P -- "publish {event,payload}" --> R
  R -- "ws:events" --> BR
  BR -- "emit to room" --> S
  S -. "generation:* / pdf:ready" .-> W

  W -- "GET /api/papers/:id/pdf" --> A
  A -- "stream PDF bytes" --> M
```

### Repository layout

```
apps/
  web/      # Next.js 16 (App Router) + Tailwind v4 — create + output UI, realtime client
  api/      # Express 5 + Socket.IO (ESM) — REST, the pub/sub bridge, PDF streaming
  worker/   # BullMQ worker (ESM) — generate-paper + render-pdf jobs
packages/
  shared/   # Zod schemas, inferred types, enums, constants (the wire contract)
  db/       # Mongoose 8 models + connectMongo + ioredis client factories
```

`packages/shared` and `packages/db` are the contract. Treat them as read-only
from inside `apps/*`: import from them, never redefine their types locally.

### Process & connection topology

Three independently deployable runtimes talk only through MongoDB and Redis —
never directly to each other:

- **web** (browser) — the Next.js client; speaks REST + Socket.IO to the API only.
- **api** (persistent host) — owns the REST surface, the Socket.IO server, the
  BullMQ **producer**, and the pub/sub **bridge**. It never calls the LLM.
- **worker** (persistent host) — the BullMQ **consumer**; the only process that
  calls Bedrock and renders PDFs. It never owns a socket.

Redis carries three independent concerns over separate ioredis connections:
BullMQ needs dedicated blocking connections (`createBullRedis` forces
`maxRetriesPerRequest: null`), the Socket.IO bridge needs a dedicated subscriber
connection (a subscriber can't run normal commands), and the cache + publisher
use ordinary clients. MongoDB connections are reused process-wide via
`connectMongo`.

---

## Project structure

```
apps/
  web/                          # Next.js 16 App Router client (Vercel-friendly)
    app/                        # routes: / and /assignments (list), /create, /assignments/[id] (output)
    src/components/             # assignments/, create/, generation/, output/, shell/, ui/, ...
    src/hooks/useGeneration.ts  # opens the socket, mirrors every WS event into the store, re-syncs on (re)connect
    src/store/generation.ts     # Zustand store: status/progress/stage/paper/pdfUrl/pdfError/error
    src/lib/api.ts              # typed REST client (re-validates payloads with the shared Zod schemas)
    src/lib/mock.ts             # in-memory REST + realtime mock (NEXT_PUBLIC_USE_MOCK=true)
    src/config.ts               # typed NEXT_PUBLIC_* config (the only place process.env is read)
  api/
    src/app.ts                 # Express app: CORS, JSON, request-id, routes, error handler
    src/index.ts               # boots HTTP + Socket.IO + the Redis pub/sub bridge
    src/socket.ts              # Socket.IO rooms + handleBridgeMessage (ws:events -> room)
    src/queue.ts               # BullMQ producer (enqueueGeneratePaper / enqueueRenderPdf)
    src/routes/                # assignments.ts, papers.ts, uploads.ts
    src/middleware/            # validate.ts (Zod), errorHandler.ts (wire error shapes), requestId.ts
    src/lib/serialize.ts       # Mongoose doc -> shared wire shape (_id -> id, Dates -> ISO, drops pdf)
    src/config.ts              # typed env config (loads the root .env)
  worker/
    src/index.ts               # BullMQ Worker: routes the two jobs, surfaces terminal failures
    src/jobs/generatePaper.ts  # the 6-step generation flow (load -> cache -> prompt -> model -> validate -> store)
    src/jobs/renderPdf.ts      # renders the stored paper to PDF bytes; emits pdf:ready / pdf:failed
    src/generate.ts            # model-agnostic generate + exactly ONE validate/repair round-trip
    src/bedrock.ts             # Bedrock Converse API with structured outputs (json_schema)
    src/prompt.ts              # deterministic system + user prompt builder
    src/paper.ts               # assign ids, recompute totalMarks, shape conversions
    src/paperSchema.ts         # the model-output content schema + its JSON Schema
    src/pdf/                   # render.ts (renderToBuffer) + document.tsx (@react-pdf/renderer)
    src/publisher.ts           # publishes { event, payload } JSON to the ws:events channel
    src/config.ts              # typed env config (loads the root .env)
packages/
  shared/src/                  # enums.ts, schemas.ts (Zod), constants.ts (routes/events/queue/colors), hash.ts
  db/src/                      # mongo.ts, redis.ts, models/assignment.ts, models/questionPaper.ts
```

---

## Data-flow narrative

1. **Create.** The browser submits the form. The same `CreateAssignmentInput`
   Zod schema validates it client-side (react-hook-form + zod resolver) and
   server-side (Express middleware) — one schema, both ends.
2. **Persist + enqueue.** `POST /api/assignments` saves the assignment
   (`status: "queued"`), enqueues a `generate-paper` BullMQ job, and returns
   `{ assignmentId, jobId }`. The client joins Socket.IO room
   `assignment:<assignmentId>` and optimistically shows "queued".
3. **Generate (worker).** The worker marks the assignment `active`, then checks
   the **paper cache** (see below). On a miss it builds a deterministic prompt
   and calls Bedrock (Converse API, structured outputs). The returned JSON is
   re-validated against the Zod `QuestionPaper` schema with **one repair
   round-trip**; a second failure fails the job.
4. **Store.** The worker assigns ids, **recomputes `totalMarks`** from the
   questions (the model's own total is never trusted), persists the validated
   paper, caches it, and enqueues `render-pdf`.
5. **Realtime.** The worker is a separate process and never touches sockets. It
   **publishes** `{ event, payload }` JSON to the Redis `ws:events` channel; the
   API **subscribes** on a dedicated connection and re-emits each event to room
   `assignment:<id>`. The browser updates a Zustand store from those events
   (`generation:active → progress → completed`, then `pdf:ready`). The client
   re-joins its room and re-syncs assignment/PDF state on every (re)connect and
   refresh, so a dropped socket never loses progress or a missed
   `completed`/`pdf:ready` event.
6. **Render.** The output page renders the `QuestionPaper` from the store (never
   raw model text) and shows the answer key inline. `render-pdf` produces
   exam-paper PDF bytes server-side with `@react-pdf/renderer` (no headless
   browser) and stores them on the paper; `GET /api/papers/:id/pdf` streams them
   and the browser fetches those bytes as a blob to save the file client-side
   (reliable across the API's separate origin). If a render fails after its
   retries, the worker emits `pdf:failed` and the download button surfaces a real
   error + a **Try again** that re-renders via `POST /api/papers/:id/pdf` (no LLM
   re-run) instead of a download that silently 404s forever.

---

## The "never render raw LLM output" decision

This is the central correctness rule and it is enforced structurally, not by
convention:

- The model is called with **structured outputs** (a JSON Schema derived from the
  `QuestionPaper` shape) and its response is **re-validated** with the Zod
  `QuestionPaper` schema in the worker. Invalid output gets exactly one repair
  attempt; still invalid → the job fails (`generation:failed`).
- Only the **validated** object is written to MongoDB. Server-assigned fields
  (ids, `totalMarks`, `generatedAt`) are computed by us, not the model.
- Both renderers — the web `QuestionPaperView` and the worker `PaperDocument`
  (PDF) — take a typed `QuestionPaper` as input. There is no code path that
  interpolates raw model text into the UI or the PDF.

---

## Deliberate decisions

- **Zustand for generation state.** A single store holds `status / progress /
  stage / paper / pdfUrl / pdfError / error`, fed by the socket subscription. It keeps the
  realtime lifecycle out of component state and lets the create flow, progress
  view, and output page read one consistent source.
- **Socket.IO rooms (`assignment:<id>`).** Each assignment gets its own room so
  an event is delivered only to the client(s) watching that assignment — no
  client-side filtering, no cross-talk between concurrent generations.
- **Redis pub/sub bridge.** The worker doesn't own the Socket.IO server, so it
  publishes events to the `ws:events` Redis channel and the API re-emits them to
  the right room. This keeps the worker horizontally scalable and process-
  isolated while still driving the browser. A subscriber connection can't run
  normal commands, so the bridge uses a dedicated ioredis connection.
- **Paper caching (observable + deliberate).** The cache key is a stable hash of
  the normalized `CreateAssignmentInput` (sorted keys). On a hit the worker
  reuses the cached content with fresh ids and **skips the LLM entirely** (saving
  latency and cost); identical inputs are deterministic. Entries live under
  `paper:<hash>` with a TTL. **Every generation logs exactly one cache line** so
  the behavior is visible, e.g.:

  ```
  [worker] generate-paper 665f… — paper cache MISS (calling LLM) key=paper:ab12…
  [worker] generate-paper 665f… — paper cache HIT (reusing, no LLM call) key=paper:ab12…
  ```

- **PDF-as-job.** PDF rendering runs as its own `render-pdf` BullMQ job (not
  inline in the request) and uses `@react-pdf/renderer` (`renderToBuffer`, no
  headless browser) so it stays friendly to small hosts. Bytes are stored on the
  paper document and streamed from `GET /api/papers/:id/pdf`; the browser is told
  via `pdf:ready`. The PDF has real typographic hierarchy, page-break-safe
  sections, a page-number footer, and **color-coded difficulty badges that share
  one palette with the web UI** (`DIFFICULTY_COLORS` in `packages/shared`), so
  the printed paper matches what's on screen.

---

## Data model

Zod (in `packages/shared`) is the single source of truth; every TypeScript type
is `z.infer` of a schema. The **same `CreateAssignmentInput` schema validates the
form client-side (react-hook-form + zod resolver) and the request server-side
(Express middleware)** — one schema, both ends.

Enums (exact wire values):

- `QuestionType`: `mcq | short_answer | long_answer | true_false | fill_blank`
- `Difficulty`: `easy | moderate | hard` (title-cased only for display)
- `JobStatus`: `queued | active | completed | failed`

```ts
CreateAssignmentInput {
  title: string                  // 1..200
  dueDate: string                // ISO datetime, MUST be in the future
  questionConfigs: Array<{       // 1..20 entries
    type: QuestionType
    count: number                // int >= 1
    marksPerQuestion: number     // > 0
  }>
  additionalInstructions?: string  // <= 2000
  sourceText?: string              // <= 50_000 (extracted from an uploaded PDF/txt)
}

Question      { id; text; type: QuestionType; difficulty: Difficulty; marks: number /* >0 */; options?: string[]; answer?: string }
Section       { id; title; instruction; questions: Question[] }
QuestionPaper { id; assignmentId; title; totalMarks: number; sections: Section[]; generatedAt: string /* ISO */ }
Assignment    { id; ...CreateAssignmentInput; status: JobStatus; jobId?; paperId?; createdAt; updatedAt }
```

Server-assigned fields (`id`s, `totalMarks`, `generatedAt`) are computed by us,
never taken from the model. The rendered PDF is stored as a `Buffer` on the
paper document (`packages/db`) and served from a dedicated route — it is **not**
part of the JSON `QuestionPaper` contract.

---

## REST API contract

Base path `/api`. Bodies and responses use the shapes above.

| Method | Path | Body / Params | Returns |
|--------|------|---------------|---------|
| GET | `/health` | — | `{ ok: true }` |
| POST | `/uploads` | multipart `file` (pdf/txt, <=10MB) | `{ sourceText: string }` |
| POST | `/assignments` | `CreateAssignmentInput` | `201 { assignmentId, jobId }` |
| GET | `/assignments` | — | `{ assignments: Assignment[], total: number }` |
| GET | `/assignments/:id` | — | `{ assignment: Assignment, paper?: QuestionPaper }` |
| DELETE | `/assignments/:id` | — | `204 No Content` (also deletes its paper) |
| POST | `/assignments/:id/regenerate` | — | `202 { jobId }` |
| GET | `/papers/:id` | — | `QuestionPaper` |
| GET | `/papers/:id/pdf` | — | `application/pdf` (streams stored bytes; `404` until rendered) |
| POST | `/papers/:id/pdf` | — | `202 { jobId }` (re-render the PDF; no LLM re-run) |

Error shapes (from the central error handler — never hand-rolled in routes):

- `400 { error: "ValidationError", issues: ZodIssue[] }` — body failed the Zod schema.
- `400 { error: "BadRequest", message: string }` — e.g. unsupported upload type or malformed JSON.
- `404 { error: "NotFound" }` — unknown id / unmatched route.
- `500 { error: "InternalServerError" }` — unexpected; internals never leak.

---

## WebSocket contract (Socket.IO)

A client joins room `assignment:<assignmentId>` right after `POST /assignments`
returns, and re-joins on every reconnect. All server -> client events carry
`{ assignmentId }` plus the listed fields:

| Event | Payload |
|-------|---------|
| `generation:queued` | `{ assignmentId, jobId }` |
| `generation:active` | `{ assignmentId }` |
| `generation:progress` | `{ assignmentId, progress: 0..100, stage: string }` |
| `generation:completed` | `{ assignmentId, paperId }` |
| `generation:failed` | `{ assignmentId, error: string }` |
| `pdf:ready` | `{ assignmentId, paperId, url }` |
| `pdf:failed` | `{ assignmentId, paperId, error: string }` |

Client -> server: `join` / `leave` with `{ assignmentId }`.

Two honest notes about the live implementation:

- `generation:queued` is part of the contract surface, but the worker begins
  processing at `generation:active`; the **queued** state is reflected by the
  assignment's persisted `status` (the client also shows it optimistically right
  after create), so no separate emit is required.
- **The worker doesn't own the sockets.** It *publishes* `{ event, payload }`
  JSON to the Redis `ws:events` channel; the API subscribes on a dedicated
  connection and re-emits each message to room `assignment:<id>`. That bridge
  lives in exactly one place, keeping the worker process-isolated and
  horizontally scalable.

---

## Queue + job contract (BullMQ on Redis)

- **Queue**: `assessment`.
- **Jobs**: `generate-paper` (`{ assignmentId }`) and `render-pdf` (`{ paperId, assignmentId }`).
- **Options**: worker concurrency `5`; `3` attempts with exponential backoff (1s
  base); trim completed jobs to the last `100`; keep failed jobs for inspection.
  The BullMQ connection sets `maxRetriesPerRequest: null`.

The `generate-paper` flow (`apps/worker/src/jobs/generatePaper.ts`):

1. Load the assignment, set `status: active`, publish `generation:active`.
2. Compute the cache key `paper:<sha256>` from the canonical (sorted-key)
   `CreateAssignmentInput`. On a **hit**, reuse the cached content (with fresh
   ids) and **skip the LLM entirely**.
3. On a **miss**: build the deterministic prompt (`progress 10`), call Bedrock
   with structured outputs (`progress 40`), then re-validate against the Zod
   `QuestionPaper` schema (`progress 80`) — exactly **one** repair round-trip,
   then the job fails.
4. Assign ids, **recompute `totalMarks`**, persist the paper, link `paperId`,
   set `status: completed`, cache under `paper:<hash>` (TTL 24h).
5. Publish `generation:progress 100` + `generation:completed`, then enqueue
   `render-pdf`.
6. If a job exhausts its retries the worker surfaces it exactly once:
   `generate-paper` -> `generation:failed`, `render-pdf` -> `pdf:failed`.

Every generation logs exactly one cache line (`HIT`/`MISS`) so the behavior is
observable from the worker logs.

---

## Prerequisites

- Node 20+
- pnpm 11 (`corepack enable`)
- Docker (for local Mongo + Redis)
- An AWS Bedrock API key with access to the configured Claude model (for real
  generation; the rest of the app runs without it)

## One-command local setup

```bash
pnpm install
cp .env.example .env         # fill in AWS_BEARER_TOKEN_BEDROCK for real generation
docker compose up -d         # start local mongo + redis
pnpm dev                     # run web + api + worker in watch mode (Turborepo)
```

Then open the web app at `http://localhost:3000` (API on `http://localhost:4000`).

Useful variations:

```bash
pnpm build                   # build all packages/apps
pnpm test                    # run unit + integration tests
pnpm typecheck               # type-check every workspace

# Preview the full UI flow with no backend (in-memory mock of REST + realtime):
NEXT_PUBLIC_USE_MOCK=true pnpm --filter @veda-ai/web dev
```

## Environment variables

Documented in `.env.example`. Never commit real secrets. Each app reads env vars
**only** through its typed config module (`apps/*/src/config.ts`); never read
`process.env` ad hoc elsewhere.

A single root `.env` configures `api` + `worker`; `web` reads `NEXT_PUBLIC_*`.

| Var | Used by | Required | Purpose |
|-----|---------|:---:|---------|
| `MONGODB_URI` | api, worker | – | MongoDB connection string (defaults to local) |
| `REDIS_URL` | api, worker | – | Redis connection string (defaults to local) |
| `AWS_REGION` | worker | – | AWS region hosting the Bedrock model/profile |
| `BEDROCK_MODEL_ID` | worker | – | Bedrock model id / cross-region inference profile |
| `BEDROCK_MAX_TOKENS` | worker | – | Max output tokens per generation call |
| `AWS_BEARER_TOKEN_BEDROCK` | worker | ✓\* | Bedrock API key. Without it, `generate-paper` jobs fail (the rest of the app still runs) |
| `WORKER_CONCURRENCY` | worker | – | Max concurrent BullMQ jobs (default `5`) |
| `PAPER_CACHE_TTL_SECONDS` | worker | – | TTL for the `paper:<hash>` generation cache (default `86400` = 24h) |
| `PORT` | api | – | Express listen port (default `4000`) |
| `CLIENT_ORIGIN` | api | – | CORS allowed origin (default `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | web | – | REST base URL (browser) |
| `NEXT_PUBLIC_WS_URL` | web | – | WebSocket URL (browser) |
| `NEXT_PUBLIC_USE_MOCK` | web | – | `true` runs the UI against an in-memory mock (no backend) |

\* Required only for real generation against Bedrock.

`WORKER_CONCURRENCY` and `PAPER_CACHE_TTL_SECONDS` are optional advanced knobs
read with the defaults shown; they are intentionally omitted from `.env.example`.

This README is self-contained. `CLAUDE.md` mirrors the same contract for coding
agents and additionally maintains the **contract change log**.
