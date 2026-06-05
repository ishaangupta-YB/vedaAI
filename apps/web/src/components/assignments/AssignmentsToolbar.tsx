"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/src/lib/cn";
import { STATUS_FILTER_OPTIONS, type StatusFilter } from "./filter";

interface AssignmentsToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
}

/** Filter + search bar matching the Figma toolbar (desktop and mobile). */
export function AssignmentsToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
}: AssignmentsToolbarProps): React.ReactNode {
  const [open, setOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeLabel =
    STATUS_FILTER_OPTIONS.find((o) => o.value === status)?.label ?? "Filter By";

  return (
    <div className="flex items-center gap-2 rounded-full bg-white p-2 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.06)] sm:gap-3 sm:py-2.5 sm:pl-4 sm:pr-2.5">
      <div ref={filterRef} className="relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:bg-neutral-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70"
        >
          <SlidersHorizontal className="size-4" />
          <span className="hidden sm:inline">
            {status === "all" ? "Filter By" : activeLabel}
          </span>
          <span className="sm:hidden">Filter</span>
          {status !== "all" ? (
            <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
          ) : null}
        </button>

        {open ? (
          <div
            role="menu"
            aria-label="Filter assignments by status"
            className="absolute left-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-2xl bg-white p-1 shadow-float ring-1 ring-black/5"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <button
                key={o.value}
                role="menuitemradio"
                aria-checked={status === o.value}
                type="button"
                onClick={() => {
                  onStatusChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-neutral-100",
                  status === o.value ? "text-ink" : "text-muted",
                )}
              >
                {o.label}
                {status === o.value ? (
                  <Check className="size-4 text-brand-500" />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex min-w-0 flex-1 items-center gap-2 rounded-full px-4 py-2 ring-1 ring-black/[0.07] sm:flex-none sm:basis-72">
        <Search className="size-4 shrink-0 text-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search Assignment"
          aria-label="Search assignments by title"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
        />
      </div>
    </div>
  );
}
