"use client";

// LA DATA DI UN APPUNTAMENTO SI PUO' CLICCARE (05/09).
// Prima una data era testo: la persona la leggeva, apriva il suo calendario e
// la ricopiava a mano — con tutti gli sbagli che ricopiare comporta, e con la
// possibilita' di dimenticarsene del tutto. Adesso ogni data in evidenza e' un
// bottone: chiede se vuoi metterla in calendario e ti da' due strade.
//
// Due strade e non una, perche' fanno cose diverse:
//   - il file .ics lo genera il nostro server e lo apre il calendario del
//     dispositivo. Non passa da nessuno.
//   - il link a Google Calendar e' comodo per chi vive li' dentro, ma manda
//     titolo e orario a Google. E' una scelta della persona, quindi la
//     scelta gliela mettiamo davanti scritta, non nascosta in fondo.
//
// Il contenuto e' il minimo indispensabile: vedi lib/ics.ts per il perche'.

import { useEffect, useState } from "react";
import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import { linkGoogleCalendar } from "@/lib/ics";

export interface AppuntamentoDaSalvare {
  id: string;
  starts_at: string;
  duration_minutes: number;
  title?: string | null;
  status?: string | null;
}

/** Un appuntamento annullato non si mette in calendario. */
function salvabile(a: AppuntamentoDaSalvare): boolean {
  return a.status !== "cancelled" && a.status !== "declined";
}

export function AggiungiAlCalendario({
  appuntamento,
  children,
  className = "",
  titoloVisibile,
}: {
  appuntamento: AppuntamentoDaSalvare;
  /** La data com'è già scritta in pagina: diventa lei il bottone. */
  children: React.ReactNode;
  className?: string;
  /** Come chiamare l'evento nel calendario. Default: il titolo o «Appuntamento». */
  titoloVisibile?: string;
}) {
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAperto(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aperto]);

  if (!salvabile(appuntamento)) return <>{children}</>;

  const inizio = new Date(appuntamento.starts_at);
  if (isNaN(inizio.getTime())) return <>{children}</>;

  const titolo = `${
    titoloVisibile?.trim() || appuntamento.title?.trim() || "Appuntamento"
  } · BOB`;

  const quando = inizio.toLocaleString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const google = linkGoogleCalendar({
    uid: `appuntamento-${appuntamento.id}@meetonda.com`,
    inizio,
    durataMinuti: appuntamento.duration_minutes,
    titolo,
  });

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAperto(true);
        }}
        className={`group inline-flex items-center gap-1 rounded-md text-left underline decoration-dotted decoration-1 underline-offset-2 transition hover:text-bob-indigo focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40 ${className}`}
        title="Aggiungi al calendario"
        aria-label={`Aggiungi al calendario: ${quando}`}
        data-testid={`calendario-apri-${appuntamento.id}`}
      >
        {children}
        <CalendarPlus
          className="h-3.5 w-3.5 shrink-0 opacity-45 transition group-hover:opacity-100"
          aria-hidden="true"
        />
      </button>

      {aperto && (
        <div
          className="fixed inset-0 z-[60] flex h-[100dvh] items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Aggiungi al calendario"
          onClick={() => setAperto(false)}
        >
          <div
            className="card w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
            data-testid={`calendario-dialogo-${appuntamento.id}`}
          >
            <h3 className="text-base font-bold text-bob-ink">
              Lo metto nel tuo calendario?
            </h3>
            <p className="mt-1 text-sm capitalize text-bob-ink/70">{quando}</p>
            {appuntamento.status === "proposed" && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                È ancora una proposta: lo salvo come «da confermare», così se
                cambia non ti resta un orario sbagliato in agenda.
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <a
                href={`/api/appuntamenti/${appuntamento.id}/ics`}
                className="btn-primary inline-flex items-center justify-center gap-2 py-2.5"
                onClick={() => setAperto(false)}
                data-testid={`calendario-ics-${appuntamento.id}`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Aggiungi al calendario del telefono
              </a>
              <a
                href={google}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center justify-center gap-2 py-2.5"
                onClick={() => setAperto(false)}
                data-testid={`calendario-google-${appuntamento.id}`}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Apri in Google Calendar
              </a>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-bob-ink/50">
              Nell&apos;appuntamento finiscono solo titolo, giorno, ora e
              durata: né indirizzo né numero di telefono. Il primo bottone
              scarica un file dal nostro server; il secondo apre Google, che
              riceve titolo e orario.
            </p>

            <button
              type="button"
              onClick={() => setAperto(false)}
              className="btn-ghost mt-2 w-full py-2 text-sm"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
