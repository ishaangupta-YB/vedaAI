import type { Difficulty } from "@veda-ai/shared";
import { DIFFICULTY_BADGE, DIFFICULTY_LABELS } from "@/src/lib/labels";
import { cn } from "@/src/lib/cn";

/** Color-coded difficulty pill (easy / moderate / hard). */
export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}): React.ReactNode {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-[0.1rem] text-[0.68rem] font-bold uppercase tracking-wide ring-1",
        DIFFICULTY_BADGE[difficulty],
        className,
      )}
    >
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}
