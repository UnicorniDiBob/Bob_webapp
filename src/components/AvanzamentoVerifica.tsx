"use client";

// LA BARRETTA DELL'ATTESA (12/09, scelta di Lucio).
//
// PERCHE'. La verifica e' esclusiva dei piani a pagamento: chi aspetta ha
// pagato, e mentre aspetta non ha il badge, non ha il risalto e in certe
// categorie non puo' nemmeno farsi contattare. Fino a ieri, in quella finestra,
// vedeva una riga gialla ferma - «richiesta in esame» - identica il primo
// giorno e il quinto. Una cosa che non si muove sembra una cosa dimenticata.
//
// COSA LA RIEMPIE: i passi della SUA pratica, non il tempo e non la coda.
// Il tempo riempirebbe la barra anche quando non e' successo niente, e a barra
// piena senza risposta la promessa si vedrebbe rotta da sola; la coda direbbe
// a ogni professionista quanto siamo indietro. I passi invece dicono una cosa
// vera e verificabile: dove sta adesso la sua richiesta.
//
// SPARISCE QUANDO E' PIENA. A verifica ottenuta la barra non ha piu' niente da
// dire e lascia il posto al riquadro verde. Stessa regola del pallino sullo
// stato del profilo: quello che e' a posto non occupa spazio.
//
// L'SLA E' DICHIARATO, NON CALCOLATO. Cinque giorni lavorativi e' la promessa;
// la data attesa qui sotto si conta da vat_checked_at, che e' il momento del
// controllo automatico e quindi un buon SURROGATO dell'ingresso in coda, non
// l'ingresso in coda. Il giorno che la coda avra' il suo timestamp, questa
// funzione legge quello - e allora l'SLA diventa anche misurabile, che oggi
// non e'. I giorni festivi non sono tolti: solo sabato e domenica.

import type { VatReviewState } from "@/lib/vat";
import { SLA_VERIFICA_GIORNI_LAVORATIVI } from "@/lib/vat";

type StatoPasso = "fatto" | "corso" | "attesa";

interface Passo {
  titolo: string;
  stato: StatoPasso;
}

/** Somma giorni LAVORATIVI (sabato e domenica esclusi, festivi no). */
export function piuGiorniLavorativi(da: Date, giorni: number): Date {
  const d = new Date(da);
  let restanti = giorni;
  while (restanti > 0) {
    d.setDate(d.getDate() + 1);
    const g = d.getDay();
    if (g !== 0 && g !== 6) restanti -= 1;
  }
  return d;
}

export function AvanzamentoVerifica({
  review,
  verificato,
  controllatoIl,
}: {
  review: VatReviewState | null;
  verificato: boolean;
  /** professional_verification.vat_checked_at */
  controllatoIl: string | null;
}) {
  // Niente pratica aperta, o pratica chiusa bene: la barra non esiste.
  if (verificato) return null;
  if (review !== "pending" && review !== "docs_requested") return null;

  const passi: Passo[] = [
    { titolo: "Richiesta ricevuta", stato: "fatto" },
    {
      titolo: "Controllo automatico",
      stato: controllatoIl ? "fatto" : "corso",
    },
    {
      titolo:
        review === "docs_requested"
          ? "Aspettiamo il tuo documento"
          : "Esame di una persona",
      stato: review === "docs_requested" ? "attesa" : "corso",
    },
    { titolo: "Esito", stato: "attesa" },
  ];

  const fatti = passi.filter((p) => p.stato === "fatto").length;
  const corrente = passi.find((p) => p.stato === "corso") ?? passi[fatti - 1];
  // Mezzo passo per quello in corso: la barra si muove appena qualcosa inizia,
  // invece di restare identica per giorni.
  const quota = (fatti + (passi.some((p) => p.stato === "corso") ? 0.5 : 0)) / passi.length;

  const attesaEntro = controllatoIl
    ? piuGiorniLavorativi(
        new Date(controllatoIl),
        SLA_VERIFICA_GIORNI_LAVORATIVI
      )
    : null;

  return (
    <div
      className="rounded-xl border border-black/5 px-3 py-2.5"
      data-testid="avanzamento-verifica"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-bob-ink/70">
          {corrente?.titolo ?? "In lavorazione"}
        </p>
        <p className="text-[11px] text-bob-ink/45">
          Passo {Math.min(fatti + 1, passi.length)} di {passi.length}
        </p>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={passi.length}
        aria-valuenow={fatti}
        aria-label="Avanzamento della verifica"
      >
        <div
          className="h-full rounded-full bg-bob-indigo/70 transition-[width] duration-500"
          style={{ width: `${Math.round(quota * 100)}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-bob-ink/45">
        {review === "docs_requested"
          ? "Riprendiamo appena ci arriva il documento."
          : attesaEntro
            ? `Di solito rispondiamo entro ${SLA_VERIFICA_GIORNI_LAVORATIVI} giorni lavorativi, cioè entro il ${attesaEntro.toLocaleDateString(
                "it-IT",
                { day: "numeric", month: "long" }
              )}. Se sforiamo, ti scriviamo noi.`
            : `Di solito rispondiamo entro ${SLA_VERIFICA_GIORNI_LAVORATIVI} giorni lavorativi.`}
      </p>
    </div>
  );
}
