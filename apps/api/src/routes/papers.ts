import { Router, type Request, type Response } from "express";
import { API_ROUTES } from "@veda-ai/shared";
import { QuestionPaperModel, mongoose } from "@veda-ai/db";
import { NotFoundError } from "../lib/errors.js";
import { serializeQuestionPaper } from "../lib/serialize.js";
import { enqueueRenderPdf, type AssessmentQueue } from "../queue.js";

/**
 * Paper routes. The worker produces papers (and their PDFs); these endpoints
 * only read them back. The PDF route serves the stored `pdf` buffer — it never
 * renders anything itself.
 */
export function createPapersRouter(queue: AssessmentQueue): Router {
  const router = Router();

  // GET /api/papers/:id — return the validated QuestionPaper (no PDF binary).
  router.get(
    API_ROUTES.PAPER(":id"),
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        throw new NotFoundError();
      }
      const paper = await QuestionPaperModel.findById(id);
      if (!paper) {
        throw new NotFoundError();
      }
      res.json(serializeQuestionPaper(paper));
    },
  );

  // GET /api/papers/:id/pdf — stream the stored PDF, or 404 if not yet rendered.
  router.get(
    API_ROUTES.PAPER_PDF(":id"),
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        throw new NotFoundError();
      }
      // The worker stores the rendered bytes on the QuestionPaper document.
      // Read the HYDRATED document (not `.lean()`): a lean read surfaces the
      // stored bytes as a BSON `Binary` object, and `res.send(<object>)` would
      // JSON-serialize it (base64 string) while keeping `application/pdf`,
      // producing a corrupt download. The hydrated `pdf` is a Mongoose Buffer
      // (a Node `Buffer` subclass); we still normalize defensively so Express
      // streams the raw bytes.
      const paper = await QuestionPaperModel.findById(id).select("+pdf");
      if (!paper?.pdf) {
        throw new NotFoundError();
      }
      const pdf = Buffer.isBuffer(paper.pdf)
        ? paper.pdf
        : Buffer.from(paper.pdf as unknown as Uint8Array);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", String(pdf.length));
      res.setHeader("Content-Disposition", `inline; filename="paper-${id}.pdf"`);
      res.end(pdf);
    },
  );

  // POST /api/papers/:id/pdf - (re)enqueue a render-pdf job for an existing
  // paper. Lets the client recover from a `pdf:failed` event (or a PDF that was
  // never stored) without re-running generation. Returns 202 + the job id.
  router.post(
    API_ROUTES.PAPER_PDF(":id"),
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
        throw new NotFoundError();
      }
      const paper = await QuestionPaperModel.findById(id)
        .select("assignmentId")
        .lean<{ assignmentId: string } | null>();
      if (!paper) {
        throw new NotFoundError();
      }
      const jobId = await enqueueRenderPdf(queue, id, paper.assignmentId);
      res.status(202).json({ jobId });
    },
  );

  return router;
}
