import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import type { Assignment } from "@veda-ai/shared";

const MAP: Record<
  Assignment["status"],
  { label: string; className: string; icon: ReactNode }
> = {
  queued: {
    label: "Queued",
    className: "bg-neutral-100 text-neutral-600",
    icon: <Clock className="size-3" />,
  },
  active: {
    label: "Generating",
    className: "bg-blue-50 text-blue-600",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  completed: {
    label: "Ready",
    className: "bg-easy-bg text-easy-fg",
    icon: <CheckCircle2 className="size-3" />,
  },
  failed: {
    label: "Failed",
    className: "bg-hard-bg text-hard-fg",
    icon: <AlertCircle className="size-3" />,
  },
};

/** Compact, color-coded generation-status chip shown on each card. */
export function AssignmentStatusBadge({
  status,
}: {
  status: Assignment["status"];
}): ReactNode {
  const s = MAP[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}
