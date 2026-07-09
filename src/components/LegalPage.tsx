import type { ReactNode } from "react";

// Layout condiviso per le pagine legali e informative (privacy, cookie,
// termini, chi-siamo): stessa gabbia, stessa tipografia, zero duplicazione.
export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  /** Data ultimo aggiornamento, es. "Luglio 2026". Omessa se non pertinente. */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="container-bob py-12">
      <div className="mx-auto max-w-3xl">
        <span className="section-eyebrow">{eyebrow}</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          {title}
        </h1>
        {updated && (
          <p className="mt-2 text-xs text-bob-ink/45">
            Ultimo aggiornamento: {updated}
          </p>
        )}
        <div className="mt-8 space-y-8">{children}</div>
      </div>
    </div>
  );
}

// Sezione titolata di una pagina legale.
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-bob-ink">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-bob-ink/70">
        {children}
      </div>
    </section>
  );
}
