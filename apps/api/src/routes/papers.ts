import { Router, type Request, type Response } from "express";
import { API_ROUTES } from "@veda-ai/shared";
import { QuestionPaperModel, mongoose } from "@veda-ai/db";
import { NotFoundError } from "../lib/errors.js";
import { serializeQuestionPaper } from "../lib/serialize.js";

/**
 * Paper routes. The worker produces papers (and their PDFs); these endpoints
 * only read them back. The PDF route serves the stored `pdf` buffer — it never
 * renders anything itself.
 */
export function createPapersRouter(): Router {
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
      // The worker stores the rendered bytes on the QuestionPaper document. That
      // `pdf` field is a coordinated contract change owned by the worker (Agent
      // B), so this route only READS it — typed via `.lean()` rather than the
      // model so it does not depend on the model edit landing here. `+pdf` opts
      // the binary in when the field is declared `select: false`.
      const paper = await QuestionPaperModel.findById(id)
        .select("+pdf")
        .lean<{ pdf?: Buffer } | null>();
      if (!paper?.pdf) {
        throw new NotFoundError();
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="paper-${id}.pdf"`);
      res.send(paper.pdf);
    },
  );

  return router;
}
