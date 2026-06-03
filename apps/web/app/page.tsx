import type { ReactNode } from "react";

export default function Home(): ReactNode {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold tracking-tight">
        VedaAI Assessment Creator
      </h1>
      <p className="text-gray-500">
        Web scaffold. Features arrive in a later phase.
      </p>
    </main>
  );
}
