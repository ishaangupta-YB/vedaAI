import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Question Paper · VedaAI",
  description: "Track generation progress and review the generated question paper.",
};

export default function AssignmentLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
