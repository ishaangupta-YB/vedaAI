import {
  type Assignment,
  type CreateAssignmentInput,
  type Difficulty,
  type Question,
  type QuestionPaper,
  type QuestionType,
  type Section,
} from "@veda-ai/shared";
import type { WsEnvelope } from "@/src/lib/ws-events";

/**
 * In-memory mock of the REST + realtime contract for local demos. This is a
 * pure frontend stub: it implements NO backend, worker, or LLM logic — it just
 * fabricates a schema-valid QuestionPaper and replays the documented socket
 * event sequence so the UI can be exercised without a live server.
 *
 * Gated behind NEXT_PUBLIC_USE_MOCK; never used when a real API is configured.
 */

type Listener = (msg: WsEnvelope) => void;

interface Run {
  input: CreateAssignmentInput;
  assignment: Assignment;
  paper?: QuestionPaper;
  started: boolean;
  timers: ReturnType<typeof setTimeout>[];
}

const runs = new Map<string, Run>();
const paperIndex = new Map<string, QuestionPaper>(); // paperId -> paper
const listeners = new Map<string, Set<Listener>>(); // assignmentId -> listeners

function uid(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${rand}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emit(assignmentId: string, msg: WsEnvelope): void {
  listeners.get(assignmentId)?.forEach((fn) => fn(msg));
}

// ---------------------------------------------------------------------------
// Paper fabrication (placeholder content — purely to populate the UI)
// ---------------------------------------------------------------------------

const SECTION_INSTRUCTIONS: Record<QuestionType, string> = {
  mcq: "Choose the correct option for each question.",
  short_answer: "Answer the following questions briefly.",
  long_answer: "Write detailed answers for the following questions.",
  true_false: "State whether each statement is true or false.",
  fill_blank: "Fill in the blanks with the appropriate words.",
};

const TEMPLATES: Record<QuestionType, string[]> = {
  mcq: [
    "Which of the following best describes {t}?",
    "Identify the correct statement about {t}.",
    "What is the primary characteristic of {t}?",
    "Which option is most closely associated with {t}?",
  ],
  short_answer: [
    "Define {t} and state its significance.",
    "Briefly explain the key idea behind {t}.",
    "Give one real-world example that illustrates {t}.",
    "List two important features of {t}.",
  ],
  long_answer: [
    "Discuss {t} in detail, supporting your answer with examples.",
    "Explain the causes and effects related to {t}.",
    "Compare and contrast the major aspects of {t}.",
    "Critically analyse the importance of {t} with relevant reasoning.",
  ],
  true_false: [
    "{t} always produces the same outcome under identical conditions.",
    "{t} can be observed in everyday situations.",
    "The principles of {t} were established only in the last decade.",
    "{t} has no measurable effect on its surroundings.",
  ],
  fill_blank: [
    "The process of {t} primarily involves __________.",
    "A key property of {t} is its __________.",
    "{t} is commonly measured in __________.",
    "The opposite of {t} is __________.",
  ],
};

const MCQ_OPTIONS: string[][] = [
  ["It increases with temperature", "It remains constant", "It decreases with pressure", "None of the above"],
  ["A renewable resource", "A chemical reaction", "A physical change", "An external force"],
  ["Conduction", "Convection", "Radiation", "All of the above"],
  ["Directly proportional", "Inversely proportional", "Unrelated", "Exponential"],
];

function difficultySpread(count: number): Difficulty[] {
  const easy = Math.round(count * 0.3);
  const hard = Math.round(count * 0.3);
  const moderate = Math.max(0, count - easy - hard);
  const out: Difficulty[] = [
    ...Array<Difficulty>(easy).fill("easy"),
    ...Array<Difficulty>(moderate).fill("moderate"),
    ...Array<Difficulty>(hard).fill("hard"),
  ];
  // Interleave so the paper isn't strictly blocked by difficulty.
  return out
    .map((d, i) => ({ d, k: (i * 7) % count }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.d);
}

function buildPaper(input: CreateAssignmentInput, assignmentId: string): QuestionPaper {
  const topic = input.title.replace(/^(quiz|test|exam|assignment)\s+(on\s+)?/i, "").trim() || input.title;
  let total = 0;

  const sections: Section[] = input.questionConfigs.map((cfg, sectionIdx) => {
    const spread = difficultySpread(cfg.count);
    const templates = TEMPLATES[cfg.type];

    const questions: Question[] = Array.from({ length: cfg.count }, (_, i) => {
      const difficulty = spread[i] ?? "moderate";
      const base = templates[i % templates.length] ?? "Question about {t}.";
      const text = base.replace("{t}", topic);
      total += cfg.marksPerQuestion;

      const question: Question = {
        id: uid("q"),
        text,
        type: cfg.type,
        difficulty,
        marks: cfg.marksPerQuestion,
      };
      if (cfg.type === "mcq") {
        question.options = MCQ_OPTIONS[i % MCQ_OPTIONS.length];
        question.answer = question.options[0];
      } else if (cfg.type === "true_false") {
        question.options = ["True", "False"];
        question.answer = i % 2 === 0 ? "True" : "False";
      } else {
        question.answer = `Model answer for "${text}" would be evaluated against the marking scheme.`;
      }
      return question;
    });

    return {
      id: uid("sec"),
      title: `Section ${String.fromCharCode(65 + sectionIdx)}`,
      instruction: `${SECTION_INSTRUCTIONS[cfg.type]} Each question carries ${cfg.marksPerQuestion} mark${cfg.marksPerQuestion === 1 ? "" : "s"}.`,
      questions,
    };
  });

  return {
    id: uid("paper"),
    assignmentId,
    title: input.title,
    totalMarks: total,
    sections,
    generatedAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Simulated job lifecycle
// ---------------------------------------------------------------------------

function startRun(assignmentId: string): void {
  const run = runs.get(assignmentId);
  if (!run || run.started) return;
  run.started = true;
  run.timers.forEach(clearTimeout);
  run.timers = [];

  const schedule = (ms: number, fn: () => void) => {
    run.timers.push(setTimeout(fn, ms));
  };

  run.assignment = { ...run.assignment, status: "queued", updatedAt: nowIso() };
  emit(assignmentId, {
    event: "generation:queued",
    payload: { assignmentId, jobId: run.assignment.jobId ?? uid("job") },
  });

  schedule(450, () => {
    run.assignment = { ...run.assignment, status: "active", updatedAt: nowIso() };
    emit(assignmentId, { event: "generation:active", payload: { assignmentId } });
  });
  schedule(750, () =>
    emit(assignmentId, { event: "generation:progress", payload: { assignmentId, progress: 10, stage: "Building prompt" } }),
  );
  schedule(1500, () =>
    emit(assignmentId, { event: "generation:progress", payload: { assignmentId, progress: 40, stage: "Calling model" } }),
  );
  schedule(2600, () =>
    emit(assignmentId, { event: "generation:progress", payload: { assignmentId, progress: 80, stage: "Validating output" } }),
  );
  schedule(3400, () => {
    const paper = buildPaper(run.input, assignmentId);
    run.paper = paper;
    paperIndex.set(paper.id, paper);
    run.assignment = { ...run.assignment, status: "completed", paperId: paper.id, updatedAt: nowIso() };
    emit(assignmentId, { event: "generation:progress", payload: { assignmentId, progress: 100, stage: "Done" } });
    emit(assignmentId, { event: "generation:completed", payload: { assignmentId, paperId: paper.id } });
  });
  schedule(4400, () => {
    if (!run.paper) return;
    emit(assignmentId, {
      event: "pdf:ready",
      payload: { assignmentId, paperId: run.paper.id, url: `${run.input.title}.pdf` },
    });
  });
}

// ---------------------------------------------------------------------------
// Public mock API (mirrors src/lib/api.ts)
// ---------------------------------------------------------------------------

export function uploadSource(file: File): Promise<{ sourceText: string }> {
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          sourceText: `Extracted text from "${file.name}". In mock mode this stands in for the parsed PDF/text content used to ground generation.`,
        }),
      600,
    );
  });
}

