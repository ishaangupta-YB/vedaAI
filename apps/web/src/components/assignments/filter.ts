import type { Assignment } from "@veda-ai/shared";

/** UI-level status grouping for the "Filter By" dropdown. */
export type StatusFilter = "all" | "ready" | "generating" | "failed";

export const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All assignments" },
  { value: "ready", label: "Ready" },
  { value: "generating", label: "Generating" },
  { value: "failed", label: "Failed" },
];

/** Map a raw job status onto the coarser UI filter buckets. */
export function statusMatchesFilter(
  status: Assignment["status"],
  filter: StatusFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "ready":
      return status === "completed";
    case "generating":
      return status === "queued" || status === "active";
    case "failed":
      return status === "failed";
    default:
      return true;
  }
}

/**
 * Pure search + filter over the assignment list. Title search is
 * case-insensitive and trimmed; status uses the UI buckets above.
 */
export function filterAssignments(
  list: Assignment[],
  opts: { query: string; status: StatusFilter },
): Assignment[] {
  const q = opts.query.trim().toLowerCase();
  return list.filter((a) => {
    if (!statusMatchesFilter(a.status, opts.status)) return false;
    if (q && !a.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Format an ISO datetime as DD-MM-YYYY (matching the Figma cards). */
export function formatDmy(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}
