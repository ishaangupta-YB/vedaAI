import { randomUUID } from "node:crypto";
import type {
  CreateAssignmentInput,
  Question,
  QuestionPaper,
  Section,
} from "@veda-ai/shared";
import type { QuestionPaperContent } from "./paperSchema.js";

/** Fields persisted for a question paper (paper `id` is Mongo's `_id`). */
export interface PersistablePaper {
  assignmentId: string;
  title: string;
  totalMarks: number;
  sections: Section[];
  generatedAt: string;
}

/** Drop `undefined` optional keys so stored/validated objects stay clean. */
function questionFromContent(question: QuestionPaperContent["sections"][number]["questions"][number]): Question {
  return {
    id: randomUUID(),
    text: question.text,
    type: question.type,
    difficulty: question.difficulty,
    marks: question.marks,
    ...(question.options !== undefined ? { options: question.options } : {}),
    ...(question.answer !== undefined ? { answer: question.answer } : {}),
  };
}

/**
 * Turn validated, id-less model content into a persistable paper: assign a
 * fresh id to every section and question, and recompute `totalMarks` from the
 * questions (we never trust the model's own total). `generatedAt` is stamped
 * now. Used by both fresh generation and cache reuse so the two paths produce
 * identically-shaped papers.
 */
export function buildPaperFields(
  content: QuestionPaperContent,
  assignmentId: string,
): PersistablePaper {
  const sections: Section[] = content.sections.map((section) => ({
    id: randomUUID(),
    title: section.title,
    instruction: section.instruction,
    questions: section.questions.map(questionFromContent),
  }));

  const totalMarks = sections.reduce(
    (sum, section) =>
      sum + section.questions.reduce((acc, question) => acc + question.marks, 0),
    0,
  );

  return {
    assignmentId,
    title: content.title,
    totalMarks,
    sections,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Project a stored assignment document down to the exact `CreateAssignmentInput`
 * shape used for the cache key, omitting empty optional fields so the hash is
 * stable (see `stableInputHash`).
 */
export function toCreateAssignmentInput(assignment: {
  title: string;
  dueDate: string;
  questionConfigs: { type: string; count: number; marksPerQuestion: number }[];
  additionalInstructions?: string | null;
  sourceText?: string | null;
}): CreateAssignmentInput {
  return {
    title: assignment.title,
    dueDate: assignment.dueDate,
    questionConfigs: assignment.questionConfigs.map((config) => ({
      type: config.type as CreateAssignmentInput["questionConfigs"][number]["type"],
      count: config.count,
      marksPerQuestion: config.marksPerQuestion,
    })),
    ...(assignment.additionalInstructions
      ? { additionalInstructions: assignment.additionalInstructions }
      : {}),
    ...(assignment.sourceText ? { sourceText: assignment.sourceText } : {}),
  };
}

/** Assemble the full shared `QuestionPaper` from a stored paper document. */
export function toQuestionPaper(
  paperId: string,
  fields: PersistablePaper,
): QuestionPaper {
  return {
    id: paperId,
    assignmentId: fields.assignmentId,
    title: fields.title,
    totalMarks: fields.totalMarks,
    sections: fields.sections,
    generatedAt: fields.generatedAt,
  };
}
