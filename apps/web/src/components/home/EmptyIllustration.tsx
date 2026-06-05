import Image from "next/image";
import homepageIll from "@/../../design/homepage_ill1.svg";

/** Decorative "no assignments" illustration from the Figma empty state. */
export function EmptyIllustration({ className }: { className?: string }): React.ReactNode {
  return (
    <div className={className}>
      <Image src={homepageIll} className="w-full h-full object-contain" alt="No assignments illustration" priority />
    </div>
  );
}
