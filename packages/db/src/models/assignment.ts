import mongoose from "mongoose";
import type { InferSchemaType, Model } from "mongoose";
import { JobStatus, QuestionType } from "@veda-ai/shared";

const { Schema, model, models } = mongoose;

/**
 * Mongoose model for `Assignment`, mirroring the shared `Assignment` Zod schema.
 * The shared `id` maps to Mongo's `_id`; `createdAt`/`updatedAt` come from
 * `timestamps`. `dueDate`/generated timestamps are stored as ISO strings to
 * match the shared contract exactly.
 */
const questionConfigSchema = new Schema(
  {
    type: { type: String, enum: QuestionType.options, required: true },
    count: { type: Number, required: true, min: 1 },
    marksPerQuestion: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number): boolean => value > 0,
        message: "marksPerQuestion must be greater than 0",
      },
    },
  },
  { _id: false },
);

const assignmentSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    dueDate: { type: String, required: true },
    questionConfigs: { type: [questionConfigSchema], required: true },
    additionalInstructions: { type: String },
    sourceText: { type: String },
    status: {
      type: String,
      enum: JobStatus.options,
      required: true,
      default: "queued",
    },
    jobId: { type: String },
    paperId: { type: String },
  },
  { timestamps: true },
);

export type AssignmentSchema = InferSchemaType<typeof assignmentSchema>;

export const AssignmentModel: Model<AssignmentSchema> =
  (models.Assignment as Model<AssignmentSchema> | undefined) ??
  model<AssignmentSchema>("Assignment", assignmentSchema);
