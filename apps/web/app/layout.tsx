import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hyntor - Don't just get the answer. Actually learn it.",
  description:
    "Hyntor turns your class's real materials - slides, notes, homework, past exams, inherited semester after semester - into an AI study partner that guides you to the answer on graded work, never past it.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
