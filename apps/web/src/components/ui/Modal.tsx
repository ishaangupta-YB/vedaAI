"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/src/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Disable ESC + overlay-click dismissal (e.g. while an action is in flight). */
  dismissable?: boolean;
  labelledBy?: string;
  describedBy?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Minimal accessible modal primitive: renders into document.body via a portal,
 * locks body scroll, closes on ESC / overlay click (when dismissable), traps
 * initial focus inside the panel and restores it on close.
 */
export function Modal({
  open,
  onClose,
  dismissable = true,
  labelledBy,
  describedBy,
  className,
  children,
}: ModalProps): React.ReactNode {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to close + focus management.
  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    // Focus the first focusable element in the panel.
    const raf = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], button:not([disabled]), a[href], input, textarea, select",
      );
      target?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
      lastFocused.current?.focus?.();
    };
  }, [open, dismissable, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="presentation">
      <div
        aria-hidden
        onClick={dismissable ? onClose : undefined}
        className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn(
          "relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-float",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
