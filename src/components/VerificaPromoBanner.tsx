"use client";

// Avviso sulla verifica nella dashboard del professionista (blocco 10, 10.8).
//
// Deve dire la verità sul punto in cui è la SUA pratica, non un invito uguale
// per tutti: chi ha già mandato la partita IVA e legge "il tuo profilo non è
// verificato, verifica ora" pensa che la richiesta si sia persa. Quindi quattro
// stati, quattro messaggi, e quando c'è una richiesta dello staff quella viene
// prima di tutto il resto.
//
// Tono: piccolo, una riga, chiudibile. Non è una pubblicità che lampeggia.

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Clock, FileText, X } from "lucide-react";
import type { VatReviewState } from "@/lib/vat";

/**
 * Prezzo della verifica, quando e se diventerà a pagamento.
 * Oggi è null: la verifica è inclusa e il testo lo dice così com'è. Il giorno
 * della decisione si scrive qui e basta.
 */
const PREZZO_VERIFICA: { importo: number; nota: string } | null = null;

/** Dove si fa: il link porta direttamente al campo, non in cima alla pagina. */
const LINK_VERIFICA = "/dashboard/verifica";

export default function VerificaPromoBanner({
  reviewState = null,
  reviewNote = null,
}: {
  /** Stato dell'esame umano sulla sua richiesta, se ne ha una aperta. */
  reviewState?: VatReviewState | null;
  /** Cosa gli abbiamo chiesto o risposto: è la parte che gli serve leggere. */
  reviewNote?: string | null;
}) {
  const [chiuso, setChiuso] = useState(false);
  if (chiuso) return null;

  const contenuto = (() => {
    switch (reviewState) {
      case "docs_requested":
        return {
          icona: FileText,
          colore: "border-amber-200 bg-amber-50/70",
          tintaIcona: "text-amber-600",
          titolo: "Ci serve un documento per completare la verifica.",
          testo:
            reviewNote ??
            "Ti contattiamo noi con le istruzioni per inviarlo: appena lo riceviamo completiamo il controllo.",
          nota: "Se intanto ti accorgi che il numero o la ragione sociale erano sbagliati, puoi correggerli.",
          azione: "Apri la verifica →",
        };
      case "pending":
        return {
          icona: Clock,
          colore: "border-amber-200 bg-amber-50/70",
          tintaIcona: "text-amber-600",
          titolo: "La tua verifica è in esame.",
          testo:
            "Il controllo automatico non ha potuto confermare da solo la partita IVA — succede spesso, per esempio a chi non lavora con l'estero o lavora con una società. La stiamo controllando a mano: non serve fare altro.",
          nota: "Ti avvisiamo appena c'è un esito. Se hai sbagliato una cifra puoi correggerla ora.",
          azione: "Vedi lo stato →",
        };
      case "rejected":
        return {
          icona: FileText,
          colore: "border-red-200 bg-red-50/70",
          tintaIcona: "text-red-600",
          titolo: "La richiesta di verifica non è stata accolta.",
          testo:
            reviewNote ??
            "Trovi la motivazione nel tuo profilo: se i dati che abbiamo controllato non sono corretti, puoi correggerli e ripresentarla.",
          nota: "La rivediamo a mano.",
          azione: "Correggi e ripresenta →",
        };
      default:
        return {
          icona: BadgeCheck,
          colore: "border-bob-indigo/15 bg-bob-indigo-50/60",
          tintaIcona: "text-bob-indigo",
          titolo: "Il tuo profilo non è verificato.",
          testo:
            "Comunicando la partita IVA i clienti vedono l'etichetta Pro con la data del controllo: è il primo segnale di fiducia che guardano prima di scriverti.",
          nota: PREZZO_VERIFICA
            ? `Costo della verifica: ${PREZZO_VERIFICA.importo.toLocaleString(
                "it-IT",
                { style: "currency", currency: "EUR" }
              )} — ${PREZZO_VERIFICA.nota}`
            : "La verifica è inclusa, senza costi. Bastano il numero e pochi secondi; il numero non è mai visibile ai clienti.",
          azione: "Verifica ora →",
        };
    }
  })();

  const Icona = contenuto.icona;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${contenuto.colore}`}
      data-testid="verifica-promo"
    >
      <Icona
        className={`mt-0.5 h-4 w-4 shrink-0 ${contenuto.tintaIcona}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-bob-ink/80">
          <span className="font-semibold">{contenuto.titolo}</span>{" "}
          {contenuto.testo}
        </p>
        <p className="mt-1 text-xs text-bob-ink/55">{contenuto.nota}</p>
        <Link
          href={LINK_VERIFICA}
          className="mt-2 inline-block text-sm font-semibold text-bob-indigo hover:underline"
        >
          {contenuto.azione}
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
