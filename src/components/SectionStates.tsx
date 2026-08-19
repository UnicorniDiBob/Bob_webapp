"use client";

// Stati condivisi delle sezioni dell'area personale.
//
// Prima, con una pagina unica, c'era un solo "Carico il tuo profilo…" per
// tutto: se una query fra dieci era lenta si aspettava comunque l'intera
// pagina, e se ne falliva una si vedeva un pezzo di schermo vuoto senza
// spiegazione. Sezioni separate rendono questi tre stati ripetuti, quindi
// stanno scritti una volta sola.

import Link from "next/link";

/** Attesa: occupa lo spazio che occupera' il contenuto, per non far saltare la pagina. */
export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card space-y-4 p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carico la sezione…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-black/[0.06]" />
          <div className="h-11 animate-pulse rounded-xl bg-black/[0.04]" />
        </div>
      ))}
    </div>
  );
}

/** Errore di caricamento: dice cosa e' andato storto e offre l'unica azione utile. */
export function SectionError({
  onRetry,
  children,
}: {
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-6" data-testid="section-error">
      <p className="text-sm font-semibold text-bob-ink">
        Non sono riuscito a caricare questa sezione.
      </p>
      <p className="mt-1.5 text-sm text-bob-ink/60">
        {children ??
          "Può essere la connessione. Gli altri dati del tuo account non sono stati toccati."}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-4 py-2.5">
          Riprova
        </button>
      )}
    </div>
  );
}

/**
 * Ruolo professionista ma nessuna riga in professionals: iscrizione mai
 * completata. Non e' un errore, e' un percorso interrotto — e l'unico posto
 * dove quella riga nasce e' l'onboarding.
 */
export function NoProProfile() {
  return (
    <div className="card p-6" data-testid="no-pro-profile">
      <p className="text-sm font-semibold text-bob-ink">
        Manca l&apos;ultimo passo dell&apos;iscrizione
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/60">
        Il tuo account professionista esiste, ma il profilo no: senza quello non
        possiamo mostrarti ai clienti. Sono due minuti — scegli il piano e
        rispondi a quattro domande.
      </p>
      <Link href="/onboarding/piano" className="btn-primary mt-4 py-2.5">
        Completa l&apos;iscrizione →
      </Link>
    </div>
  );
}

/**
 * Sezione riservata ai piani a pagamento. Dice cosa si sbloccherebbe, non
 * finge che la funzione non esista: nascondere una funzione a pagamento e'
 * peggio che dichiararla, perche' chi paga non sa cosa ha comprato.
 */
export function UpgradeNeeded({
  what,
  children,
}: {
  what: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-6" data-testid="upgrade-needed">
      <p className="text-sm font-semibold text-bob-ink">
        {what} è incluso in Bob Pro e Bob Business
      </p>
      {children && (
        <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/60">
          {children}
        </p>
      )}
      <Link href="/impostazioni/piano" className="btn-secondary mt-4 py-2.5">
        Vedi il tuo piano
      </Link>
    </div>
  );
}
