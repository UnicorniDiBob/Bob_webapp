"use client";

// «NUOVE PRENOTAZIONI» (08/10, André). Le prenotazioni dirette arrivate e non
// ancora aperte, in cima alla dashboard del pro, sopra «Nuove richieste». La
// regola di chi compare sta in lib/nuovePrenotazioni.ts, con i suoi test.
//
// Non si disegna niente finche' non si e' letto l'elenco delle aperte: una
// scheda gia' aperta non deve lampeggiare al caricamento. Con piu' di due,
// le altre stanno dietro «Vedi tutte»: su 390px «Nuove richieste» non deve
// finire in fondo alla pagina.

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { LinkChat } from "@/components/LinkChat";
import { fmtRange } from "@/lib/calendar";
import {
  PRENOTAZIONI_IN_VISTA,
  dividiInVista,
  eCandidata,
  leggiAperte,
  nuovePrenotazioni,
  segnaAperta,
} from "@/lib/nuovePrenotazioni";
import type { Appointment } from "@/lib/supabase/types";

function giorno(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function prezzo(p: number): string {
  return p.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export function NuovePrenotazioni({
  appointments,
  onVediNelCalendario,
}: {
  appointments: Appointment[];
  /** Porta il calendario sul giorno della prenotazione e la evidenzia. */
  onVediNelCalendario: (a: Appointment) => void;
}) {
  const [aperte, setAperte] = useState<Set<string> | null>(null);
  const [espanso, setEspanso] = useState(false);

  useEffect(() => {
    setAperte(leggiAperte());
  }, []);

  const lista = useMemo(
    () => (aperte ? nuovePrenotazioni(appointments, aperte) : []),
    [appointments, aperte]
  );
  if (lista.length === 0) return null;

  const candidate = appointments.filter((a) => eCandidata(a)).map((a) => a.id);
  const { visibili, nascoste } = dividiInVista(lista, espanso);

  return (
    <section
      className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"
      data-testid="nuove-prenotazioni"
    >
      <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
        <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Nuove prenotazioni
        <span className="tabular-nums">({lista.length})</span>
      </h3>
      <ul className="mt-2.5 flex flex-col gap-2">
        {visibili.map((a) => (
          <li
            key={a.id}
            className="rounded-xl bg-white px-3.5 py-3 shadow-sm"
            data-testid={`nuova-prenotazione-${a.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <p className="min-w-0 break-words text-sm font-semibold text-bob-ink">
                {a.customer_name}
              </p>
              <span className="flex shrink-0 gap-1.5">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-semibold text-amber-800">
                  Nuova
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-2xs font-semibold text-emerald-800">
                  Confermata
                </span>
              </span>
            </div>
            <p className="mt-0.5 break-words text-sm text-bob-ink/75">
              {a.title ?? "Prenotazione diretta"}
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="tabular-nums text-bob-indigo">
                {giorno(a.starts_at)} · {fmtRange(a)}
              </span>
              {a.price != null && (
                <span className="font-semibold tabular-nums text-bob-ink">
                  {prezzo(Number(a.price))}
                </span>
              )}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {a.request_id ? (
                <span
                  className="contents"
                  // Si segna e basta: la pagina se ne va, e togliere la
                  // scheda adesso interromperebbe l'apertura animata.
                  onClickCapture={() => segnaAperta(a.id, candidate)}
                >
                  <LinkChat
                    href={`/messaggi?r=${a.request_id}&p=${a.professional_id}`}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-bob-indigo px-3 text-center text-sm font-semibold text-white hover:bg-bob-indigo-600"
                    data-testid={`nuova-prenotazione-chat-${a.id}`}
                  >
                    Apri la chat
                  </LinkChat>
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => {
                  setAperte(segnaAperta(a.id, candidate));
                  onVediNelCalendario(a);
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-bob-indigo/30 bg-white px-3 text-center text-sm font-semibold text-bob-indigo hover:bg-bob-indigo-50"
                data-testid={`nuova-prenotazione-calendario-${a.id}`}
              >
                Vedi nel calendario
              </button>
            </div>
          </li>
        ))}
      </ul>
      {nascoste > 0 || (espanso && lista.length > PRENOTAZIONI_IN_VISTA) ? (
        <button
          type="button"
          onClick={() => setEspanso((e) => !e)}
          className="mt-1 inline-flex min-h-[44px] items-center text-sm font-semibold text-emerald-800 hover:underline"
          aria-expanded={espanso}
          data-testid="nuove-prenotazioni-tutte"
        >
          {espanso ? "Mostra meno" : `Vedi tutte (${lista.length})`}
        </button>
      ) : null}
    </section>
  );
}
