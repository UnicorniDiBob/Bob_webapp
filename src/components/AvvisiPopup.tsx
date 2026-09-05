"use client";

// LA FINESTRA DEGLI AVVISI — una volta sola, al primo accesso dopo l'avviso.
//
// PERCHE' UNA FINESTRA E NON UNA FASCIA. Una fascia in cima alla pagina si
// impara a non vedere nel giro di un giorno: e' la stessa ragione per cui le
// notifiche di servizio sono nate: quattro fasce sparse che nessuno leggeva.
// Un avviso di servizio pero' ha una fretta che le altre notifiche non hanno —
// «fra due ore il sito si ferma» va letto adesso, non quando passi dalla
// campanella. Quindi si mette davanti una volta, e poi si comporta come tutte
// le altre.
//
// UNA VOLTA SOLA VUOL DIRE PER ACCOUNT, NON PER BROWSER. Lo stato «letto»
// delle notifiche vive in localStorage e va benissimo per un pallino; qui
// significherebbe la stessa finestra in faccia su telefono, portatile e
// tablet. Sta su profiles.avvisi_visti_al — vedi la migrazione 071.
//
// COSA NON FA: non blocca. Si chiude con il bottone, con Esc e cliccando
// fuori, e l'avviso resta comunque fra le notifiche. Una finestra che non si
// puo' chiudere e' una pagina di errore, e noi qui stiamo solo parlando.

import { useCallback, useEffect, useState } from "react";
import { Info, AlertTriangle, OctagonAlert, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import {
  daMostrare,
  leggiAvvisiInCorso,
  segnaFinoA,
  type AvvisoServizio,
  type LivelloAvviso,
} from "@/lib/avvisi";

const STILE: Record<
  LivelloAvviso,
  { icona: LucideIcon; tinta: string; sfondo: string; bordo: string }
> = {
  informazione: {
    icona: Info,
    tinta: "text-bob-indigo",
    sfondo: "bg-bob-indigo-50",
    bordo: "border-bob-indigo/20",
  },
  attenzione: {
    icona: AlertTriangle,
    tinta: "text-amber-600",
    sfondo: "bg-amber-50",
    bordo: "border-amber-200",
  },
  disservizio: {
    icona: OctagonAlert,
    tinta: "text-red-600",
    sfondo: "bg-red-50",
    bordo: "border-red-200",
  },
};

function finestraLeggibile(a: AvvisoServizio): string | null {
  const fine = new Date(a.fine_il);
  if (isNaN(fine.getTime())) return null;
  return `Fino al ${fine.toLocaleString("it-IT", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function AvvisiPopup() {
  const supabase = createClient();
  const { user, loading } = useAuth();
  const [daVedere, setDaVedere] = useState<AvvisoServizio[]>([]);
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let vivo = true;

    (async () => {
      const [avvisi, { data: profilo }] = await Promise.all([
        leggiAvvisiInCorso(supabase),
        supabase
          .from("profiles")
          .select("avvisi_visti_al")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (!vivo || avvisi.length === 0) return;

      const vistiAl =
        (profilo as { avvisi_visti_al: string | null } | null)
          ?.avvisi_visti_al ?? null;
      const nuovi = daMostrare(avvisi, vistiAl);
      if (nuovi.length === 0) return;

      setDaVedere(nuovi);
      setAperto(true);
    })();

    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  const chiudi = useCallback(async () => {
    setAperto(false);
    const fino = segnaFinoA(daVedere);
    if (!user || !fino) return;
    // Se questa scrittura fallisce la finestra si ripresenta al prossimo
    // accesso: fastidioso, non rotto. Non vale la pena tenere aperta una
    // finestra che la persona ha appena chiuso per dirglielo.
    await supabase
      .from("profiles")
      .update({ avvisi_visti_al: fino })
      .eq("user_id", user.id);
  }, [daVedere, supabase, user]);

  useEffect(() => {
    if (!aperto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void chiudi();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aperto, chiudi]);

  if (!aperto || daVedere.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-bob-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Avvisi di servizio"
      onClick={() => void chiudi()}
    >
      <div
        className="max-h-[85dvh] w-full max-w-md animate-fade-up overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-card-hover sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="avvisi-popup"
      >
        <p className="section-eyebrow">
          {daVedere.length === 1 ? "Un avviso per te" : "Avvisi per te"}
        </p>

        <div className="mt-3 flex flex-col gap-3">
          {daVedere.map((a) => {
            const s = STILE[a.livello] ?? STILE.informazione;
            const Icona = s.icona;
            const quando = finestraLeggibile(a);
            return (
              <div
                key={a.id}
                className={`rounded-xl border ${s.bordo} ${s.sfondo} p-3.5`}
                data-testid={`avviso-${a.id}`}
              >
                <p className="flex items-start gap-2 text-sm font-semibold text-bob-ink">
                  <Icona
                    className={`mt-0.5 h-4 w-4 shrink-0 ${s.tinta}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">{a.titolo}</span>
                </p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-bob-ink/75">
                  {a.testo}
                </p>
                {quando && (
                  <p className="mt-2 text-xs text-bob-ink/45">{quando}</p>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void chiudi()}
          className="btn-primary mt-4 w-full py-2.5"
          data-testid="avvisi-popup-chiudi"
        >
          Ho capito
        </button>
        <p className="mt-2 text-center text-xs text-bob-ink/45">
          {daVedere.length === 1 ? "Lo ritrovi" : "Li ritrovi"} nella campanella
          in alto, finché {daVedere.length === 1 ? "vale" : "valgono"}.
        </p>
      </div>
    </div>
  );
}
