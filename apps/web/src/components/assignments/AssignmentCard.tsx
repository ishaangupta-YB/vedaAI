"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Eye, MoreVertical, Trash2 } from "lucide-react";
import type { Assignment } from "@veda-ai/shared";
import { cn } from "@/src/lib/cn";
import { AssignmentStatusBadge } from "./AssignmentStatusBadge";
import { formatDmy } from "./filter";

interface AssignmentCardProps {
  assignment: Assignment;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onRequestDelete: () => void;
}

/**
 * Assignment card matching the Figma grid. The whole card is a navigation
 * target via an overlay `<Link>` (kept below the content with pointer-events
 * routing so the title/dates click through), while the 3-dot menu sits above
 * it and stops navigation. Avoids nesting a `<button>` inside an `<a>`.
 */
export function AssignmentCard({
  assignment,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onRequestDelete,
}: AssignmentCardProps): React.ReactNode {
  const menuRef = useRef<HTMLDivElement>(null);
  const href = `/assignments/${assignment.id}`;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseMenu();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseMenu();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, onCloseMenu]);

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-3xl bg-white p-5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.06)] transition hover:shadow-[0px_8px_24px_0px_rgba(0,0,0,0.10)] sm:p-6",
        // Lift the whole card above its neighbours while its menu is open so the
        // dropdown is never painted behind an adjacent card.
        menuOpen && "z-20",
      )}
    >
      {/* Full-card navigation target (below content; content clicks pass through). */}
      <Link
        href={href}
        aria-label={`View ${assignment.title}`}
        className="absolute inset-0 z-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:ring-offset-2"
      />

      {/* One content layer above the overlay link. The menu sits at a higher
          z-index than the sibling rows so its dropdown stays on top of the
          card's own status/date content. */}
      <div className="pointer-events-none relative z-10 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate font-bricolage text-[18px] font-bold leading-[140%] tracking-[-0.03em] text-[#303030] underline decoration-1 underline-offset-[5px]">
            {assignment.title}
          </h3>

          <div ref={menuRef} className="pointer-events-auto relative z-20 shrink-0">
            <button
              type="button"
              aria-label="Assignment actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={onToggleMenu}
              className="-mr-1 -mt-1 flex size-8 items-center justify-center rounded-full text-faint transition hover:bg-neutral-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70"
            >
              <MoreVertical className="size-5" />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                aria-label="Assignment actions"
                className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl bg-white p-1 shadow-float ring-1 ring-black/5"
              >
                <Link
                  role="menuitem"
                  href={href}
                  onClick={onCloseMenu}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink transition hover:bg-neutral-100"
                >
                  <Eye className="size-4 text-muted" />
                  View Assignment
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    onCloseMenu();
                    onRequestDelete();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-hard-fg transition hover:bg-hard-bg"
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-2.5">
          <AssignmentStatusBadge status={assignment.status} />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted">
          <p>
            <span className="font-semibold text-ink-soft">Assigned on</span> : {formatDmy(assignment.createdAt)}
          </p>
          <p>
            <span className="font-semibold text-ink-soft">Due</span> : {formatDmy(assignment.dueDate)}
          </p>
        </div>
      </div>
    </article>
  );
}
