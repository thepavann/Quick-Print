import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand";

export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { heading: string; body: ReactNode }[];
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/" aria-label="QuickPrint home">
            <Logo />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold text-foreground">{s.heading}</h2>
              <div className="mt-2 text-[0.95rem] leading-7 text-muted-foreground">{s.body}</div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
