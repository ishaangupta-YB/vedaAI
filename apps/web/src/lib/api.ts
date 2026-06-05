import {
  API_ROUTES,
  CreateAssignmentInput,
  QuestionPaper,
  type Assignment,
} from "@veda-ai/shared";
import { config } from "@/src/config";
import * as mock from "@/src/lib/mock";

const USE_MOCK = config.NEXT_PUBLIC_USE_MOCK;

export interface CreateAssignmentResult {
  assignmentId: string;
  jobId: string;
}

export interface GetAssignmentResult {
  assignment: Assignment;
  paper?: QuestionPaper;
}

export interface ListAssignmentsResult {
  assignments: Assignment[];
  total: number;
}

/** Error thrown for non-2xx responses; carries server-provided Zod issues. */
export class ApiError extends Error {
  readonly status: number;
  readonly issues?: unknown;
  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

export function apiUrl(path: string): string {
  return `${config.NEXT_PUBLIC_API_URL}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
    );
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string; issues?: unknown }
      | null;
    throw new ApiError(
      body?.error ?? `Request failed (${res.status})`,
      res.status,
      body?.issues,
    );
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function uploadSource(file: File): Promise<{ sourceText: string }> {
  if (USE_MOCK) return mock.uploadSource(file);
  const form = new FormData();
  form.append("file", file);
  return request<{ sourceText: string }>(API_ROUTES.UPLOADS, {
    method: "POST",
    body: form,
  });
}

export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<CreateAssignmentResult> {
  // Validate once more against the shared schema before hitting the wire.
  const payload = CreateAssignmentInput.parse(input);
  if (USE_MOCK) return mock.createAssignment(payload);
  return request<CreateAssignmentResult>(API_ROUTES.ASSIGNMENTS, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAssignments(): Promise<ListAssignmentsResult> {
  if (USE_MOCK) return mock.listAssignments();
  return request<ListAssignmentsResult>(API_ROUTES.ASSIGNMENTS);
}

export async function getAssignment(id: string): Promise<GetAssignmentResult> {
  if (USE_MOCK) return mock.getAssignment(id);
  const data = await request<GetAssignmentResult>(API_ROUTES.ASSIGNMENT(id));
  // Never trust raw data — validate the paper if present.
  if (data.paper) data.paper = QuestionPaper.parse(data.paper);
  return data;
}

export async function getPaper(id: string): Promise<QuestionPaper> {
  if (USE_MOCK) return mock.getPaper(id);
  const data = await request<unknown>(API_ROUTES.PAPER(id));
  return QuestionPaper.parse(data);
}

export async function regenerate(id: string): Promise<{ jobId: string }> {
  if (USE_MOCK) return mock.regenerate(id);
  return request<{ jobId: string }>(API_ROUTES.ASSIGNMENT_REGENERATE(id), {
    method: "POST",
  });
}

export async function deleteAssignment(id: string): Promise<void> {
  if (USE_MOCK) return mock.deleteAssignment(id);
  await request<void>(API_ROUTES.ASSIGNMENT(id), {
    method: "DELETE",
  });
}

/** Absolute URL to the server-rendered PDF for a paper. */
export function paperPdfUrl(paperId: string): string {
  return apiUrl(API_ROUTES.PAPER_PDF(paperId));
}

/**
 * Ask the server to (re)render a paper's PDF. Used to recover from a
 * `pdf:failed` event without re-running generation; the `pdf:ready` event fires
 * once the new render is stored.
 */
export async function renderPdf(paperId: string): Promise<{ jobId?: string }> {
  if (USE_MOCK) return { jobId: "mock" };
  return request<{ jobId?: string }>(API_ROUTES.PAPER_PDF(paperId), {
    method: "POST",
  });
}
