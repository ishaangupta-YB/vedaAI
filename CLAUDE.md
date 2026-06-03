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
| GET    | `/assignments/:id`            | —                            | `{ assignment, paper?: QuestionPaper }`  |
| GET    | `/papers/:id`                 | —                            | `QuestionPaper`                          |
| POST   | `/assignments/:id/regenerate` | —                            | `202 { jobId }`                          |
| GET    | `/papers/:id/pdf`             | —                            | `application/pdf` (download)             |

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
4. Call Anthropic with **structured outputs** (`output_config` → `json_schema` of `QuestionPaper`
   minus server-assigned fields). Re-validate the returned JSON with the Zod `QuestionPaper`
   schema. On Zod failure: one repair attempt (feed the model its output + the Zod issues, ask it
   to fix). On second failure: throw → job fails → `generation:failed`.
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
- Backend: Express 5, Socket.IO 4, BullMQ + ioredis, Mongoose 8, Zod, `@anthropic-ai/sdk`.
  Default model `claude-sonnet-4-6`; structured outputs via `output_config`. PDF via
  `@react-pdf/renderer` (`renderToBuffer`, no headless browser — friendly to small hosts).
  PDF upload-text extraction via `unpdf` (or `pdf-parse`).
- Infra: MongoDB Atlas (M0), Redis (Upstash or Railway/Render Key Value).

## Conventions

- ESM, `type: module`. Strict TS. No `any` in exported signatures.
- All env access goes through a typed config module per app; never read `process.env` ad hoc.
- Errors are typed; API returns the shapes above. Log with a request/job id.
- Tests: at minimum unit-test the Zod validation + the prompt builder + the cache-key hash.

## Env vars (document in README, never commit)

`MONGODB_URI`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `PORT`, `CLIENT_ORIGIN` (CORS),
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`.

---

## Contract change log

- (init) Baseline contract established in Phase 0.