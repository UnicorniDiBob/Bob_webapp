"use client";

// IL PROMEMORIA DEL GIORNO: una volta al giorno, finche' non compari.
//
// PERCHE' ESISTE (deciso il 30/08 con Lucio). Il riquadro «Il tuo profilo»
// nell'area di lavoro dice la verita', ma la dice solo a chi passa di li'. Un
// professionista iscritto che non ha dichiarato cosa fa non e' in nessuna
// ricerca: per lui Bob e' un prodotto che non funziona, e non lo sa. Questo e'
// l'unico caso in cui interrompere qualcuno e' un favore.
//
// LE REGOLE CHE LO RENDONO UN PROMEMORIA E NON UNA MOLESTIA:
// 1. UNA VOLTA AL GIORNO, non a ogni pagina. La data dell'ultima volta sta in
//    localStorage (preferenza d'interfaccia, nessun dato personale, nessuna
//    riga di RoPA — stessa scelta di lib/guidaProgresso.ts).
// 2. SOLO SE SERVE. Appena il profilo compare nelle ricerche non appare mai
//    piu': la condizione e' la stessa della migrazione 062, letta dalle
//    notifiche di servizio.
// 3. MAI SOPRA UN'ALTRA COSA. Non durante l'iscrizione, non durante la guida
//    del primo accesso (che sta gia' accompagnando alla stessa meta), non
//    sulle pagine di accesso.
// 4. SI CHIUDE, e chiudere vale per tutta la giornata. «Piu' tardi» deve
//    essere vero, altrimenti si impara a chiudere senza leggere.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useNotifiche } from "@/components/NotificheProvider";
import { useStatoProfilo } from "@/lib/useStatoProfilo";
import { leggiProgresso } from "@/lib/guidaProgresso";

const CHIAVE = "bob.promemoria.profilo.v1";

/** Data locale in forma YYYY-MM-DD: il "giorno" e' quello di chi guarda. */
function oggi(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const g = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${g}`;
}

function giaMostratoOggi(): boolean {
  try {
    return window.localStorage.getItem(CHIAVE) === oggi();
  } catch {
    // Senza memoria il promemoria non si mostra: meglio zero volte che a ogni
    // cambio di pagina.
    return true;
  }
}

function segnaMostrato() {
  try {
    window.localStorage.setItem(CHIAVE, oggi());
  } catch {
    // Niente da fare: si ripresentera' al prossimo caricamento. Accettabile.
  }
}

/** Pagine su cui non si interrompe: si sta gia' facendo la stessa cosa. */
const ESCLUSE = ["/onboarding", "/login", "/auth", "/notifiche", "/impostazioni"];

export function PromemoriaProfilo() {
  const supabase = createClient();
  const pathname = usePathname();
  const { user, role, loading } = useAuth();
  const { notifiche, caricate } = useNotifiche();

  const [pro, setPro] = useState<{ id: string; guidaFatta: boolean } | null>(
    null
  );
  const [aperto, setAperto] = useState(false);

  const invisibile = notifiche.some((n) => n.id === "profilo-invisibile");

  useEffect(() => {
    if (loading || !user || role !== "professional") return;
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from("professionals")
        .select("id, onboarding_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!vivo || !data) return;
      const p = data as { id: string; onboarding_completed_at: string | null };
      setPro({ id: p.id, guidaFatta: p.onboarding_completed_at !== null });
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, loading]);

  useEffect(() => {
    if (!caricate || !pro || !invisibile) return;
    if (!pro.guidaFatta) return; // ci pensa la guida del primo accesso
    if (leggiProgresso()?.attiva) return; // un giro e' gia' in corso
    if (ESCLUSE.some((p) => pathname?.startsWith(p))) return;
    if (giaMostratoOggi()) return;
    segnaMostrato();
    setAperto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caricate, pro, invisibile, pathname]);

  const chiudi = useCallback(() => setAperto(false), []);

  useEffect(() => {
    if (!aperto) return;
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") chiudi();
    }
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aperto, chiudi]);

  if (!aperto || !pro || !user) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promemoria-titolo"
      data-testid="promemoria-profilo"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <Corpo
          professionalId={pro.id}
          userId={user.id}
          onChiudi={chiudi}
        />
      </div>
    </div>
  );
}

// Il contenuto sta in un componente a parte perche' usa useStatoProfilo, che
// interroga quattro tabelle: montarlo solo quando il pop-up si apre significa
// non farlo su ogni pagina di ogni giorno.
function Corpo({
  professionalId,
  userId,
  onChiudi,
}: {
  professionalId: string;
  userId: string;
  onChiudi: () => void;
}) {
  const { esito } = useStatoProfilo(professionalId, userId);
  const voci = esito.fase === "letto" ? esito.stato.voci : [];
  const bloccante = voci.find((v) => v.blocca && !v.fatto);
  const altre = voci.filter((v) => !v.blocca && !v.fatto);

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-black/5 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Il tuo profilo non è finito
          </p>
          <h2
            id="promemoria-titolo"
            className="mt-1 text-lg font-bold leading-snug text-bob-ink"
          >
            Oggi i clienti non ti trovano
          </h2>
        </div>
        <button
          type="button"
          onClick={onChiudi}
          aria-label="Chiudi il promemoria"
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-bob-ink/35 transition hover:bg-black/5 hover:text-bob-ink/70"
          data-testid="chiudi-promemoria"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm leading-relaxed text-bob-ink/70">
          {bloccante ? (
            <>
              Manca <strong>{bloccante.titolo.toLowerCase()}</strong>.{" "}
              {bloccante.conseguenza}
            </>
          ) : (
            <>
              Il tuo profilo non compare in nessuna ricerca. Apri le
              impostazioni della tua azienda e completa quello che manca: da
              quel momento sei trovabile, senza aspettare nessuna approvazione.
            </>
          )}
        </p>

        {altre.length > 0 && (
          <div className="mt-4 rounded-xl bg-black/[0.03] px-4 py-3">
            <p className="text-xs font-semibold text-bob-ink/60">
              Poi, quando hai tempo:
            </p>
            <ul className="mt-1.5 space-y-1">
              {altre.map((v) => (
                <li key={v.chiave} className="text-xs leading-relaxed text-bob-ink/55">
                  <span className="font-medium text-bob-ink/75">{v.titolo}</span>{" "}
                  — {v.conseguenza}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={bloccante?.href ?? "/impostazioni/azienda"}
            onClick={onChiudi}
            className="btn-primary py-2.5"
            data-testid="promemoria-sistema"
          >
            {bloccante ? `Sistemalo adesso` : "Completa il profilo"}
          </Link>
          <button
            type="button"
            onClick={onChiudi}
            className="btn-ghost text-sm"
            data-testid="promemoria-piu-tardi"
          >
            Più tardi
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-bob-ink/40">
          Te lo ricordiamo una volta al giorno, e smettiamo da solo appena
          compari nelle ricerche. Lo stato completo è sempre in{" "}
          <Link
            href="/notifiche"
            onClick={onChiudi}
            className="font-medium text-bob-indigo hover:underline"
          >
            Notifiche
          </Link>
          .
        </p>
      </div>
    </>
  );
}
