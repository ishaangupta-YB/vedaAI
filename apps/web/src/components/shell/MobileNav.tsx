"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutGrid, Library, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/src/lib/cn";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Whether this route is actually built (others show a "coming soon" toast). */
  implemented: boolean;
}

const ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: LayoutGrid, implemented: true },
  { label: "Assignments", href: "/assignments", icon: FileText, implemented: true },
  { label: "Library", href: "/library", icon: Library, implemented: false },
  { label: "AI Toolkit", href: "/toolkit", icon: Sparkles, implemented: false },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/create");
  return pathname === href || pathname.startsWith(href + "/");
}

/** Bottom floating pill navigation shown only on small screens. */
export function MobileNav(): React.ReactNode {
  const pathname = usePathname();
  return (
    <nav data-print="hide" className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-between rounded-[1.75rem] bg-ink px-3 py-2.5 shadow-float">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const handleClick = (e: React.MouseEvent) => {
            if (!item.implemented) {
              e.preventDefault();
              toast.info(`${item.label} coming soon!`, { position: "top-right" });
            }
          };
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={handleClick}
              aria-current={active ? "page" : undefined}
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
