"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { WS_EVENTS } from "@veda-ai/shared";
import { config } from "@/src/config";
import { getAssignment, getPaper, paperPdfUrl } from "@/src/lib/api";
import * as mock from "@/src/lib/mock";
import { useGenerationStore } from "@/src/store/generation";
import type {
  GenerationCompletedPayload,
  GenerationFailedPayload,
  GenerationProgressPayload,
  GenerationQueuedPayload,
  PdfFailedPayload,
  PdfReadyPayload,
  WsEnvelope,
} from "@/src/lib/ws-events";

const USE_MOCK = config.NEXT_PUBLIC_USE_MOCK;

/**
 * Connects to the generation realtime channel for a single assignment and
 * mirrors every documented event into the Zustand store. The UI renders purely
 * from store state — never from anything on the wire directly.
 *
 * Returns the live store slice for convenience.
 */
export function useGeneration(assignmentId: string | null) {
  const store = useGenerationStore();

  useEffect(() => {
    if (!assignmentId) return;

    let active = true;
    const s = useGenerationStore.getState();

    // Switching to a different assignment (e.g. direct load / navigation):
    // clear any stale paper/progress before recovering this one's state.
    if (s.assignmentId !== assignmentId) s.prepareFor(assignmentId);

    // Enable the download only once the PDF bytes actually exist. The `pdf:ready`
    // event may have been missed across a refresh/reconnect, so verify with a
    // HEAD request before pointing the button at the download URL.
    const ensurePdfUrl = (paperId: string) => {
      if (useGenerationStore.getState().pdfUrl) return;
      if (USE_MOCK) {
        s.setPdfUrl(paperPdfUrl(paperId));
        return;
      }
      fetch(paperPdfUrl(paperId), { method: "HEAD" })
        .then((r) => {
          if (r.ok && active) s.setPdfUrl(paperPdfUrl(paperId));
        })
        .catch(() => {
          /* PDF not ready yet — the live pdf:ready event will set it. */
        });
    };

    const onCompleted = (paperId: string) => {
      getPaper(paperId)
        .then((paper) => {
          if (!active) return;
          s.setPaper(paper);
          ensurePdfUrl(paperId);
        })
        .catch((err: unknown) => {
          if (active) s.setError(err instanceof Error ? err.message : "Failed to load the generated paper.");
        });
    };

    // Re-sync the whole run state from the server. Used on initial load AND on
    // every socket reconnect so a dropped connection never leaves stale state
    // or a missed `completed`/`pdf:ready` event.
    const recover = () => {
      getAssignment(assignmentId)
        .then(({ assignment, paper }) => {
          if (!active) return;
          if (paper) {
            s.setPaper(paper);
            ensurePdfUrl(paper.id);
          } else if (assignment.status === "completed" && assignment.paperId) {
            onCompleted(assignment.paperId);
          } else if (assignment.status === "failed") {
            s.setError("Generation failed. Please try again.");
          } else {
            s.setStatus(assignment.status);
          }
        })
        .catch(() => {
          /* Assignment may not be persisted yet right after creation — ignore. */
        });
    };

    const dispatch = ({ event, payload }: WsEnvelope) => {
      if (!active || payload.assignmentId !== assignmentId) return;
      switch (event) {
        case WS_EVENTS.GENERATION_QUEUED:
          s.setStatus("queued");
          break;
        case WS_EVENTS.GENERATION_ACTIVE:
          s.setStatus("active");
          break;
        case WS_EVENTS.GENERATION_PROGRESS:
          s.setProgress(payload.progress, payload.stage);
          if (useGenerationStore.getState().status !== "active") s.setStatus("active");
          break;
        case WS_EVENTS.GENERATION_COMPLETED:
          onCompleted(payload.paperId);
          break;
        case WS_EVENTS.GENERATION_FAILED:
          s.setError(payload.error || "Generation failed. Please try again.");
          break;
        case WS_EVENTS.PDF_READY:
          s.setPdfUrl(paperPdfUrl(payload.paperId));
          break;
        case WS_EVENTS.PDF_FAILED:
          s.setPdfError(payload.error || "We couldn't prepare the PDF.");
          break;
      }
    };

    // 1) Recover current state on load (handles refresh / missed events).
    recover();

    // 2) Open the realtime channel.
    if (USE_MOCK) {
      const unsubscribe = mock.subscribe(assignmentId, dispatch);
      return () => {
        active = false;
        unsubscribe();
      };
    }

    const socket: Socket = io(config.NEXT_PUBLIC_WS_URL, {
      // Prefer a raw WebSocket but allow the polling fallback so flaky networks
      // or proxies still connect. Keep retrying indefinitely so a transient drop
      // recovers on its own instead of silently going stale.
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 20000,
    });

    let joinedOnce = false;
    socket.on("connect", () => {
      socket.emit("join", { assignmentId });
      // The first connect is already covered by the recover() above; only
      // re-sync on genuine reconnects to catch events missed while offline.
      if (joinedOnce) recover();
      joinedOnce = true;
    });
    socket.on(WS_EVENTS.GENERATION_QUEUED, (p: GenerationQueuedPayload) =>
      dispatch({ event: WS_EVENTS.GENERATION_QUEUED, payload: p }),
    );
    socket.on(WS_EVENTS.GENERATION_ACTIVE, (p: { assignmentId: string }) =>
      dispatch({ event: WS_EVENTS.GENERATION_ACTIVE, payload: p }),
    );
    socket.on(WS_EVENTS.GENERATION_PROGRESS, (p: GenerationProgressPayload) =>
      dispatch({ event: WS_EVENTS.GENERATION_PROGRESS, payload: p }),
    );
    socket.on(WS_EVENTS.GENERATION_COMPLETED, (p: GenerationCompletedPayload) =>
      dispatch({ event: WS_EVENTS.GENERATION_COMPLETED, payload: p }),
    );
    socket.on(WS_EVENTS.GENERATION_FAILED, (p: GenerationFailedPayload) =>
      dispatch({ event: WS_EVENTS.GENERATION_FAILED, payload: p }),
    );
    socket.on(WS_EVENTS.PDF_READY, (p: PdfReadyPayload) =>
      dispatch({ event: WS_EVENTS.PDF_READY, payload: p }),
    );
    socket.on(WS_EVENTS.PDF_FAILED, (p: PdfFailedPayload) =>
      dispatch({ event: WS_EVENTS.PDF_FAILED, payload: p }),
    );

    return () => {
      active = false;
      socket.emit("leave", { assignmentId });
      socket.off();
      socket.disconnect();
    };
  }, [assignmentId]);

  return store;
}
