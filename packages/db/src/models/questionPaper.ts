import mongoose from "mongoose";
import type { InferSchemaType, Model } from "mongoose";
import { Difficulty, QuestionType } from "@veda-ai/shared";

const { Schema, model, models } = mongoose;

/**
 * Mongoose model for `QuestionPaper`, mirroring the shared `QuestionPaper` Zod
 * schema. `assignmentId` is indexed (papers are looked up by assignment).
 */
const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    type: { type: String, enum: QuestionType.options, required: true },
    difficulty: { type: String, enum: Difficulty.options, required: true },
    marks: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number): boolean => value > 0,
        message: "marks must be greater than 0",
      },
    },
    options: { type: [String] },
    answer: { type: String },
  },
  { _id: false },
);

const sectionSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    instruction: { type: String, required: true },
    questions: { type: [questionSchema], required: true },
  },
  { _id: false },
);

const questionPaperSchema = new Schema(
  {
    assignmentId: { type: String, required: true },
    title: { type: String, required: true },
    totalMarks: { type: Number, required: true },
    sections: { type: [sectionSchema], required: true },
    generatedAt: { type: String, required: true },
  },
  { timestamps: true },
);

questionPaperSchema.index({ assignmentId: 1 });

export type QuestionPaperSchema = InferSchemaType<typeof questionPaperSchema>;

export const QuestionPaperModel: Model<QuestionPaperSchema> =
  (models.QuestionPaper as Model<QuestionPaperSchema> | undefined) ??
  model<QuestionPaperSchema>("QuestionPaper", questionPaperSchema);
