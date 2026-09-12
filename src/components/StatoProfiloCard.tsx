"use client";

// IL RIQUADRO CHE RISPONDE A UNA DOMANDA SOLA: compari nelle ricerche?
//
// PERCHE' ESISTE. Fino a ieri quella risposta viveva dentro la guida del primo
// accesso: la vedevi una volta, si chiamava «pronto a ricevere richieste» e poi
// spariva. Un professionista che il giorno dopo si chiede «ma i clienti mi
// vedono?» non aveva nessun posto dove guardare, e la frase non diceva da dove
// venisse — sembrava un semaforo acceso da noi. Adesso sta in pagina, sempre,
// e dichiara di cosa e' fatta.
//
// QUANDO NON MANCA PIU' NIENTE, SPARISCE (12/09, scelta di Lucio).
// Un riquadro che dice «tutto a posto» tutti i giorni e' rumore: occupa la
// cima della colonna, si legge una volta e poi si smette di guardarlo — e con
// lui si smette di guardare il posto dove un giorno comparira' un problema.
// A giro completo resta un pallino verde: ci passi sopra il cursore e dice se
// compari nelle ricerche, ci clicchi e il riquadro torna intero. Se invece
// qualcosa manca, o non compari, il riquadro sta aperto da solo: il silenzio
// vale solo quando la risposta e' «si'».
//
// La regola e la provenienza stanno in useStatoProfilo: qui si disegna.

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronUp, Loader2, RotateCw } from "lucide-react";
import { useStatoProfilo } from "@/lib/useStatoProfilo";

