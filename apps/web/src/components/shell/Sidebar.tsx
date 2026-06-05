"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  BookOpen,
  FileText,
  LayoutGrid,
  PieChart,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/src/components/brand/Logo";
import { cn } from "@/src/lib/cn";
import schoolDP from "@/../../design/schoolDP.svg";
import starIcon from "@/../../design/star.svg";
import { toast } from "sonner";
import { listAssignments } from "@/src/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Whether this destination is wired into the assessment-creator flow. */
  primary?: boolean;
  /** Whether this route is implemented */
  implemented?: boolean;
}

// Secondary items are part of the dashboard shell from the Figma but live
// outside this assessment's scope; they route home rather than 404.
const NAV: NavItem[] = [
  { label: "Home", href: "/", icon: LayoutGrid, primary: true, implemented: true },
  { label: "My Groups", href: "/groups", icon: Users, implemented: false },
  { label: "Assignments", href: "/assignments", icon: FileText, implemented: true },
  { label: "AI Teacher's Toolkit", href: "/toolkit", icon: BookOpen, implemented: false },
  { label: "My Library", href: "/library", icon: PieChart, implemented: false },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/create");
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}): React.ReactNode {
  const pathname = usePathname();
  const [assignmentCount, setAssignmentCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      listAssignments()
        .then((r) => {
          if (!cancelled) setAssignmentCount(r.total);
        })
        .catch(() => null);
    refresh();
    // Keep the badge in sync when assignments are created/deleted elsewhere.
    window.addEventListener("assignments:changed", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("assignments:changed", refresh);
    };
  }, []);

  return (
    <div className="flex h-full flex-col px-5 pb-5 pt-6 lg:px-0 lg:pb-0 lg:pt-0">
      <Link href="/" onClick={onNavigate} className="px-1.5">
        <Logo />
      </Link>

      <button
        type="button"
        onClick={() => toast.info("AI Teacher's Toolkit coming soon!", { position: "top-right" })}
        className="group relative mt-7 flex h-[42px] w-full max-w-[251px] items-center justify-center gap-2.5 rounded-[100px] bg-[#272727] text-white transition hover:opacity-90 font-inter font-medium text-[16px] leading-[28px] tracking-[-0.04em] align-middle"
        style={{
          padding: '8px 20px',
          border: '4px solid transparent',
          backgroundImage: 'linear-gradient(#272727, #272727), linear-gradient(180deg, #FF7950 0%, #C0350A 100%)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: '0px 32px 48px 0px rgba(255,255,255,0.2), 0px 16px 48px 0px rgba(255,255,255,0.12), 0px 0px 34.5px 0px rgba(255,255,255,0.25) inset, 0px -1px 3.5px 0px rgba(177,177,177,0.6) inset',
        }}
      >
        <Image src={starIcon} className="relative size-[1.1rem] align-middle" alt="" width={19} height={18} style={{ width: 'auto', height: 'auto' }} />
        <span className="relative font-inter font-medium text-[16px] leading-[28px] tracking-[-0.04em] align-middle whitespace-nowrap">AI Teacher&apos;s Toolkit</span>
      </button>

      <nav className="mt-8 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const handleClick = (e: React.MouseEvent) => {
            if (!item.implemented) {
              e.preventDefault();
              toast.info(`${item.label} coming soon!`, { position: "top-right" });
            } else {
              onNavigate?.();
            }
          };
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={handleClick}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.95rem] font-medium transition",
                active
                  ? "bg-neutral-100 text-ink shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]"
                  : "text-muted hover:bg-neutral-50 hover:text-ink",
              )}
            >
              <Icon className={cn("size-[1.15rem]", active ? "text-ink" : "text-faint group-hover:text-ink")} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/assignments" && assignmentCount !== null ? (
                <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {assignmentCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <button
          type="button"
          onClick={() => toast.info("Settings coming soon!", { position: "top-right" })}
          className="flex items-center gap-3 px-3.5 py-2 text-[0.95rem] font-medium text-muted transition hover:text-ink"
        >
          <Settings className="size-[1.15rem] text-faint" />
          Settings
        </button>

        <div className="flex items-center gap-3 rounded-2xl bg-neutral-100/80 p-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/5 overflow-hidden">
            <Image src={schoolDP} className="size-full object-contain" alt="Delhi Public School Logo" width={44} height={44} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-bricolage font-bold text-[16px] leading-[140%] tracking-[-0.04em] text-[#303030] align-middle">Delhi Public School</p>
            <p className="truncate font-bricolage font-normal text-[14px] leading-[140%] tracking-[-0.04em] text-[#5E5E5E] align-middle">Bokaro Steel City</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Desktop sidebar: a floating white card pinned to the left rail. */
export function Sidebar(): React.ReactNode {
  return (
    <aside data-print="hide" className="hidden lg:block lg:w-[19rem] lg:shrink-0">
      <div className="sticky top-3 left-3 h-[calc(100vh-2rem)] overflow-y-auto rounded-[16px] bg-white p-6 shadow-[0px_32px_48px_0px_rgba(0,0,0,0.2),0px_16px_48px_0px_rgba(0,0,0,0.12)] no-scrollbar">
        <SidebarContent />
      </div>
    </aside>
  );
}
