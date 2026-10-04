import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// La testata comune delle pagine dei numeri: il ritorno, il titolo e le tre
// schede. «Analisi avanzate» e «Ricavi esterni» si vedono su tutti i piani:
// il Free ci trova cosa contengono e in quale piano ci sono, non una porta
// nascosta.
export function SchedeNumeri({ attiva }: { attiva: "base" | "avanzata" | "esterni" }) {
  const scheda = (chiave: "base" | "avanzata" | "esterni", href: string, testo: string) => (
    <Link
      href={href}
      aria-current={attiva === chiave ? "page" : undefined}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        attiva === chiave
          ? "bg-bob-indigo text-white shadow-sm"
          : "border border-black/10 bg-white text-bob-ink/70 hover:border-bob-indigo/30 hover:text-bob-indigo"
      }`}
      data-testid={`scheda-${chiave}`}
    >
      {testo}
    </Link>
  );

  return (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-bob-ink/70 transition hover:text-bob-indigo"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Il mio lavoro
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
        I tuoi numeri
      </h1>
      <nav aria-label="Tipo di analisi" className="mt-3 flex flex-wrap gap-2">
        {scheda("base", "/numeri", "Il conto del mese")}
        {scheda("avanzata", "/numeri/avanzate", "Analisi avanzate")}
        {scheda("esterni", "/numeri/esterni", "Ricavi esterni")}
      </nav>
    </div>
  );
}
