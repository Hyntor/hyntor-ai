// Typography helpers for the legal pages (/terms, /privacy) - long-form
// text on a white "paper" card over the dark marketing shell.
import type { ReactNode } from "react";

export function LegalTitle({ children, updated }: { children: ReactNode; updated: string }) {
  return (
    <header className="mb-10">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">{children}</h1>
      <p className="mt-3 text-sm font-semibold text-slate-500">Last updated: {updated}</p>
    </header>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-display text-xl font-semibold text-ink">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] font-medium leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export const CONTACT_EMAIL = "batorgilrb@gmail.com";
