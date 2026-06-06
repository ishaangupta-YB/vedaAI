# CLAUDE.md — VedaAI Assessment Creator (repo context)

> Every agent and session reads this file first. It is the single source of truth for the
> shared contract. **Do not invent API shapes, event names, enums, or job payloads.** If you
> believe the contract must change, edit `packages/shared` and add a one-line note under
> "Contract change log" at the bottom of this file — never change a shape silently in only
> one app.

---

## What we're building

A teacher creates an assignment (optional PDF/text upload, due date, question types, count +
marks, instructions). The system generates a structured question paper via an LLM as a
**background job**, pushes **real-time status** to the browser over WebSocket, stores the
validated result, and renders it as a clean, exam-paper-style output page with a PDF export.

The grading signal is the *plumbing and the parsing discipline*, not app complexity. The
hardest rule: **never render the raw LLM response.** The model output is validated against a
schema, the validated object is stored, and the UI renders only from stored/validated data.

---

## Repository shape (pnpm + Turborepo monorepo)

```
(root directory) -> "/Users/ishaan/Desktop/veda AI/assignment-submit/veda-ai"
  apps/
    web/        # Next.js 16 (App Router) — Vercel
    api/        # Express 5 + Socket.IO server — persistent host
    worker/     # BullMQ worker (generation + PDF) — persistent host
  packages/
    shared/     # Zod schemas, inferred TS types, enums, WS event + queue + route constants
    db/         # Mongoose models + Redis client factory + connection helpers
  design/       # Figma screenshots (frontend agent reads these for visual fidelity)
  turbo.json
  pnpm-workspace.yaml
  CLAUDE.md
  README.md
```

`packages/shared` and `packages/db` are the contract. Treat them as **read-only** from inside
`apps/*`. Import from them; do not redefine their types locally.

---

## Canonical enums (use these exact string values everywhere)

- `QuestionType`: `"mcq" | "short_answer" | "long_answer" | "true_false" | "fill_blank"`
- `Difficulty`: `"easy" | "moderate" | "hard"`
  - NOTE: the brief is inconsistent ("easy/medium/hard" in generation, "Easy/Moderate/Hard"
    in output). We standardize on `easy | moderate | hard` and present them title-cased in the UI.
- `JobStatus`: `"queued" | "active" | "completed" | "failed"`

Adjust the `QuestionType` set if the Figma screens specify different ones — but change it in
`packages/shared` only, then update this file.

---

## Data model (Zod is the source of truth; TS types are `z.infer` of these)

```ts
// packages/shared/src/schemas.ts (shape reference — implement in Zod)

CreateAssignmentInput {
  title: string (1..200)
  dueDate: ISO datetime string, MUST be in the future
  questionConfigs: Array<{                // at least 1 entry
    type: QuestionType
    count: int >= 1
    marksPerQuestion: number > 0
  }> (1..20 entries)
  additionalInstructions?: string (<= 2000)
  sourceText?: string (<= 50_000)         // extracted from uploaded PDF/text, optional
}

Question {
  id: string
  text: string
  type: QuestionType
  difficulty: Difficulty
  marks: number > 0
  options?: string[]        // present for mcq; 4 options typical
  answer?: string           // optional answer key, not rendered to students by default
}

Section {
  id: string
  title: string             // "Section A", "Section B", ...
  instruction: string       // e.g. "Attempt all questions."
  questions: Question[]
}

QuestionPaper {
  id: string
  assignmentId: string
  title: string
  totalMarks: number
  sections: Section[]
  generatedAt: ISO datetime string
}

Assignment {
  id: string
  ...CreateAssignmentInput
  status: JobStatus
  jobId?: string
  paperId?: string
  createdAt: ISO datetime string
  updatedAt: ISO datetime string
}
```

The same `CreateAssignmentInput` schema is used by **client-side form validation**
(react-hook-form + `@hookform/resolvers/zod`) and **server-side request validation** (Express
middleware). One schema, validated on both ends — do not duplicate validation logic.

---

## REST API contract (base path `/api`)

