"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

const PILL_STYLE: React.CSSProperties = {
  border: "1.5px solid transparent",
  backgroundImage:
    "linear-gradient(#181818, #181818), linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(102, 102, 102, 0) 100%)",
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
};

/**
 * Floating "Create Assignment" CTA. Desktop renders a centered black pill
 * pinned over the content column (mirroring the AppShell layout so it centers
 * on content, not the viewport); mobile renders a circular FAB above the
 * bottom navigation.
 */
export function CreateAssignmentButton(): React.ReactNode {
  return (
    <>
      {/* Desktop: centered pill over the content column. */}
      <div
        data-print="hide"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 hidden lg:block"
      >
        <div className="mx-auto flex w-full max-w-[100rem] gap-5 px-5 pb-6">
          <div className="w-[19rem] shrink-0" aria-hidden />
          <div className="flex flex-1 justify-center">
            <Link
              href="/create"
              style={PILL_STYLE}
              className="pointer-events-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#181818] px-6 py-3.5 font-bricolage text-[15px] font-medium tracking-[-0.04em] text-white shadow-pill transition-all hover:opacity-90"
            >
              <Plus className="size-5" />
              Create Assignment
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile: circular FAB above the bottom nav. */}
      <Link
        href="/create"
        data-print="hide"
        aria-label="Create assignment"
        className="fixed bottom-24 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-white text-brand-500 shadow-float ring-1 ring-black/5 transition hover:scale-105 active:scale-95 lg:hidden"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </Link>
    </>
  );
}
