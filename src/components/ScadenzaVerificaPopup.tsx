"use client";

// LA FINESTRA DELL'ULTIMA SETTIMANA (12/09, scelta di Lucio).
//
// La verifica dura un anno. Il preavviso e' a due tempi, e i due tempi sono
// due posti diversi apposta:
//
//  - a 30 giorni, una NOTIFICA nella campanella. C'e' tempo, non serve
//    mettersi davanti a nessuno: lo dici dove si leggono le cose da fare.
//  - nell'ultima settimana lavorativa, QUESTA FINESTRA. Qui la posta in gioco
//    cambia: alla scadenza il profilo torna «Iscritto», cioe' perde
//    l'etichetta che i clienti guardano per prima. Una cosa che toglie
//    qualcosa va detta in faccia una volta, non lasciata in una lista.
//
// UNA VOLTA SOLA, E PER ACCOUNT. Lo stato «vista» sta su
// profiles.scadenza_verifica_vista_al (migrazione 078) e non in localStorage,
// altrimenti la stessa finestra ricompare su telefono, portatile e tablet.
// Contiene la DATA DI SCADENZA per cui e' stata chiusa: se la verifica si
// rinnova il valore non coincide piu' e la finestra torna disponibile da sola,
// senza nessun campo da azzerare a mano.
//
// NON BLOCCA. Si chiude col bottone, con Esc e cliccando fuori, e la stessa
// cosa resta nella campanella. Una finestra che non si puo' chiudere e' una
// pagina di errore.
//
// VALE ANCHE PER IL RICONTROLLO (14/09, Lucio). Fino a oggi qui si guardava
// solo `vat_expires_at`: su una cessazione — che apre un caso subito e spegne
// l'etichetta alla fine della finestra, mesi prima della scadenza annuale —
// questa finestra non si apriva mai, e l'unico preavviso di una restrizione
// era una notifica senza data. Adesso la data e' la stessa che spegne il
// badge, `scadenzaBadge()`, cioe' la prima fra le due: un posto solo (mig 080,
// Reg. P2B art. 4). `scadenza_verifica_vista_al` conserva QUELLA data, quindi
// se il caso si chiude o la scadenza si sposta la finestra torna da sola.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { scadenzaBadge, statoScadenza, type StatoScadenza } from "@/lib/vat";

const GIORNO = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Rome",
});

