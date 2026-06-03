import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CreateAssignmentForm } from "@/src/components/create/CreateAssignmentForm";
import { PageHeader } from "@/src/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Create Assignment · VedaAI",
  description: "Set up an assignment and generate a structured question paper.",
};

export default function CreatePage(): ReactNode {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Create Assignment" subtitle="Set up a new assignment for your students" />
      <div className="mt-5">
        <CreateAssignmentForm />
      </div>
    </div>
  );
}