| Method | Path                          | Body / Params                | Returns                                  |
|--------|-------------------------------|------------------------------|------------------------------------------|
| GET    | `/health`                     | —                            | `{ ok: true }`                           |
| POST   | `/uploads`                    | multipart `file` (pdf/txt)   | `{ sourceText: string }`                 |
| POST   | `/assignments`                | `CreateAssignmentInput`      | `201 { assignmentId, jobId }`            |
| GET    | `/assignments`                | —                            | `{ assignments: Assignment[], total }`   |
| GET    | `/assignments/:id`            | —                            | `{ assignment, paper?: QuestionPaper }`  |
| DELETE | `/assignments/:id`            | —                            | `204 No Content`                         |
| GET    | `/papers/:id`                 | —                            | `QuestionPaper`                          |
| POST   | `/assignments/:id/regenerate` | —                            | `202 { jobId }`                          |
| GET    | `/papers/:id/pdf`             | —                            | `application/pdf` (download)             |
| POST   | `/papers/:id/pdf`             | —                            | `202 { jobId }` (re-render the PDF)      |

Validation failures return `400 { error: "ValidationError", issues: ZodIssue[] }`.
Not found returns `404 { error: "NotFound" }`.

---

## WebSocket contract (Socket.IO)

- Client joins room `assignment:<assignmentId>` immediately after `POST /assignments` returns.
- **Server → client** events (all carry `{ assignmentId }` plus the listed fields):

| Event                   | Payload                              |
|-------------------------|--------------------------------------|
| `generation:queued`     | `{ assignmentId, jobId }`            |
| `generation:active`     | `{ assignmentId }`                   |
| `generation:progress`   | `{ assignmentId, progress: 0..100, stage: string }` |
| `generation:completed`  | `{ assignmentId, paperId }`          |
| `generation:failed`     | `{ assignmentId, error: string }`    |
| `pdf:ready`             | `{ assignmentId, paperId, url }`     |
| `pdf:failed`            | `{ assignmentId, paperId, error: string }` |

- **Client → server**: `join` `{ assignmentId }`, `leave` `{ assignmentId }`.

### Critical: the worker does not own the sockets

The worker is a separate process from the Socket.IO server. The worker **publishes** events to
a Redis pub/sub channel `ws:events` as JSON `{ event, payload }`. The API server **subscribes**
to `ws:events` and re-emits each one to room `assignment:<payload.assignmentId>`. Implement this
bridge exactly once, in the API server. Use a dedicated ioredis connection for subscribe (a
subscriber connection cannot run normal commands).

---

## Queue + job contract (BullMQ on Redis)

- Queue name: `"assessment"`.
- Job names:
  - `"generate-paper"` — data: `{ assignmentId: string }`
  - `"render-pdf"` — data: `{ paperId: string, assignmentId: string }`
- Worker concurrency: 5. Attempts: 3, exponential backoff (1s base). Remove on complete after
  100 jobs; keep failed for inspection.
- ioredis connection for BullMQ **must** set `maxRetriesPerRequest: null` (BullMQ throws otherwise).

### Generation job flow (worker)

1. Load `Assignment` from Mongo by `assignmentId`; set status `active`; publish `generation:active`.
2. Compute a cache key = stable hash of normalized `CreateAssignmentInput` (sorted keys). If
   `paper:<key>` exists in Redis, reuse it (clone with new ids/assignmentId), skip the LLM call.
3. Build a deterministic prompt from the input (see "Prompt construction" below).
4. Call Bedrock (Converse API) with **structured outputs** (`outputConfig.textFormat` →
   `json_schema` of `QuestionPaper` minus server-assigned fields; the JSON Schema is passed as a
   string). Re-validate the returned JSON with the Zod `QuestionPaper` schema. On Zod failure: one
   repair attempt (feed the model its output + the Zod issues, ask it to fix). On second failure:
   throw → job fails → `generation:failed`.
5. Assign ids, compute `totalMarks` from questions (don't trust the model's total), store
   `QuestionPaper` in Mongo, cache under `paper:<key>` (TTL 24h), set assignment status
   `completed` + `paperId`, publish `generation:completed`.
6. Emit `generation:progress` at meaningful stages (e.g. 10 building prompt, 40 calling model,
   80 validating, 100 done).

### Prompt construction (the graded "input → structured prompt" step)

