"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Assignment } from "@veda-ai/shared";
import { Modal } from "@/src/components/ui/Modal";
import { ApiError, deleteAssignment } from "@/src/lib/api";

interface DeleteAssignmentDialogProps {
  /** The assignment to delete, or `null` when the dialog is closed. */
  assignment: Assignment | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

/** Confirmation modal for deleting an assignment + its generated paper. */
export function DeleteAssignmentDialog({
  assignment,
  onClose,
  onDeleted,
}: DeleteAssignmentDialogProps): React.ReactNode {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm(): Promise<void> {
    if (!assignment || deleting) return;
    setDeleting(true);
    try {
      await deleteAssignment(assignment.id);
      toast.success("Assignment deleted");
      onDeleted(assignment.id);
      onClose();
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Failed to delete assignment.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={assignment !== null}
      onClose={() => {
        if (!deleting) onClose();
      }}
      dismissable={!deleting}
      labelledBy="delete-assignment-title"
      describedBy="delete-assignment-desc"
    >
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-hard-bg text-hard-fg">
          <Trash2 className="size-6" />
        </span>
        <h2
          id="delete-assignment-title"
          className="mt-4 font-bricolage text-lg font-bold text-ink"
        >
          Delete assignment?
        </h2>
        <p id="delete-assignment-desc" className="mt-2 text-sm text-muted">
          This will permanently delete{" "}
          <span className="font-semibold text-ink-soft">
            &ldquo;{assignment?.title}&rdquo;
          </span>{" "}
          and its generated paper. This action can&apos;t be undone.
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          data-autofocus
          onClick={onClose}
          disabled={deleting}
          className="flex-1 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-black/[0.08] transition hover:bg-neutral-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={deleting}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-hard-fg px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {deleting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Deleting…
            </>
          ) : (
            "Delete"
          )}
        </button>
      </div>
    </Modal>
  );
}
