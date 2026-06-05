"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Loader2, Plus, RotateCcw, SearchX } from "lucide-react";
import type { Assignment } from "@veda-ai/shared";
import { EmptyIllustration } from "@/src/components/home/EmptyIllustration";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { listAssignments } from "@/src/lib/api";
import { AssignmentCard } from "./AssignmentCard";
import { AssignmentsToolbar } from "./AssignmentsToolbar";
import { CreateAssignmentButton } from "./CreateAssignmentButton";
import { DeleteAssignmentDialog } from "./DeleteAssignmentDialog";
import { filterAssignments, type StatusFilter } from "./filter";

const PILL_STYLE: React.CSSProperties = {
  border: "1.5px solid transparent",
  backgroundImage:
    "linear-gradient(#181818, #181818), linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(102, 102, 102, 0) 100%)",
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
};

/**
 * Shared Assignments experience used by both `/` and `/assignments` so the two
 * routes never drift. Owns list fetching, search/filter, the per-card action
 * menu, the delete confirmation modal and the floating create button.
 */
export function AssignmentsView(): ReactNode {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    return listAssignments()
      .then((r) => setAssignments(r.assignments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Fetch on mount without setting state synchronously (loading starts true).
    let cancelled = false;
    listAssignments()
      .then((r) => {
        if (!cancelled) setAssignments(r.assignments);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    // Notify the sidebar (and any other listeners) to refresh their count.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("assignments:changed"));
    }
  }, []);

  const filtered = useMemo(
    () => filterAssignments(assignments, { query, status: statusFilter }),
    [assignments, query, statusFilter],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-neutral-300" />
      </div>
    );
  }

  if (error) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center">
        <h1 className="font-bricolage text-[20px] font-bold tracking-[-0.04em] text-[#303030]">
          Couldn&apos;t load assignments
        </h1>
        <p className="mt-2 max-w-md text-[15px] text-muted">
          Something went wrong reaching the server. Check your connection and
          try again.
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#181818] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          <RotateCcw className="size-4" />
          Retry
        </button>
      </section>
    );
  }

  if (assignments.length === 0) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center">
        <EmptyIllustration className="h-52 w-auto sm:h-60" />
        <h1 className="mt-6 text-center align-middle font-bricolage text-[20px] font-bold leading-[140%] tracking-[-0.04em] text-[#303030]">
          No assignments yet
        </h1>
        <p className="mt-3 max-w-xl text-center align-middle font-bricolage text-[16px] font-normal leading-[140%] tracking-[-0.04em] text-[#5E5E5ECC]">
          Create your first assignment to start generating exam-ready question
          papers. Set the question types, marks and due date, and let AI draft a
          structured paper you can review and export.
        </p>
        <Link
          href="/create"
          style={PILL_STYLE}
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-[#181818] px-6 py-3.5 text-center align-middle font-bricolage text-[16px] font-medium leading-[140%] tracking-[-0.04em] text-white transition-all"
        >
          <Plus className="size-[1.25rem] align-middle" />
          Create Your First Assignment
        </Link>
      </section>
    );
  }

  return (
    <section className="relative px-1 py-1 pb-10 lg:pb-28">
      <PageHeader
        title="Assignments"
        subtitle="Manage and create assignments for your classes."
      />

      <div className="mt-5">
        <AssignmentsToolbar
          query={query}
          onQueryChange={setQuery}
          status={statusFilter}
          onStatusChange={setStatusFilter}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center px-4 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-faint">
            <SearchX className="size-6" />
          </span>
          <h2 className="mt-4 font-bricolage text-[17px] font-bold tracking-[-0.03em] text-[#303030]">
            No matching assignments
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            No assignments match your search or filter. Try a different term or
            clear the filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink ring-1 ring-black/[0.08] transition hover:bg-neutral-50"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              menuOpen={openMenuId === a.id}
              onToggleMenu={() =>
                setOpenMenuId((cur) => (cur === a.id ? null : a.id))
              }
              onCloseMenu={() =>
                setOpenMenuId((cur) => (cur === a.id ? null : cur))
              }
              onRequestDelete={() => setDeleteTarget(a)}
            />
          ))}
        </div>
      )}

      <CreateAssignmentButton />

      <DeleteAssignmentDialog
        assignment={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
    </section>
  );
}