Build, do not free-text: a system prompt that states the model must produce a valid exam paper
matching the schema; a user prompt assembled from `title`, total question count and per-type
counts, `marksPerQuestion` per type, a sensible difficulty spread (e.g. ~30/40/30 easy/moderate/
hard unless instructions say otherwise), grouping rule (group by type into Section A/B/... with
an `instruction` per section), `additionalInstructions`, and `sourceText` as grounding context
("base questions on the following material") when present. Keep the schema enforcement to the
structured-output layer, not prose.

---

## Tech + versions (current as of build)

- Node 20+, TypeScript 5, ESM throughout.
- Frontend: Next.js 16 (App Router), React 19.2, Zustand, react-hook-form + zod resolver,
  socket.io-client, Tailwind. `@react-pdf/renderer` optional client fallback.
- Backend: Express 5, Socket.IO 4, BullMQ + ioredis, Mongoose 8, Zod. LLM via **AWS Bedrock**
  using `@aws-sdk/client-bedrock-runtime` (Converse API). Default model
  `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (cross-region inference profile); structured
  outputs via Converse `outputConfig.textFormat` (json_schema). Auth is a Bedrock API key
  (`AWS_BEARER_TOKEN_BEDROCK`), auto-detected by the AWS SDK. PDF via `@react-pdf/renderer`
  (`renderToBuffer`, no headless browser — friendly to small hosts). PDF upload-text extraction
  via `unpdf` (or `pdf-parse`).
- Infra: MongoDB Atlas (M0), Redis (Upstash or Railway/Render Key Value).

## Conventions

- ESM, `type: module`. Strict TS. No `any` in exported signatures.
- All env access goes through a typed config module per app; never read `process.env` ad hoc.
- Errors are typed; API returns the shapes above. Log with a request/job id.
- Tests: at minimum unit-test the Zod validation + the prompt builder + the cache-key hash.

## Env vars (document in README, never commit)

`MONGODB_URI`, `REDIS_URL`, `PORT`, `CLIENT_ORIGIN` (CORS), `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_WS_URL`. Worker (AWS Bedrock): `AWS_BEARER_TOKEN_BEDROCK` (Bedrock API key — never
committed), `AWS_REGION`, `BEDROCK_MODEL_ID`, `BEDROCK_MAX_TOKENS`. For local dev, `apps/api` and
`apps/worker` load the monorepo-root `.env` via dotenv; `apps/web` reads `apps/web/.env.local`.

---

## Contract change log

- (init) Baseline contract established in Phase 0.
- (worker) Added an optional `pdf` Buffer field to the `QuestionPaper` Mongoose
  model (`packages/db`). The worker's `render-pdf` job stores the rendered
  exam-paper PDF bytes there so the API can stream them from
  `GET /api/papers/:id/pdf`. It is server-side storage only and is NOT part of
  the JSON `QuestionPaper` Zod contract (binary blob, served via a dedicated route).
- (e2e/bedrock) LLM provider switched from `@anthropic-ai/sdk` to **AWS Bedrock**
  via `@aws-sdk/client-bedrock-runtime` (Converse API). Structured outputs use the
  Converse `outputConfig.textFormat` (json_schema as a string) on the `bedrock-runtime`
  endpoint — Bedrock's Anthropic Messages `output_config` path returns 400. Worker env
  is now `AWS_BEARER_TOKEN_BEDROCK` / `AWS_REGION` / `BEDROCK_MODEL_ID` /
  `BEDROCK_MAX_TOKENS` (replacing `ANTHROPIC_*`); `apps/api` + `apps/worker` load the
  root `.env` via dotenv. **No `packages/shared` shape changed** — enums, schemas,
  WS events, REST routes, and the queue contract are identical end to end (verified in
  web + api + worker). Added a CI-safe e2e happy-path test (`apps/api/src/e2e.test.ts`)
  that drives REST → queue → in-process worker (stubbed LLM) → Mongo and asserts a valid
  stored `QuestionPaper`; it auto-skips when Mongo/Redis are unreachable.
- (api) Added `DELETE /assignments/:id` route to delete an assignment and its associated paper.
- (web) Redesigned the Assignments experience to the Figma `desktop3`/`mobileview3`
  screens: a single shared `AssignmentsView` (rendered by both `/` and `/assignments`)
  with a Filter+Search toolbar, a 2-column card grid, a per-card actions menu
  (View / Delete), a floating "Create Assignment" button, and a confirmation modal
  for delete (replacing `confirm()`/`alert()` with `sonner` toasts). Deletes call the
  existing `DELETE /assignments/:id` and emit a `window` `assignments:changed` event so
  the sidebar count stays in sync. **Web/UI only — no `packages/shared` shape, REST
  route, WS event, or queue contract changed.**
- (web) Output + realtime/UX hardening (no contract change): paper actions now
  expose only **Download PDF** (Print + Regenerate buttons removed; the failed-state
  "Try again" retry, which still uses `POST /assignments/:id/regenerate`, stays) and
  the answer key is always shown (Show/Hide toggle removed). Download is a client-side
  blob fetch of `GET /papers/:id/pdf` (a cross-origin `<a download>` is ignored by
  browsers, so the old link navigated the tab to the PDF — which also closed the
  socket); it now saves reliably with a clean filename. The generation socket allows a
  polling fallback, reconnects indefinitely, and re-joins + re-syncs assignment/PDF
  state on every (re)connect, recovering missed `completed`/`pdf:ready` events (the
  download no longer sticks on "Preparing PDF…" after a refresh). Also fixed the mobile
  bottom-nav links (Assignments → `/assignments`; unbuilt items show a toast) and the
  assignment-card 3-dot menu z-index stacking. The `GET /papers/:id/pdf` route is
  unchanged.
- (web) Output page aligned to the Figma `desktop2`/`mobileview2` screen and the PDF
  download made bulletproof (no contract change): removed the redundant green-dot page
  header (the dark download panel is the header). The Download button is now always
  available (keyed off `paper.id`, not the `pdf:ready` event), fetches with a short
  404 retry while the render job finishes, and revokes the object URL on a delay —
  revoking it immediately after `click()` was cancelling the save in some browsers
  (e.g. Safari), which was why downloads appeared to do nothing.
- (api) Fixed `GET /papers/:id/pdf` serving a CORRUPT file (the "not a valid PDF" bug).
  The route read the bytes with `.lean()`, which surfaces the `pdf` field as a BSON
  `Binary` object; `res.send(<object>)` then JSON-serialized it to a base64 string
  while leaving `Content-Type: application/pdf`, so the download was JSON text, not a
  PDF. Now reads the HYDRATED document (a real Node `Buffer`), normalizes defensively,
  sets `Content-Length`, and `res.end(bytes)`. The renderer + storage were already
  correct (verified the stored bytes start with `%PDF`), so no Puppeteer/headless
  browser is needed — the route output contract is unchanged.
- (web) Fixed the assignment detail page flashing the "generating" UI for a split
  second on refresh: while the run state is still being recovered from the server
  (`status === null`), the page now renders a neutral loader instead of
  `GenerationStatus`. Real generations still set `status` to `queued`/`active` (via
  `beginRun`/the socket) so the live progress UI is unaffected.
- (contract) Added the `pdf:failed` WS event (`{ assignmentId, paperId, error }`)
  and `POST /papers/:id/pdf` (`202 { jobId }`) so a failed PDF render is no longer
  silent. The worker now publishes `pdf:failed` when a `render-pdf` job exhausts its
  retries (previously only `generate-paper` failures surfaced); the client shows a
  real error + a **Try again** action that calls `POST /papers/:id/pdf` to
  re-enqueue `render-pdf` (no LLM re-run). The web `ActionBar` now reflects PDF state
  (Preparing / Download / Failed+retry) from `pdf:ready`/`pdf:failed`, and the download
  404-retry window was widened. The `render-pdf` render still uses `@react-pdf/renderer`
  (no headless browser). Also removed the "AI-generated question paper" subtitle from
  both the web `QuestionPaperView` and the PDF `document.tsx` (kept in lock-step).
- (docs) Documented the existing `GET /api/assignments` list route (returns
  `{ assignments: Assignment[], total: number }`) in the REST table above. It was
  already implemented and used by the web app (`listAssignments`) but missing
  from this contract — no shape or behavior change. The README now also carries
  the full contract (data model, REST, WebSocket, queue) inline.