export function ScadenzaVerificaPopup({
  professionalId,
}: {
  professionalId: string;
}) {
  const supabase = createClient();
  const { user, loading } = useAuth();
  const [stato, setStato] = useState<StatoScadenza | null>(null);
  const [scadenza, setScadenza] = useState<string | null>(null);
  const [daRicontrollo, setDaRicontrollo] = useState(false);
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    if (loading || !user || !professionalId) return;
    let vivo = true;

    (async () => {
      const [verifica, profilo] = await Promise.all([
        supabase
          .from("professional_verification")
          .select("level, vat_expires_at, recheck_opened_at")
          .eq("professional_id", professionalId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("scadenza_verifica_vista_al")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (!vivo) return;

      const riga = verifica.data as {
        level: string | null;
        vat_expires_at: string | null;
        recheck_opened_at: string | null;
      } | null;
      if (!riga || riga.level === "none") return;

      const spegneIl = scadenzaBadge(
        riga.vat_expires_at,
        riga.recheck_opened_at
      );
      if (!spegneIl) return;

      const s = statoScadenza(spegneIl);
      if (!s) return;
      if (s.fase !== "ultima-settimana" && s.fase !== "scaduta") return;

      const vistaAl =
        (profilo.data as { scadenza_verifica_vista_al: string | null } | null)
          ?.scadenza_verifica_vista_al ?? null;
      // Gia' chiusa per QUESTA scadenza: si confrontano gli istanti, non le
      // stringhe, perche' il database puo' restituire lo stesso momento con
      // una formattazione diversa da quella che abbiamo scritto noi.
      if (
        vistaAl &&
        new Date(vistaAl).getTime() === new Date(spegneIl).getTime()
      ) {
        return;
      }

      setScadenza(spegneIl);
      setDaRicontrollo(riga.recheck_opened_at != null);
      setStato(s);
      setAperto(true);
    })();

    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, professionalId]);

  const chiudi = useCallback(async () => {
    setAperto(false);
    if (!user || !scadenza) return;
    // Se la scrittura fallisce la finestra torna al prossimo accesso:
    // fastidioso, non rotto.
    await supabase
      .from("profiles")
      .update({ scadenza_verifica_vista_al: scadenza })
      .eq("user_id", user.id);
  }, [scadenza, supabase, user]);

  useEffect(() => {
    if (!aperto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void chiudi();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aperto, chiudi]);

  if (!aperto || !stato) return null;

  const scaduta = stato.fase === "scaduta";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-bob-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={daRicontrollo ? "Ricontrollo della verifica" : "Scadenza della verifica"}
      onClick={() => void chiudi()}
    >
      <div
        className="w-full max-w-md animate-fade-up rounded-t-2xl bg-white p-5 shadow-card-hover sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="scadenza-verifica-popup"
        data-fase={stato.fase}
      >
        <p className="flex items-start gap-2 text-base font-bold text-bob-ink">
          <ShieldAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <span className="min-w-0">
            {daRicontrollo
              ? scaduta
                ? "I clienti non vedono più la tua etichetta"
                : stato.giorniLavorativi <= 1
                  ? "Da domani i clienti non vedono più la tua etichetta"
                  : `Fra ${stato.giorniLavorativi} giorni lavorativi i clienti non vedono più la tua etichetta`
              : scaduta
                ? "La tua verifica è scaduta"
                : stato.giorniLavorativi <= 1
                  ? "La tua verifica scade domani"
                  : `La tua verifica scade fra ${stato.giorniLavorativi} giorni lavorativi`}
          </span>
        </p>

        <p className="mt-2.5 text-sm leading-relaxed text-bob-ink/75">
          {daRicontrollo
            ? scaduta
              ? `C'è un ricontrollo aperto sulla tua partita IVA e la finestra si è chiusa il ${GIORNO.format(stato.scadeIl)}: per i clienti il profilo torna «Iscritto». Il livello non è perso — non lo toglie nessun automatismo — e l'etichetta riappare da sola appena il controllo passa.`
              : `C'è un ricontrollo aperto sulla tua partita IVA. L'etichetta resta visibile fino al ${GIORNO.format(stato.scadeIl)}: se il caso non si chiude prima, dopo quel giorno il profilo torna «Iscritto» per i clienti. Il livello non si perde e torna da solo appena il controllo passa.`
            : scaduta
              ? `Era valida fino al ${GIORNO.format(stato.scadeIl)}. Finché non rifacciamo il controllo, il tuo profilo vale come non verificato: i clienti non vedono più l'etichetta e la data del riscontro.`
              : `Vale fino al ${GIORNO.format(stato.scadeIl)}. Dopo quella data il profilo torna «Iscritto», cioè non verificato: i clienti smettono di vedere l'etichetta che guardano per prima.`}
        </p>

        <p className="mt-2 text-sm leading-relaxed text-bob-ink/60">
          Il ricontrollo lo facciamo noi e, nella maggior parte dei casi, non ti
          chiediamo niente. Se ci serve un documento te lo scriviamo qui e nella
          campanella. Nessuno ti toglie niente senza dirtelo prima.
        </p>

        <Link
          href="/impostazioni/verifica"
          onClick={() => void chiudi()}
          className="btn-primary mt-4 w-full py-2.5"
          data-testid="scadenza-verifica-vai"
        >
          Vedi la tua verifica
        </Link>
        <button
          type="button"
          onClick={() => void chiudi()}
          className="mt-2 w-full py-2 text-sm font-medium text-bob-ink/55 hover:text-bob-ink"
          data-testid="scadenza-verifica-chiudi"
        >
          Ho capito
        </button>
      </div>
    </div>
  );
}
