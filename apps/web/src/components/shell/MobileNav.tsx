"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutGrid, Library, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/src/lib/cn";

const ITEMS: { label: string; href: string; icon: LucideIcon; primary?: boolean }[] = [
  { label: "Home", href: "/", icon: LayoutGrid, primary: true },
  { label: "Assignments", href: "/", icon: FileText },
  { label: "Library", href: "/", icon: Library },
  { label: "AI Toolkit", href: "/", icon: Sparkles },
];

/** Bottom floating pill navigation shown only on small screens. */
export function MobileNav(): React.ReactNode {
  const pathname = usePathname();
  const isHome =
    pathname === "/" || pathname.startsWith("/create") || pathname.startsWith("/assignments");
  return (
    <nav data-print="hide" className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-between rounded-[1.75rem] bg-ink px-3 py-2.5 shadow-float">
        {ITEMS.map((item) => {
          const active = Boolean(item.primary) && isHome;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[0.7rem] font-medium transition",
                active ? "text-white" : "text-white/45",
              )}
            >
              <Icon className={cn("size-5", active && "text-white")} strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
