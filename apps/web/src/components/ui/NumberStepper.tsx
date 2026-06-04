"use client";

import type { Ref } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/src/lib/cn";

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel: string;
  invalid?: boolean;
  /** Forwarded to the numeric input so focus-on-error can land here. */
  inputRef?: Ref<HTMLInputElement>;
}

/** Compact "− value +" control matching the Figma question-config steppers. */
export function NumberStepper({
  value,
  onChange,
  onBlur,
  min = 0,
  max = 999,
  step = 1,
  ariaLabel,
  invalid,
  inputRef,
}: NumberStepperProps): React.ReactNode {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const safe = Number.isFinite(value) ? value : min;

  return (
    <div
      className={cn(
        "inline-flex h-11 items-center justify-between gap-1 rounded-full bg-white px-1 ring-1 ring-black/[0.08]",
        invalid && "ring-2 ring-hard-ring",
      )}
    >
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        onClick={() => onChange(clamp(safe - step))}
        disabled={safe <= min}
        className="flex size-9 items-center justify-center rounded-full text-ink transition hover:bg-neutral-100 disabled:opacity-30"
      >
        <Minus className="size-4" />
      </button>
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onBlur={onBlur}
        onChange={(e) => {
          const next = e.target.valueAsNumber;
          onChange(Number.isNaN(next) ? min : clamp(next));
        }}
        className="w-9 bg-transparent text-center text-sm font-semibold text-ink outline-none"
      />
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        onClick={() => onChange(clamp(safe + step))}
        disabled={safe >= max}
        className="flex size-9 items-center justify-center rounded-full text-ink transition hover:bg-neutral-100 disabled:opacity-30"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