export function StatoProfiloCard({
  professionalId,
  userId,
}: {
  professionalId: string;
  userId: string;
}) {
  const { esito, rileggi } = useStatoProfilo(professionalId, userId);
  // Riaperto a mano dal pallino. Non si salva da nessuna parte: si ricava
  // dallo stato, quindi non puo' restare indietro rispetto ai fatti.
  const [riaperto, setRiaperto] = useState(false);

  const aPosto =
    esito.fase === "letto" && esito.stato.compare && esito.stato.mancanti === 0;

  if (aPosto && !riaperto) {
    const dal = esito.stato.readyAt
      ? ` dal ${new Date(esito.stato.readyAt).toLocaleDateString("it-IT", {
          day: "numeric",
          month: "long",
        })}`
      : "";
    return (
      <div className="flex justify-end" data-tour="stato">
        <button
          type="button"
          onClick={() => setRiaperto(true)}
          title={`Compari nelle ricerche${dal}. Clicca per vedere il profilo.`}
          aria-label={`Compari nelle ricerche${dal}. Apri lo stato del profilo.`}
          className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-black/[0.04]"
          data-testid="stato-profilo-pallino"
        >
          <span
            className="h-2.5 w-2.5 rounded-full bg-emerald-500"
            aria-hidden="true"
          />
        </button>
      </div>
    );
  }

  return (
    <div className="card p-5" data-tour="stato" data-testid="stato-profilo">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-bob-ink">Il tuo profilo</h3>
        <div className="flex items-center gap-0.5">
        {aPosto && (
          <button
            type="button"
            onClick={() => setRiaperto(false)}
            className="-mt-1 rounded-lg p-1.5 text-bob-ink/40 transition hover:bg-black/5 hover:text-bob-indigo"
            title="Richiudi: resta il pallino"
            aria-label="Richiudi lo stato del profilo"
            data-testid="button-richiudi-stato"
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={rileggi}
          className="-mr-1 -mt-1 rounded-lg p-1.5 text-bob-ink/40 transition hover:bg-black/5 hover:text-bob-indigo"
          title="Ricontrolla adesso"
          aria-label="Ricontrolla adesso"
          data-testid="button-ricontrolla-stato"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        </div>
      </div>

      {esito.fase === "carico" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-bob-ink/50">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Controllo…
        </p>
      )}

      {esito.fase === "irraggiungibile" && (
        <p className="mt-3 text-sm text-bob-ink/60">
          Non riesco a controllare adesso.{" "}
          <button
            type="button"
            onClick={rileggi}
            className="font-medium text-bob-indigo hover:underline"
          >
            Riprova
          </button>
        </p>
      )}

      {esito.fase === "letto" && (
        <>
          <p className="mt-3 flex items-start gap-2 text-sm font-semibold">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                esito.stato.compare ? "bg-emerald-500" : "bg-amber-500"
              }`}
              aria-hidden="true"
            />
            <span className={esito.stato.compare ? "text-bob-ink" : "text-amber-700"}>
              {esito.stato.compare
                ? "Compari nelle ricerche"
                : "Non compari in nessuna ricerca"}
              {esito.stato.readyAt && (
                <span className="font-normal text-bob-ink/45">
                  {" "}
                  dal{" "}
                  {new Date(esito.stato.readyAt).toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              )}
            </span>
          </p>

          {/* IL MOTIVO, NON UN RIMANDO (30/08). Qui c'era scritto «il primo
              punto qui sotto è quello che ti tiene fuori»: una freccia verso
              una lista, non una risposta. Chi legge «non compari» vuole
              sapere PERCHE', e lo vuole sapere nella stessa frase. */}
          {!esito.stato.compare && esito.stato.motivo && (
            <div
              className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5"
              data-testid="motivo-invisibile"
            >
              <p className="text-xs leading-relaxed text-amber-900">
                <span className="font-semibold">Perché:</span>{" "}
                {esito.stato.motivo}.
              </p>
              <Link
                href={esito.stato.hrefMotivo}
                className="mt-1.5 inline-block text-xs font-semibold text-amber-800 underline-offset-2 hover:underline"
                data-testid="link-risolvi-motivo"
              >
                Sistemalo adesso →
              </Link>
            </div>
          )}

          <p className="mt-2 pl-4 text-xs text-bob-ink/55">
            {esito.stato.mancanti === 0
              ? "Non manca niente."
              : esito.stato.compare
                ? "Le cose qui sotto non ti nascondono: cambiano quante richieste ti arrivano e come."
                : "Le altre righe non ti nascondono: cambiano quante richieste ricevi e come."}
          </p>

          <ul className="mt-3 space-y-2 border-t border-black/5 pt-3">
            {esito.stato.voci.map((v) => (
              <li key={v.chiave} className="flex items-start gap-2 text-sm">
                <span
                  title={v.tabella}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    v.fatto
                      ? "bg-emerald-600 text-white"
                      : v.blocca
                        ? "border-2 border-amber-500"
                        : "border border-black/20"
                  }`}
                  aria-hidden="true"
                >
                  {v.fatto && <Check className="h-3 w-3" />}
                </span>
                {v.fatto ? (
                  <span className="text-bob-ink/45">{v.titolo}</span>
                ) : (
                  <span className="text-bob-ink">
                    <span className="font-medium">{v.titolo}</span>
                    <span className="text-bob-ink/55"> — {v.conseguenza} </span>
                    <Link
                      href={v.href}
                      className="whitespace-nowrap font-medium text-bob-indigo hover:underline"
                      data-testid={`link-sistema-${v.chiave}`}
                    >
                      Sistemalo
                    </Link>
                  </span>
                )}
              </li>
            ))}
          </ul>

          {/* La riga che spiega la riga. Costa due secondi di lettura e
              risparmia la domanda «ma chi lo decide?». Dice due cose diverse
              perche' due cose diverse sono: lo stato lo tiene il server, la
              lista qui sopra e' un controllo fatto adesso. */}
          <p className="mt-3 border-t border-black/5 pt-3 text-[11px] leading-relaxed text-bob-ink/40">
            {esito.stato.readyAt
              ? "Non è un interruttore: lo stato è salvato sul tuo profilo e si accende da solo quando dichiari cosa fai. Le righe qui sopra sono controllate adesso, alle "
              : "Non è un interruttore e non lo decidiamo a mano: dipende da cosa hai dichiarato. Controllo fatto adesso, alle "}
            {esito.stato.letto.toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
        </>
      )}
    </div>
  );
}
