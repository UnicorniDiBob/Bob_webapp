"use client";

// Avviso discreto nella dashboard del professionista (blocco 10, 10.8).
//
// Il problema che risolve: la verifica esiste ma non la vede nessuno. Sta in
// fondo alla pagina del profilo e nessuno ha motivo di andarci. Senza un invito
// la funzione resta ferma, e senza professionisti che provano non abbiamo
// nemmeno i dati per decidere se serve il fornitore a pagamento.
//
// Tono: piccolo, una riga sola, chiudibile. Non è una pubblicità con lo sconto
// che lampeggia — è un professionista che sta lavorando e a cui stiamo dicendo
// che gli manca un pezzo. Se lo chiude, sparisce per quella sessione: chi ha
// deciso di no non deve rivederlo dieci volte al giorno.

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, X } from "lucide-react";

/**
 * Prezzo della verifica, quando e se diventerà a pagamento.
 *
 * Oggi è null: la verifica è inclusa, e il testo lo dice così com'è. Il giorno
 * in cui si decide un prezzo si scrive qui e basta — il testo si adegua da
 * solo. Tenerlo in un posto unico evita che una cifra provvisoria finisca
 * sparsa in mezzo alle frasi e sopravviva alla decisione che la cambia.
 *
 * Nota: qui si dichiara solo il prezzo. L'incasso non esiste ancora e non
 * serve: prima si guarda quanti la chiedono.
 */
const PREZZO_VERIFICA: { importo: number; nota: string } | null = null;

export default function VerificaPromoBanner() {
  const [chiuso, setChiuso] = useState(false);
  if (chiuso) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-bob-indigo/15 bg-bob-indigo-50/60 px-4 py-3"
      data-testid="verifica-promo"
    >
      <BadgeCheck
        className="mt-0.5 h-4 w-4 shrink-0 text-bob-indigo"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-bob-ink/80">
          <span className="font-semibold">Il tuo profilo non è verificato.</span>{" "}
          Comunicando la partita IVA i clienti vedono l&apos;etichetta{" "}
          <strong>Pro</strong> con la data del controllo: è il primo segnale di
          fiducia che guardano prima di scriverti.
        </p>
        <p className="mt-1 text-xs text-bob-ink/55">
          {PREZZO_VERIFICA
            ? `Costo della verifica: ${PREZZO_VERIFICA.importo.toLocaleString(
                "it-IT",
                { style: "currency", currency: "EUR" }
              )} — ${PREZZO_VERIFICA.nota}`
            : "Nel periodo pilota è inclusa. Bastano il numero e pochi secondi; il numero non è mai visibile ai clienti."}
        </p>
        <Link
          href="/dashboard/profilo"
          className="mt-2 inline-block text-sm font-semibold text-bob-indigo hover:underline"
        >
          Verifica ora →
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setChiuso(true)}
        aria-label="Nascondi questo avviso"
        className="shrink-0 rounded-lg p-1 text-bob-ink/35 transition hover:bg-black/5 hover:text-bob-ink/60"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
