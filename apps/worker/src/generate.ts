import type { ZodError } from "zod";
import type { CreateAssignmentInput } from "@veda-ai/shared";
import { QuestionPaperContent } from "./paperSchema.js";
import { buildUserPrompt } from "./prompt.js";

/**
 * A single chat turn. The system prompt is supplied separately by the
 * `GenerateFn` implementation (it is fixed for the conversation), so messages
 * only ever carry `user`/`assistant` turns.
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Abstraction over "call the model with these messages and return its raw text".
 * The real implementation (see `anthropic.ts`) wires this to the Anthropic SDK
 * with structured outputs; tests inject a fake to exercise the validate/repair
 * logic without any network calls.
 */
export type GenerateFn = (messages: ChatMessage[]) => Promise<string>;

/** Thrown when the model output fails validation even after one repair attempt. */
export class PaperValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Generated paper failed validation: ${issues.join("; ")}`);
    this.name = "PaperValidationError";
    this.issues = issues;
  }
}

type ParseResult =
  | { ok: true; data: QuestionPaperContent }
  | { ok: false; issues: string[] };

function formatIssues(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `${path}: ${issue.message}`;
  });
}

/** Parse raw model text as JSON and validate it against the content schema. */
function parseAndValidate(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      issues: [`Response was not valid JSON: ${(error as Error).message}`],
    };
  }

  const result = QuestionPaperContent.safeParse(json);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, issues: formatIssues(result.error) };
}

/** The follow-up user turn asking the model to fix the listed problems. */
function buildRepairPrompt(issues: string[]): string {
  return [
    "Your previous response did not satisfy the required structure.",
    "Fix the following problems and return the corrected question paper.",
    "Return only the corrected structured data, with no commentary.",
    "",
    "Problems:",
    ...issues.map((issue) => `- ${issue}`),
  ].join("\n");
}

/**
 * Generate validated question-paper content. Calls the model once; if the
 * output fails Zod validation (including our semantic invariants) we perform
 * exactly ONE repair round-trip — feeding the model its own (now in-context)
 * output plus the concrete issue list — and re-validate. A second failure
 * throws {@link PaperValidationError}. This function is intentionally free of
 * any SDK dependency so it can be unit-tested with a fake {@link GenerateFn}.
 */
export async function generatePaperContent(
  generate: GenerateFn,
  input: CreateAssignmentInput,
): Promise<QuestionPaperContent> {
  const messages: ChatMessage[] = [
    { role: "user", content: buildUserPrompt(input) },
  ];

  const firstRaw = await generate(messages);
  const firstResult = parseAndValidate(firstRaw);
  if (firstResult.ok) {
    return firstResult.data;
  }

  messages.push({ role: "assistant", content: firstRaw });
  messages.push({ role: "user", content: buildRepairPrompt(firstResult.issues) });

  const repairedRaw = await generate(messages);
  const repairedResult = parseAndValidate(repairedRaw);
  if (repairedResult.ok) {
    return repairedResult.data;
  }

  throw new PaperValidationError(repairedResult.issues);
}
