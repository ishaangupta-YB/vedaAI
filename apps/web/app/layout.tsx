import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, Inter, Bricolage_Grotesque } from "next/font/google";
import { AppShell } from "@/src/components/shell/AppShell";
import { Toaster } from "sonner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VedaAI · Assessment Creator",
  description:
    "Create assignments, generate structured question papers with AI, and export exam-ready PDFs.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable} ${bricolage.variable}`}>
      <body className="antialiased font-sans">
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
