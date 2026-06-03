"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Sidebar, SidebarContent } from "@/src/components/shell/Sidebar";
import { MobileHeader, TopBar } from "@/src/components/shell/TopBar";
import { MobileNav } from "@/src/components/shell/MobileNav";
import { cn } from "@/src/lib/cn";

export function AppShell({ children }: { children: React.ReactNode }): React.ReactNode {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[100rem] gap-5 p-4 lg:p-5">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col gap-4 pb-28 lg:pb-0">
          <MobileHeader onMenu={() => setDrawerOpen(true)} />
          <TopBar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>

      <MobileNav />

      {/* Mobile navigation drawer */}
      <div
        data-print="hide"
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          aria-label="Close navigation menu"
          tabIndex={drawerOpen ? 0 : -1}
          className={cn(
            "absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-300",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setDrawerOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[18rem] max-w-[85%] bg-white shadow-float transition-transform duration-300",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute right-3 top-4 z-10 flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
          <SidebarContent onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>
    </div>
  );
}
