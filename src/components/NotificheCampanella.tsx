"use client";

// La campanella: l'unico punto da cui chiedersi «c'e' qualcosa per me?».
//
// PERCHE' NELL'HEADER E NON SULLA DASHBOARD. Le comunicazioni che contano —
// una risposta dello staff, una verifica respinta, un profilo che non compare —
// arrivavano su pagine diverse e si vedevano solo se per caso eri li'. Un
// professionista che passa la giornata in /messaggi non aveva modo di sapere
// che gli avevamo scritto. L'header e' l'unico posto presente ovunque.
//
// IL PALLINO NON SI SPEGNE GUARDANDOLO. Aprire la tendina marca come lette le
// NOTIZIE, non le cose da fare: quelle si spengono quando sono fatte. Un
// contatore che si azzera perche' l'hai guardato e' un contatore che non
// significa niente.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifiche } from "@/components/NotificheProvider";
import { NotificaVoce } from "@/components/NotificaVoce";
import { daVedere, leggiViste } from "@/lib/notifiche";

const NELLA_TENDINA = 4;

export function NotificheCampanella() {
  const { notifiche, daContare, caricate, segnaLette } = useNotifiche();
  const [aperta, setAperta] = useState(false);
  // Congelato all'apertura: se marcassimo come lette e rileggessimo subito, i
  // pallini sparirebbero sotto gli occhi mentre li stai guardando.
  const [visteAllApertura, setVisteAllApertura] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aperta) return;
    function fuori(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) {
        setAperta(false);
      }
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAperta(false);
    }
    document.addEventListener("mousedown", fuori);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuori);
      document.removeEventListener("keydown", esc);
    };
  }, [aperta]);

  function apri() {
    if (aperta) {
      setAperta(false);
      return;
    }
    setVisteAllApertura(leggiViste());
    setAperta(true);
    segnaLette();
  }

  const mostrate = notifiche.slice(0, NELLA_TENDINA);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={apri}
        aria-label={
          daContare > 0
            ? `Notifiche: ${daContare} da vedere`
            : "Notifiche"
        }
        aria-expanded={aperta}
        title="Notifiche di servizio"
        className={`relative rounded-xl p-2.5 transition ${
          aperta
            ? "bg-bob-indigo-50 text-bob-indigo"
            : "text-bob-ink/55 hover:bg-bob-indigo-50 hover:text-bob-indigo"
        }`}
        data-testid="button-notifiche"
        data-tour="notifiche"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {daContare > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bob-indigo px-1 text-[10px] font-bold leading-none text-white"
            data-testid="badge-notifiche"
          >
            {daContare > 9 ? "9+" : daContare}
          </span>
        )}
      </button>

      {aperta && (
        <div
          className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl"
          role="dialog"
          aria-label="Notifiche di servizio"
          data-testid="tendina-notifiche"
        >
          <div className="flex items-baseline justify-between border-b border-black/5 px-4 py-3">
            <p className="text-sm font-bold text-bob-ink">Notifiche</p>
            <p className="text-xs text-bob-ink/45">Account e profilo</p>
          </div>

          {!caricate ? (
            <p className="px-4 py-6 text-center text-sm text-bob-ink/50">
              Controllo…
            </p>
          ) : notifiche.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-bob-ink/70">
                Non c&apos;è niente da leggere.
              </p>
              <p className="mt-1 text-xs text-bob-ink/45">
                Qui finiscono le nostre comunicazioni: verifica, risposte
                dell&apos;assistenza, stato del tuo profilo. I messaggi dei
                clienti stanno in Messaggi.
              </p>
            </div>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-black/5 overflow-y-auto">
              {mostrate.map((n) => (
                <NotificaVoce
                  key={n.id}
                  n={n}
                  nuova={daVedere(n, visteAllApertura)}
                  compatta
                  onNavigato={() => setAperta(false)}
                />
              ))}
            </ul>
          )}

          <div className="border-t border-black/5 px-4 py-2.5 text-center">
            <Link
              href="/notifiche"
              onClick={() => setAperta(false)}
              className="text-sm font-semibold text-bob-indigo hover:underline"
              data-testid="link-tutte-notifiche"
            >
              {notifiche.length > NELLA_TENDINA
                ? `Vedi tutte (${notifiche.length})`
                : "Apri le notifiche"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
