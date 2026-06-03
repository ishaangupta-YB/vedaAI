import { Router, type Request, type Response } from "express";
import multer from "multer";
import { extractText } from "unpdf";
import { API_ROUTES } from "@veda-ai/shared";
import { BadRequestError } from "../lib/errors.js";

/**
 * `POST /api/uploads` — accept a single multipart PDF or `.txt` file (memory
 * storage, 10MB cap), extract its text, and return `{ sourceText }`. This is the
 * only place a raw file is touched; the extracted text then flows through the
 * normal validated `CreateAssignmentInput` path.
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Keep returned text within the shared `CreateAssignmentInput.sourceText` cap. */
const MAX_SOURCE_TEXT = 50_000;

const PDF_MIME = "application/pdf";
const TXT_MIME = "text/plain";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

async function extractSourceText(file: Express.Multer.File): Promise<string> {
  if (file.mimetype === PDF_MIME) {
    const { text } = await extractText(new Uint8Array(file.buffer), {
      mergePages: true,
    });
    return text;
  }
  return file.buffer.toString("utf-8");
}

export function createUploadsRouter(): Router {
  const router = Router();

  router.post(
    API_ROUTES.UPLOADS,
    upload.single("file"),
    async (req: Request, res: Response): Promise<void> => {
      const file = req.file;
      if (!file) {
        throw new BadRequestError("A file is required (multipart field 'file').");
      }
      if (file.mimetype !== PDF_MIME && file.mimetype !== TXT_MIME) {
        throw new BadRequestError(
          `Unsupported file type '${file.mimetype}'. Upload a PDF or .txt file.`,
        );
      }

      const raw = await extractSourceText(file);
      const sourceText = raw.trim().slice(0, MAX_SOURCE_TEXT);
      res.json({ sourceText });
    },
  );

  return router;
}