export function createAssignment(
  input: CreateAssignmentInput,
): Promise<{ assignmentId: string; jobId: string }> {
  const assignmentId = uid("asg");
  const jobId = uid("job");
  const assignment: Assignment = {
    ...input,
    id: assignmentId,
    status: "queued",
    jobId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  runs.set(assignmentId, { input, assignment, started: false, timers: [] });
  return Promise.resolve({ assignmentId, jobId });
}

export function listAssignments(): Promise<{ assignments: Assignment[]; total: number }> {
  const assignments = Array.from(runs.values()).map((r) => r.assignment);
  return Promise.resolve({ assignments, total: assignments.length });
}

export function getAssignment(
  id: string,
): Promise<{ assignment: Assignment; paper?: QuestionPaper }> {
  const run = runs.get(id);
  if (!run) {
    return Promise.reject(new Error("NotFound"));
  }
  return Promise.resolve({ assignment: run.assignment, paper: run.paper });
}

export function getPaper(id: string): Promise<QuestionPaper> {
  const paper = paperIndex.get(id);
  if (!paper) return Promise.reject(new Error("NotFound"));
  return Promise.resolve(paper);
}

export function regenerate(id: string): Promise<{ jobId: string }> {
  const run = runs.get(id);
  if (!run) return Promise.reject(new Error("NotFound"));
  const jobId = uid("job");
  run.paper = undefined;
  run.started = false;
  run.assignment = { ...run.assignment, status: "queued", jobId, paperId: undefined, updatedAt: nowIso() };
  // Restart immediately if the page is already listening.
  if ((listeners.get(id)?.size ?? 0) > 0) startRun(id);
  return Promise.resolve({ jobId });
}

export function deleteAssignment(id: string): Promise<void> {
  const run = runs.get(id);
  if (!run) return Promise.reject(new Error("NotFound"));
  if (run.paper) {
    paperIndex.delete(run.paper.id);
  }
  run.timers.forEach(clearTimeout);
  runs.delete(id);
  listeners.delete(id);
  return Promise.resolve();
}

/** Subscribe to a mock "room". Kicks off the run lazily once joined. */
export function subscribe(assignmentId: string, listener: Listener): () => void {
  let set = listeners.get(assignmentId);
  if (!set) {
    set = new Set();
    listeners.set(assignmentId, set);
  }
  set.add(listener);
  // Defer so the caller can finish wiring before events start flowing.
  setTimeout(() => startRun(assignmentId), 0);
  return () => {
    set?.delete(listener);
  };
}
