"use client";

import type {
  InputHTMLAttributes,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/src/lib/cn";

const CONTROL =
  "w-full rounded-2xl bg-white px-4 text-sm text-ink shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] outline-none transition placeholder:text-faint focus:shadow-[inset_0_0_0_1.5px_var(--color-ink)]";
const INVALID = "shadow-[inset_0_0_0_1.5px_var(--color-hard-ring)] focus:shadow-[inset_0_0_0_1.5px_var(--color-hard-fg)]";

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactNode {
  return (
    <label htmlFor={htmlFor} className={cn("block text-sm font-semibold text-ink", className)}>
      {children}
    </label>
  );
}

export function ErrorText({
  id,
  children,
}: {
  id?: string;
  children?: React.ReactNode;
}): React.ReactNode {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-hard-fg">
      <AlertCircle className="size-3.5 shrink-0" />
      {children}
    </p>
  );
}

// React 19: `ref` is a normal prop on function components (no forwardRef needed).

export function TextInput({
  className,
  invalid,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}): React.ReactNode {
  return <input ref={ref} className={cn(CONTROL, "h-12", invalid && INVALID, className)} {...props} />;
}

export function Textarea({
  className,
  invalid,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}): React.ReactNode {
  return (
    <textarea
      ref={ref}
      className={cn(CONTROL, "min-h-[7rem] py-3 leading-relaxed", invalid && INVALID, className)}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ref,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLSelectElement>;
}): React.ReactNode {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          CONTROL,
          "h-12 cursor-pointer appearance-none pr-10 font-medium",
          invalid && INVALID,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
    </div>
  );
}
