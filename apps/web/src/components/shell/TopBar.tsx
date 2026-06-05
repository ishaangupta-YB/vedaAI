"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ChevronDown, LayoutGrid, Menu } from "lucide-react";
import { Logo } from "@/src/components/brand/Logo";
import bellIcon from "@/../../design/bellIcon.svg";
import profilePic from "@/../../design/profile_pic.svg";

function Avatar({ className }: { className?: string }): React.ReactNode {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden ${className ?? ""}`}
      aria-hidden
    >
      <Image src={profilePic} className="size-full object-cover" alt="User avatar" width={36} height={36} />
    </span>
  );
}

function BellButton(): React.ReactNode {
  return (
    <button
      type="button"
      aria-label="Notifications"
      className="relative flex size-10 items-center justify-center rounded-full bg-white text-ink shadow-[0px_32px_48px_0px_rgba(0,0,0,0.2),0px_16px_48px_0px_rgba(0,0,0,0.12)] transition hover:bg-neutral-50 overflow-hidden"
    >
      <Image src={bellIcon} className="size-[1.2rem] object-contain" alt="Notifications" width={20} height={20} />
      <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand-500 ring-2 ring-white" />
    </button>
  );
}

/** Desktop content-area header bar. */
export function TopBar({ title }: { title?: string }): React.ReactNode {
  const router = useRouter();
  const pathname = usePathname();

  let displayTitle = title;
  if (!displayTitle) {
    if (pathname === "/" || pathname === "/create") {
      displayTitle = "Home";
    } else if (pathname === "/groups") {
      displayTitle = "My Groups";
    } else if (pathname === "/assignments") {
      displayTitle = "Assignments";
    } else if (pathname === "/toolkit") {
      displayTitle = "AI Teacher's Toolkit";
    } else if (pathname === "/library") {
      displayTitle = "My Library";
    } else if (pathname?.startsWith("/assignments/")) {
      displayTitle = "Assignment";
    } else {
      displayTitle = "Home";
    }
  }

  return (
    <header data-print="hide" className="hidden lg:flex lg:items-center lg:justify-between lg:gap-4 lg:rounded-full lg:bg-white/80 lg:px-3 lg:py-2.5 lg:shadow-soft lg:backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex size-10 items-center justify-center rounded-full ring-1 ring-black/5 text-ink transition hover:bg-neutral-50"
        >
          <ArrowLeft className="size-[1.15rem]" />
        </button>
        <span className="flex items-center gap-2 text-[0.95rem] font-medium text-muted">
          <LayoutGrid className="size-[1.05rem]" />
          {displayTitle}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <BellButton />
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-3 shadow-[0px_32px_48px_0px_rgba(0,0,0,0.2),0px_16px_48px_0px_rgba(0,0,0,0.12)] transition hover:bg-neutral-50"
        >
          <Avatar className="size-8" />
          <span className="text-sm font-semibold text-ink">John Doe</span>
          <ChevronDown className="size-4 text-faint" />
        </button>
      </div>
    </header>
  );
}

/** Mobile top header: logo + notifications + avatar + drawer toggle. */
export function MobileHeader({ onMenu }: { onMenu: () => void }): React.ReactNode {
  return (
    <header data-print="hide" className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-soft lg:hidden">
      <Logo markClassName="size-9" className="gap-2" />
      <div className="flex items-center gap-3">
        <BellButton />
        <Avatar className="size-9" />
        <button
          type="button"
          aria-label="Open menu"
          onClick={onMenu}
          className="flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-neutral-100"
        >
          <Menu className="size-5" />
        </button>
      </div>
    </header>
  );
}
