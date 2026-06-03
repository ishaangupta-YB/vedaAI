import type { HydratedDocument } from "mongoose";
import type { AssignmentSchema, QuestionPaperSchema } from "@veda-ai/db";
import type {
  Assignment,
  Difficulty,
  JobStatus,
  QuestionPaper,
  QuestionType,
} from "@veda-ai/shared";

/**
 * Map Mongoose documents to the shared wire shapes (CLAUDE.md is the contract).
 * Two responsibilities live here and nowhere else:
 *  - Mongo's `_id` becomes the shared string `id`.
 *  - `timestamps` Dates become ISO datetime strings.
 * Mongo-only fields (`_id`, `__v`, and any stored binary like a rendered PDF) are
 * dropped here — clients only ever see the validated contract shape.
 */

type AssignmentDoc = HydratedDocument<AssignmentSchema>;
type QuestionPaperDoc = HydratedDocument<QuestionPaperSchema>;

/** Runtime view of an assignment `.toObject()` (timestamps + _id included). */
interface RawAssignment {
  _id: unknown;
  title: string;
  dueDate: string;
  questionConfigs: { type: QuestionType; count: number; marksPerQuestion: number }[];
  additionalInstructions?: string | null;
  sourceText?: string | null;
  status: JobStatus;
  jobId?: string | null;
  paperId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface RawQuestion {
  id: string;
  text: string;
  type: QuestionType;
  difficulty: Difficulty;
  marks: number;
  options?: string[] | null;
  answer?: string | null;
}

interface RawSection {
  id: string;
  title: string;
  instruction: string;
  questions: RawQuestion[];
}

interface RawQuestionPaper {
  _id: unknown;
  assignmentId: string;
  title: string;
  totalMarks: number;
  sections: RawSection[];
  generatedAt: string;
}

function toIso(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

export function serializeAssignment(doc: AssignmentDoc): Assignment {
  const o = doc.toObject() as unknown as RawAssignment;
  return {
    id: String(o._id),
    title: o.title,
    dueDate: o.dueDate,
    questionConfigs: o.questionConfigs.map((c) => ({
      type: c.type,
      count: c.count,
      marksPerQuestion: c.marksPerQuestion,
    })),
    additionalInstructions: o.additionalInstructions ?? undefined,
    sourceText: o.sourceText ?? undefined,
    status: o.status,
    jobId: o.jobId ?? undefined,
    paperId: o.paperId ?? undefined,
    createdAt: toIso(o.createdAt),
    updatedAt: toIso(o.updatedAt),
  };
}

export function serializeQuestionPaper(doc: QuestionPaperDoc): QuestionPaper {
  const o = doc.toObject() as unknown as RawQuestionPaper;
  return {
    id: String(o._id),
    assignmentId: o.assignmentId,
    title: o.title,
    totalMarks: o.totalMarks,
    sections: o.sections.map((s) => ({
      id: s.id,
      title: s.title,
      instruction: s.instruction,
      questions: s.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        marks: q.marks,
        options: q.options && q.options.length > 0 ? q.options : undefined,
        answer: q.answer ?? undefined,
      })),
    })),
    generatedAt: o.generatedAt,
  };
}
