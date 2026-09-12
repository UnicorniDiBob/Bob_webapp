"use client";

// A CHE PUNTO E' LA TUA RICHIESTA DI VERIFICA (12/09, scelta di Lucio).
//
// PERCHE'. La verifica e' esclusiva dei piani a pagamento: chi aspetta ha
// pagato, e mentre aspetta non ha il badge ne' il risalto. Fino a ieri, in
// quella finestra, vedeva una riga gialla ferma - «richiesta in esame» -
// identica il primo giorno e il quinto: una cosa che non si muove sembra una
// cosa dimenticata.
//
// COSA DICE: LO STATO DELLA RICHIESTA, E BASTA. Ricevuta, in gestione, e poi
// l'esito - approvata o non accolta - piu' il caso in cui abbiamo chiesto dei
// documenti. Non i passi interni della lavorazione: al professionista non
// serve sapere quale archivio abbiamo interrogato, e raccontarglielo promette
// un meccanismo invece di uno stato. Non il tempo trascorso: una barra che
// avanza da sola arriva piena anche quando non e' successo niente, e a quel
// punto la promessa si vede rotta prima ancora che qualcuno risponda.
//
// SPARISCE QUANDO IL GIRO E' FINITO BENE. Ad approvazione ottenuta non ha piu'
// niente da dire e lascia il posto al riquadro verde; se la richiesta non e'
// accolta resta, piena, perche' «non accolta» e' uno stato che va letto.
// Stessa regola del pallino sullo stato del profilo: quello che e' a posto non
// occupa spazio.
//
// L'SLA E' DICHIARATO, NON CONTATO A VIDEO. Cinque giorni lavorativi e' la
// promessa e si legge come promessa. Nessun conto alla rovescia: la coda non
// ha nemmeno un timestamp di ingresso, quindi un countdown sarebbe una cifra
// inventata, e finche' quel timestamp non esiste l'SLA non lo misura nessuno.

import type { VatReviewState } from "@/lib/vat";
import { SLA_VERIFICA_GIORNI_LAVORATIVI } from "@/lib/vat";

type Fase = "gestione" | "documenti" | "rifiutata";

const FASI: Record<Fase, { titolo: string; passo: number; nota: string }> = {
  gestione: {
    titolo: "In gestione",
    passo: 2,
    nota: `La stiamo guardando noi: non serve fare altro. Di solito rispondiamo entro ${SLA_VERIFICA_GIORNI_LAVORATIVI} giorni lavorativi, e se sforiamo ti scriviamo.`,
  },
  documenti: {
    titolo: "Documenti richiesti",
    passo: 2,
    nota: "Ci serve un documento da te: riprendiamo appena ci arriva.",
  },
  rifiutata: {
    titolo: "Non accolta",
    passo: 3,
    nota: "Il motivo è qui sotto. Se pensiamo male noi, correggi e ripresenta: la rivediamo a mano.",
  },
};

const PASSI = ["Ricevuta", "In gestione", "Esito"];

export function AvanzamentoVerifica({
  review,
  verificato,
}: {
  review: VatReviewState | null;
  verificato: boolean;
}) {
  // Approvata: il riquadro verde dice tutto, la barra sparisce.
  if (verificato) return null;

  const fase: Fase | null =
    review === "pending"
      ? "gestione"
      : review === "docs_requested"
        ? "documenti"
        : review === "rejected"
          ? "rifiutata"
          : null;

  // Nessuna richiesta aperta: non c'e' niente da seguire.
  if (!fase) return null;

  const { titolo, passo, nota } = FASI[fase];
  const quota = passo / PASSI.length;
  const negativa = fase === "rifiutata";

  return (
    <div
      className="rounded-xl border border-black/5 px-3 py-2.5"
      data-testid="avanzamento-verifica"
      data-fase={fase}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={`text-xs font-semibold ${
            negativa ? "text-red-700" : "text-bob-ink/70"
          }`}
        >
          {titolo}
        </p>
        <p className="text-[11px] text-bob-ink/45">
          Passo {passo} di {PASSI.length}
        </p>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={PASSI.length}
        aria-valuenow={passo}
        aria-label={`Stato della richiesta di verifica: ${titolo}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            negativa ? "bg-red-400" : "bg-bob-indigo/70"
          }`}
          style={{ width: `${Math.round(quota * 100)}%` }}
        />
      </div>

      {/* I tre stati scritti sotto la barra: senza, «passo 2 di 3» non dice
          di cosa. Quello corrente in scuro, gli altri in chiaro. */}
      <ol className="mt-1.5 flex justify-between text-[10px] text-bob-ink/35">
        {PASSI.map((p, i) => (
          <li
            key={p}
            className={
              i + 1 === passo
                ? negativa
                  ? "font-semibold text-red-700"
                  : "font-semibold text-bob-ink/60"
                : ""
            }
          >
            {p}
          </li>
        ))}
      </ol>

      <p className="mt-2 text-[11px] leading-relaxed text-bob-ink/45">{nota}</p>
    </div>
  );
}
