"use client";

// IL CLIENTE CAMBIA ORARIO A UN APPUNTAMENTO CONFERMATO (115).
//
// La regola e' quella della disdetta (113, decisa con Lucio): il preavviso
// lo decide il professionista ed e' fotografato alla conferma. Fuori dal
// preavviso il cliente sceglie un orario libero e l'appuntamento torna «da
// confermare»: il pro lo conferma, e se non puo' resta l'orario di prima
// (lo rimette il database). Dentro il preavviso si chiama, come per
// annullare. Lo stesso conto di AnnullaAppuntamento (statoDisdetta), cosi'
// i due bottoni compaiono e spariscono insieme.
//
// Decide il database (sposta_appuntamento), con l'ora del server: se nel
// frattempo il limite e' passato, l'errore che torna dice gia' cosa fare.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import { contattoControparte } from "@/lib/messages";
import {
  PREAVVISO_BASE_ORE,
  oreInParole,
  statoDisdetta,
} from "@/lib/disdettaPrenotazione";
import type { AppuntamentoAnnullabile } from "@/components/AnnullaAppuntamento";
import { SceltaOrario } from "@/components/SceltaOrario";

export interface AppuntamentoSpostabile extends AppuntamentoAnnullabile {
  duration_minutes: number;
}

export function SpostaAppuntamento({
  appt,
  nomeAltro,
  onSpostato,
  compatto = false,
}: {
  appt: AppuntamentoSpostabile;
  /** Come chiamare il professionista: «Milano Clean Squad». */
  nomeAltro: string;
  onSpostato: () => void;
  /** Bottone piccolo, per le righe di un elenco. */
  compatto?: boolean;
}) {
  const stato = statoDisdetta(appt);
  const [scelta, setScelta] = useState(false);
  const [pannello, setPannello] = useState(false);
  const [dentro, setDentro] = useState(stato.tipo === "scaduta");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [contatto, setContatto] = useState<{
    nome: string | null;
    telefono: string | null;
  } | null>(null);

  const ore = appt.cancellation_window_hours ?? PREAVVISO_BASE_ORE;
  const chat = appt.request_id
    ? `/messaggi?r=${appt.request_id}&p=${appt.professional_id}`
    : null;

  // Il numero si chiede solo a pannello aperto, dentro il preavviso: e' un
  // dato personale dell'altra parte (stessa regola di AnnullaAppuntamento).
  useEffect(() => {
    if (!pannello || !dentro || contatto) return;
    let vivo = true;
    contattoControparte(appt.id).then((c) => {
      if (vivo) setContatto(c ?? { nome: null, telefono: null });
    });
    return () => {
      vivo = false;
    };
  }, [pannello, dentro, contatto, appt.id]);

  if (stato.tipo === "no") return null;

  async function sposta(slotIso: string) {
    if (busy) return;
    setBusy(true);
    setErrore(null);
    try {
      const r = await fetch(`/api/appointments/${appt.id}/sposta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inizio: slotIso }),
      });
      const d = (await r.json().catch(() => ({}))) as {
        error?: string;
        motivo?: string;
      };
      setBusy(false);
      if (r.ok) {
        setScelta(false);
        onSpostato();
        return;
      }
      // Il limite e' passato mentre sceglieva: si passa alla telefonata.
      if (d.motivo === "chiama") {
        setScelta(false);
        setDentro(true);
        setPannello(true);
        return;
      }
      setErrore(d.error ?? "Spostamento non riuscito. Riprova.");
    } catch {
      setBusy(false);
      setErrore("Spostamento non riuscito. Riprova.");
    }
  }

  const etichetta = dentro ? "Chiama per spostare" : "Cambia orario";

  return (
    <>
      {!pannello && (
        <button
          onClick={() => {
            setErrore(null);
            if (dentro) setPannello(true);
            else setScelta(true);
          }}
          className={
            compatto
              ? "inline-flex min-h-[40px] items-center text-xs font-medium text-bob-indigo hover:underline"
              : "btn-ghost w-full justify-center text-sm text-bob-indigo hover:bg-bob-indigo-50"
          }
          data-testid={`sposta-apri-${appt.id}`}
        >
          {etichetta}
        </button>
      )}

      {pannello && (
        <div
          className="w-full rounded-xl border border-bob-indigo/20 bg-bob-indigo-50/40 p-3 text-left text-sm"
          data-testid={`sposta-pannello-${appt.id}`}
        >
          <p className="text-bob-ink/80">
            Mancano meno di {oreInParole(ore)} all&apos;appuntamento: per
            spostarlo chiama {nomeAltro}.
          </p>
          {contatto === null ? (
            <p className="mt-2 text-xs text-bob-ink/65">Cerco il numero…</p>
          ) : contatto.telefono ? (
            <a
              href={`tel:${contatto.telefono.replace(/\s+/g, "")}`}
              className="btn-secondary mt-2 inline-flex items-center gap-1.5 py-2 text-sm"
              data-testid="sposta-telefono"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {contatto.telefono}
            </a>
          ) : (
            <p className="mt-2 text-xs text-bob-ink/70">
              {nomeAltro} non ha lasciato un numero: scrivigli in chat.
            </p>
          )}
          {chat && (
            <Link
              href={chat}
              className="mt-1 flex min-h-[40px] items-center text-xs font-semibold text-bob-indigo hover:underline"
            >
              Apri la chat →
            </Link>
          )}
          <button
            onClick={() => setPannello(false)}
            className="mt-1 inline-flex min-h-[40px] items-center px-2 text-xs font-medium text-bob-ink/65 hover:underline"
          >
            Lascia stare
          </button>
        </div>
      )}

      {scelta && (
        <SceltaOrario
          professionalId={appt.professional_id}
          durataMinuti={appt.duration_minutes}
          nomePro={nomeAltro}
          titolo="Cambia orario"
          testo={
            <>
              Questi sono gli orari liberi di {nomeAltro} nei prossimi giorni.
              Scegline uno: {nomeAltro} lo conferma, e se non può resta
              l&apos;orario di adesso.
            </>
          }
          busy={busy}
          errore={errore}
          onScegli={sposta}
          onChiudi={() => {
            setScelta(false);
            setErrore(null);
          }}
        />
      )}
    </>
  );
}
