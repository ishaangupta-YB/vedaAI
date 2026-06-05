import { Router, type Request, type Response } from "express";
import { API_ROUTES, CreateAssignmentInput } from "@veda-ai/shared";
import type { CreateAssignmentInput as CreateAssignmentInputType, QuestionPaper } from "@veda-ai/shared";
import { AssignmentModel, QuestionPaperModel, mongoose } from "@veda-ai/db";
import { NotFoundError } from "../lib/errors.js";
import { validateBody } from "../middleware/validate.js";
import { serializeAssignment, serializeQuestionPaper } from "../lib/serialize.js";
import { enqueueGeneratePaper, type AssessmentQueue } from "../queue.js";

/**
 * Assignment routes. Generation itself is the worker's job — these endpoints
 * only persist the request, enqueue a `generate-paper` job, and read back state.
 * `generation:*` WebSocket events (including `queued`) are emitted by the worker
 * so all generation events have a single source — the API never emits them.
 */
export function createAssignmentsRouter(queue: AssessmentQueue): Router {
  const router = Router();

  // POST /api/assignments — validate, persist (status "queued"), enqueue.
  router.post(
    API_ROUTES.ASSIGNMENTS,
    validateBody(CreateAssignmentInput),
    async (req: Request, res: Response): Promise<void> => {
      const input = req.body as CreateAssignmentInputType;

      const assignment = await AssignmentModel.create({ ...input, status: "queued" });
      const assignmentId = String(assignment._id);

      const jobId = await enqueueGeneratePaper(queue, assignmentId);
      assignment.jobId = jobId;
      await assignment.save();

      res.status(201).json({ assignmentId, jobId });
    },
  );

  // GET /api/assignments — return { assignments: Assignment[], total: number }.
  router.get(
    API_ROUTES.ASSIGNMENTS,
    async (_req: Request, res: Response): Promise<void> => {
      const docs = await AssignmentModel.find().sort({ createdAt: -1 });
      const assignments = docs.map(serializeAssignment);
      res.json({ assignments, total: assignments.length });
    },
  );

  // GET /api/assignments/:id — return { assignment, paper? }.
  router.get(
    API_ROUTES.ASSIGNMENT(":id"),
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        throw new NotFoundError();
      }
      const assignment = await AssignmentModel.findById(id);
      if (!assignment) {
        throw new NotFoundError();
      }

      let paper: QuestionPaper | undefined;
      if (assignment.paperId) {
        const paperDoc = await QuestionPaperModel.findById(assignment.paperId);
        if (paperDoc) {
          paper = serializeQuestionPaper(paperDoc);
        }
      }

      res.json({ assignment: serializeAssignment(assignment), paper });
    },
  );

  // POST /api/assignments/:id/regenerate — re-queue and enqueue a fresh job.
  router.post(
    API_ROUTES.ASSIGNMENT_REGENERATE(":id"),
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        throw new NotFoundError();
      }
      const assignment = await AssignmentModel.findById(id);
      if (!assignment) {
        throw new NotFoundError();
      }

      assignment.status = "queued";
      const jobId = await enqueueGeneratePaper(queue, String(assignment._id));
      assignment.jobId = jobId;
      await assignment.save();

      res.status(202).json({ jobId });
    },
  );

  // DELETE /api/assignments/:id — delete the assignment and its associated paper.
  router.delete(
    API_ROUTES.ASSIGNMENT(":id"),
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        throw new NotFoundError();
      }
      const assignment = await AssignmentModel.findById(id);
      if (!assignment) {
        throw new NotFoundError();
      }

      if (assignment.paperId) {
        await QuestionPaperModel.findByIdAndDelete(assignment.paperId);
      }
      await AssignmentModel.findByIdAndDelete(id);

      res.status(204).end();
    },
  );

  return router;
}
