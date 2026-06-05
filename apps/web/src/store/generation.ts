import { create } from "zustand";
import type { JobStatus, QuestionPaper } from "@veda-ai/shared";

/** `null` represents the idle state before a generation run begins. */
export type GenerationStatus = JobStatus | null;

interface GenerationState {
  /** The assignment currently being tracked. */
  assignmentId: string | null;
  jobId: string | null;
  /** Latest job status pushed over the socket (or fetched on load). */
  status: GenerationStatus;
  /** 0..100 progress for the active run. */
  progress: number;
  /** Human-readable stage label (e.g. "Calling model"). */
  stage: string | null;
  /** The validated paper — the ONLY thing the output UI renders from. */
  paper: QuestionPaper | null;
  /** Download URL, populated when the `pdf:ready` event arrives. */
  pdfUrl: string | null;
  /** PDF render failure message, from a `pdf:failed` event. */
  pdfError: string | null;
  /** Failure message from a `generation:failed` event. */
  error: string | null;

  /** Start (or restart) tracking a run — clears prior progress/result. */
  beginRun: (assignmentId: string, jobId?: string) => void;
  /** Point the store at an assignment for viewing, clearing stale state. */
  prepareFor: (assignmentId: string) => void;
  setStatus: (status: GenerationStatus) => void;
  setProgress: (progress: number, stage?: string) => void;
  setPaper: (paper: QuestionPaper) => void;
  setPdfUrl: (url: string) => void;
  setPdfError: (message: string | null) => void;
  setError: (message: string) => void;
  reset: () => void;
}

const initial = {
  assignmentId: null,
  jobId: null,
  status: null as GenerationStatus,
  progress: 0,
  stage: null,
  paper: null,
  pdfUrl: null,
  pdfError: null,
  error: null,
};

export const useGenerationStore = create<GenerationState>((set) => ({
  ...initial,

  beginRun: (assignmentId, jobId) =>
    set({
      assignmentId,
      jobId: jobId ?? null,
      status: "queued",
      progress: 0,
      stage: null,
      paper: null,
      pdfUrl: null,
      pdfError: null,
      error: null,
    }),

  prepareFor: (assignmentId) =>
    set({ ...initial, assignmentId }),

  setStatus: (status) => set({ status }),

  setProgress: (progress, stage) =>
    set((state) => ({
      progress: Math.max(0, Math.min(100, progress)),
      stage: stage ?? state.stage,
    })),

  setPaper: (paper) => set({ paper, status: "completed", progress: 100 }),

  setPdfUrl: (pdfUrl) => set({ pdfUrl, pdfError: null }),

  setPdfError: (pdfError) => set({ pdfError }),

  setError: (error) => set({ error, status: "failed" }),

  reset: () => set({ ...initial }),
}));
