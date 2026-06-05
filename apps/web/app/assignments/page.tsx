import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AssignmentsView } from "@/src/components/assignments/AssignmentsView";

export const metadata: Metadata = {
  title: "Assignments · VedaAI",
  description: "Manage and create assignments for your classes.",
};

export default function AssignmentsPage(): ReactNode {
  return <AssignmentsView />;
}
