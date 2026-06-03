import * as ReactPDF from "@react-pdf/renderer";
import type { QuestionPaper } from "@veda-ai/shared";
import { PaperDocument } from "./document.js";

/**
 * Render a validated {@link QuestionPaper} to a PDF `Buffer` using
 * `@react-pdf/renderer`'s `renderToBuffer` — pure Node, no headless browser, so
 * it is friendly to small hosts.
 */
export function renderPaperPdf(paper: QuestionPaper): Promise<Buffer> {
  return ReactPDF.renderToBuffer(PaperDocument({ paper }));
}
