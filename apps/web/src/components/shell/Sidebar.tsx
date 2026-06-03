"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileText,
  LayoutGrid,
  PieChart,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/src/components/brand/Logo";
import { cn } from "@/src/lib/cn";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Whether this destination is wired into the assessment-creator flow. */
  primary?: boolean;
}

// Secondary items are part of the dashboard shell from the Figma but live
// outside this assessment's scope; they route home rather than 404.
const NAV: NavItem[] = [
  { label: "Home", href: "/", icon: LayoutGrid, primary: true },
  { label: "My Groups", href: "/", icon: Users },
  { label: "Assignments", href: "/", icon: FileText, badge: "32" },
  { label: "AI Teacher's Toolkit", href: "/", icon: BookOpen },
  { label: "My Library", href: "/", icon: PieChart },
];

function isHomeRoute(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/create") || pathname.startsWith("/assignments");
}

export function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}): React.ReactNode {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col px-5 pb-5 pt-6">
      <Link href="/" onClick={onNavigate} className="px-1.5">
        <Logo />
      </Link>

      <button
        type="button"
        className="group relative mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white shadow-pill ring-2 ring-brand-500/80 transition hover:ring-brand-400"
      >
        <span className="pointer-events-none absolute inset-0 rounded-full bg-brand-500/20 blur-md" />
        <Sparkles className="relative size-4 text-brand-300" />
        <span className="relative">AI Teacher&apos;s Toolkit</span>
      </button>

      <nav className="mt-8 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = Boolean(item.primary) && isHomeRoute(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.95rem] font-medium transition",
                active
                  ? "bg-neutral-100 text-ink shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]"
                  : "text-muted hover:bg-neutral-50 hover:text-ink",
              )}
            >
              <Icon className={cn("size-[1.15rem]", active ? "text-ink" : "text-faint group-hover:text-ink")} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3.5 py-2 text-[0.95rem] font-medium text-muted transition hover:text-ink"
        >
          <Settings className="size-[1.15rem] text-faint" />
          Settings
        </Link>

        <div className="flex items-center gap-3 rounded-2xl bg-neutral-100/80 p-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/5">
            <SchoolCrest />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">Delhi Public School</p>
            <p className="truncate text-xs text-faint">Bokaro Steel City</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SchoolCrest(): React.ReactNode {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.2" stroke="#2f7d4f" strokeWidth="1.3" />
      <path
        d="M12 5.5l5.2 2.6v3.1c0 3.2-2.1 5.4-5.2 6.6-3.1-1.2-5.2-3.4-5.2-6.6V8.1L12 5.5z"
        stroke="#2f7d4f"
        strokeWidth="1.2"
        fill="#eaf6ee"
      />
      <path d="M9.4 12.2l1.9 1.9 3.4-3.6" stroke="#2f7d4f" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Desktop sidebar: a floating white card pinned to the left rail. */
export function Sidebar(): React.ReactNode {
  return (
    <aside data-print="hide" className="hidden lg:block lg:w-[19rem] lg:shrink-0">
      <div className="sticky top-4 h-[calc(100vh-2rem)] overflow-y-auto rounded-panel bg-white shadow-soft no-scrollbar">
        <SidebarContent />
      </div>
    </aside>
  );
}
