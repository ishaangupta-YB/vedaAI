import Image from "next/image";
import { cn } from "@/src/lib/cn";
import AppLogo from "@/../../design/app-logo.svg";

/** The VedaAI mark: app-logo.svg */
function LogoMark({ className }: { className?: string }): React.ReactNode {
  return (
    <span className={cn("inline-flex items-center justify-center", className)} aria-hidden>
      <Image src={AppLogo} className="size-full object-contain" alt="" priority />
    </span>
  );
}

/** Full lockup: mark + "VedaAI" wordmark. */
export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}): React.ReactNode {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("size-10", markClassName)} />
      <span className="font-bricolage font-bold text-[28px] leading-[20px] tracking-[-0.06em] text-ink align-middle flex items-center">
        Veda<span>AI</span>
      </span>
    </span>
  );
}
