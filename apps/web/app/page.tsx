import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyIllustration } from "@/src/components/home/EmptyIllustration";
import { buttonClasses } from "@/src/components/ui/button-styles";

export const metadata: Metadata = {
  title: "Assignments · VedaAI",
  description: "Create assignments and generate exam-ready question papers with AI.",
};

export default function Home(): ReactNode {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center">
      <EmptyIllustration className="h-52 w-auto sm:h-60" />

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink sm:text-[1.7rem]">
        No assignments yet
      </h1>
      <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-muted">
        Create your first assignment to start generating exam-ready question
        papers. Set the question types, marks and due date, and let AI draft a
        structured paper you can review and export.
      </p>

      <Link href="/create" className={buttonClasses("primary", "lg", "mt-7")}>
        <Plus className="size-[1.15rem]" />
        Create Your First Assignment
      </Link>
    </section>
  );
}
