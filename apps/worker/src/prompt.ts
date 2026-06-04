import type { CreateAssignmentInput, QuestionType } from "@veda-ai/shared";

/**
 * Deterministic prompt construction — the graded "input -> structured prompt"
 * step (CLAUDE.md "Prompt construction"). Given the same `CreateAssignmentInput`
 * these builders always produce byte-identical prompts, which is what the
 * snapshot test pins. Schema enforcement is intentionally NOT described here;
 * that belongs to the structured-output layer (Bedrock Converse
 * `outputConfig.textFormat`).
 */

/** Human-readable section heading for each question type. */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple Choice Questions",
  short_answer: "Short Answer Questions",
  long_answer: "Long Answer Questions",
  true_false: "True or False Questions",
  fill_blank: "Fill in the Blanks",
};

/** A sensible default "how to answer" instruction for each question type. */
export const SECTION_INSTRUCTIONS: Record<QuestionType, string> = {
  mcq: "Choose the single best option for each question.",
  short_answer: "Answer each question briefly in two or three sentences.",
  long_answer: "Answer each question in detail.",
  true_false: "State whether each statement is true or false.",
  fill_blank: "Fill in each blank with the correct word or phrase.",
};

/** "Section A", "Section B", ... for a zero-based section index. */
export function sectionLabel(index: number): string {
  return `Section ${String.fromCharCode(65 + index)}`;
}

/**
 * Split `count` questions across difficulty bands using a roughly 30/40/30
 * easy/moderate/hard spread. `easy` and `hard` are floored at 30% each and the
 * remainder (the largest band) goes to `moderate`, so totals always sum to
 * `count` and small counts gracefully collapse onto `moderate`.
 */
export function difficultySpread(count: number): {
  easy: number;
  moderate: number;
  hard: number;
} {
  const easy = Math.floor(count * 0.3);
  const hard = Math.floor(count * 0.3);
  const moderate = count - easy - hard;
  return { easy, moderate, hard };
}

/** The system prompt: states the task and content rules, not the schema. */
export function buildSystemPrompt(): string {
  return [
    "You are an expert exam-paper author for school and university assessments.",
    "Produce a complete, well-formed question paper as structured data.",
    "",
    "Rules:",
    "- Every question must be clear, self-contained, and suitable for its stated difficulty.",
    "- Use only the difficulty levels easy, moderate, or hard.",
    "- Give each question exactly the marks specified for its section.",
    "- For multiple-choice questions, provide four plausible options with exactly one correct answer, and set the answer to the text of the correct option.",
    "- Provide a concise model answer in each question's answer field.",
    "- Group questions by type into the sections described, in the given order.",
    "- Do not add commentary, preamble, or any text outside the requested structure.",
  ].join("\n");
}

/**
 * The user prompt assembled deterministically from the assignment input:
 * per-type counts, marks per question, a target difficulty spread, the section
 * grouping/instruction, the teacher's additional instructions, and the uploaded
 * source material as grounding context (when present).
 */
export function buildUserPrompt(input: CreateAssignmentInput): string {
  const totalQuestions = input.questionConfigs.reduce(
    (sum, config) => sum + config.count,
    0,
  );

  const lines: string[] = [];
  lines.push(`Generate a question paper titled "${input.title}".`);
  lines.push("");
  lines.push(
    `Produce ${totalQuestions} question(s) across ${input.questionConfigs.length} section(s). ` +
      "Group questions by type into the sections below, in order. " +
      'Title each section exactly "Section A", "Section B", and so on.',
  );

  input.questionConfigs.forEach((config, index) => {
    const spread = difficultySpread(config.count);
    lines.push("");
    lines.push(`${sectionLabel(index)} — ${QUESTION_TYPE_LABELS[config.type]}`);
    lines.push(`- Number of questions: ${config.count}`);
    lines.push(`- Marks per question: ${config.marksPerQuestion}`);
    lines.push(`- Section instruction: ${SECTION_INSTRUCTIONS[config.type]}`);
    lines.push(
      `- Target difficulty spread (easy/moderate/hard): ${spread.easy}/${spread.moderate}/${spread.hard}`,
    );
    if (config.type === "mcq") {
      lines.push(
        "- Provide exactly four answer options per question, with exactly one correct option.",
      );
    }
  });

  if (input.additionalInstructions) {
    lines.push("");
    lines.push("Additional instructions from the teacher:");
    lines.push(input.additionalInstructions);
  }

  if (input.sourceText) {
    lines.push("");
    lines.push("Base the questions on the following source material:");
    lines.push('"""');
    lines.push(input.sourceText);
    lines.push('"""');
  }

  return lines.join("\n");
}
