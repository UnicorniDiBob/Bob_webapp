"use client";

// SPOSTARE UN APPUNTAMENTO CONFERMATO, DA TUTTE E DUE LE PARTI (115, 116).
//
// La regola e' quella della disdetta (113, decisa con Lucio): il preavviso
// lo decide il professionista ed e' fotografato alla conferma. Lo stesso
// conto di AnnullaAppuntamento (statoDisdetta), cosi' i bottoni compaiono e
// spariscono insieme.
//
// IL CLIENTE (115). Fuori dal preavviso sceglie un orario libero e
// l'appuntamento torna «da confermare»: il pro lo conferma, e se non puo'
// resta l'orario di prima (lo rimette il database). Dentro il preavviso si
// chiama.
//
// IL PRO (116). Fuori dal preavviso sceglie l'orario che vuole e il cliente
// lo riconferma in chat, come uno spostamento dal calendario. Dentro il
// preavviso «Chiama per spostare»: dopo la telefonata registra lo
// spostamento dichiarando di averlo concordato, e allora resta confermato —
// il cliente ha gia' detto si' a voce. Il pro puo' sovrapporsi a un altro
// appuntamento: lo avvisa AvvisoSovrapposizione, non lo ferma nessuno.
//
// Decide il database (sposta_appuntamento), con l'ora del server: se nel
// frattempo il limite e' passato, l'errore che torna dice gia' cosa fare.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import {
  appuntamentiDelPro,
  contattoControparte,
  spostaAppuntamentoPro,
} from "@/lib/messages";
import { conChiSiSovrappone } from "@/lib/slots";
import {
  PREAVVISO_BASE_ORE,
  oreInParole,
  statoDisdetta,
} from "@/lib/disdettaPrenotazione";
import type { AppuntamentoAnnullabile } from "@/components/AnnullaAppuntamento";
import { SceltaOrario } from "@/components/SceltaOrario";
import {
  AvvisoSovrapposizione,
  useAvvisoSovrapposizione,
  type Sovrapposto,
} from "@/components/AvvisoSovrapposizione";

export interface AppuntamentoSpostabile extends AppuntamentoAnnullabile {
  duration_minutes: number;
}

export function SpostaAppuntamento({
  appt,
  nomeAltro,
  onSpostato,
  compatto = false,
  ruolo = "customer",
}: {
  appt: AppuntamentoSpostabile;
  /** Come chiamare l'altra parte: «Milano Clean Squad», «Marco Rossi». */
  nomeAltro: string;
  onSpostato: () => void;
  /** Bottone piccolo, per le righe di un elenco. */
  compatto?: boolean;
  /** Chi sposta. Il pro ha una strada sua (116), con le stesse regole. */
  ruolo?: "customer" | "professional";
}) {
  if (ruolo === "professional") {
    return <SpostaPro appt={appt} nomeAltro={nomeAltro} onSpostato={onSpostato} />;
  }
  return (
    <SpostaCliente
      appt={appt}
      nomeAltro={nomeAltro}
      onSpostato={onSpostato}
      compatto={compatto}
    />
  );
}

function SpostaCliente({
  appt,
  nomeAltro,
  onSpostato,
  compatto,
}: {
  appt: AppuntamentoSpostabile;
  nomeAltro: string;
  onSpostato: () => void;
  compatto: boolean;
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

/** Il valore di un <input type="datetime-local">, nell'ora del browser. */
function versoCampo(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function SpostaPro({
  appt,
  nomeAltro,
  onSpostato,
}: {
  appt: AppuntamentoSpostabile;
  nomeAltro: string;
  onSpostato: () => void;
}) {
  const stato = statoDisdetta(appt);
  const [aperto, setAperto] = useState(false);
  const [dentro, setDentro] = useState(stato.tipo === "scaduta");
  const [quando, setQuando] = useState(() => versoCampo(appt.starts_at));
  const [motivo, setMotivo] = useState("");
  const [concordato, setConcordato] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [contatto, setContatto] = useState<{
    nome: string | null;
    telefono: string | null;
  } | null>(null);
  const [vicini, setVicini] = useState<(Sovrapposto & { status: string })[]>([]);
  const avviso = useAvvisoSovrapposizione(aperto ? appt.professional_id : null);

  const ore = appt.cancellation_window_hours ?? PREAVVISO_BASE_ORE;
  const chat = appt.request_id
    ? `/messaggi?r=${appt.request_id}&p=${appt.professional_id}`
    : null;
  const inizio = useMemo(() => new Date(quando), [quando]);
  const valido = !isNaN(inizio.getTime()) && inizio.getTime() > Date.now();
  const uguale = valido && inizio.getTime() === new Date(appt.starts_at).getTime();

  // Il numero del cliente si chiede solo dentro il preavviso, a pannello
  // aperto (stessa regola di AnnullaAppuntamento).
  useEffect(() => {
    if (!aperto || !dentro || contatto) return;
    let vivo = true;
    contattoControparte(appt.id).then((c) => {
      if (vivo) setContatto(c ?? { nome: null, telefono: null });
    });
    return () => {
      vivo = false;
    };
  }, [aperto, dentro, contatto, appt.id]);

  // Gli altri appuntamenti della giornata scelta, per dire «si sovrappone a».
  useEffect(() => {
    if (!aperto || !valido) {
      setVicini([]);
      return;
    }
    let vivo = true;
    const dal = new Date(inizio);
    dal.setHours(0, 0, 0, 0);
    const al = new Date(dal.getTime() + 24 * 3600 * 1000);
    appuntamentiDelPro(appt.professional_id, dal, al).then((righe) => {
      if (vivo) setVicini(righe);
    });
    return () => {
      vivo = false;
    };
  }, [aperto, valido, inizio, appt.professional_id]);

  if (stato.tipo === "no") return null;

  const conflitti = valido
    ? conChiSiSovrappone(inizio, appt.duration_minutes, vicini, appt.id)
    : [];

  async function salva() {
    if (!valido || uguale || busy) return;
    setBusy(true);
    setErrore(null);
    const r = await spostaAppuntamentoPro(appt.id, inizio, {
      motivo,
      concordatoTelefono: dentro && concordato,
    });
    setBusy(false);
    if (r.ok) {
      setAperto(false);
      onSpostato();
      return;
    }
    // Il limite e' passato mentre il pannello era aperto: si passa alla
    // telefonata invece di lasciare un errore e basta.
    if (r.motivo === "chiama") setDentro(true);
    setErrore(r.messaggio);
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="btn-ghost min-h-[44px] w-full justify-center text-sm text-bob-indigo hover:bg-bob-indigo-50"
        data-testid={`sposta-apri-${appt.id}`}
      >
        {dentro ? "Chiama per spostare" : "Sposta"}
      </button>
    );
  }

  return (
    <div
      className="w-full rounded-xl border border-bob-indigo/20 bg-bob-indigo-50/40 p-3 text-left text-sm"
      data-testid={`sposta-pannello-${appt.id}`}
    >
      {dentro ? (
        <>
          <p className="text-bob-ink/80">
            Mancano meno di {oreInParole(ore)} all&apos;appuntamento: per
            spostarlo chiama {nomeAltro}, poi registra qui l&apos;orario che
            avete deciso.
          </p>
          {contatto === null ? (
            <p className="mt-2 text-xs text-bob-ink/65">Cerco il numero…</p>
          ) : contatto.telefono ? (
            <a
              href={`tel:${contatto.telefono.replace(/\s+/g, "")}`}
              className="btn-secondary mt-2 inline-flex min-h-[44px] items-center gap-1.5 py-2 text-sm"
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
              className="mt-1 flex min-h-[44px] items-center text-xs font-semibold text-bob-indigo hover:underline"
            >
              Apri la chat →
            </Link>
          )}
        </>
      ) : (
        <p className="text-bob-ink/80">
          {nomeAltro} riceve il nuovo orario in chat e lo riconferma.
        </p>
      )}

      <div className="mt-3">
        <label className="label-bob" htmlFor={`sposta-quando-${appt.id}`}>
          Nuovo orario
        </label>
        <input
          id={`sposta-quando-${appt.id}`}
          type="datetime-local"
          value={quando}
          onChange={(e) => setQuando(e.target.value)}
          className="input-bob min-h-[44px] px-3"
          data-testid="sposta-quando"
        />
      </div>

      {avviso.mostra && conflitti.length > 0 && (
        <div className="mt-2">
          <AvvisoSovrapposizione conflitti={conflitti} onSpegni={avviso.spegni} />
        </div>
      )}

      <div className="mt-3">
        <label className="label-bob" htmlFor={`sposta-motivo-${appt.id}`}>
          Motivo (facoltativo, lo legge in chat)
        </label>
        <textarea
          id={`sposta-motivo-${appt.id}`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
          rows={2}
          className="input-bob resize-none"
          data-testid="sposta-motivo"
        />
      </div>

      {dentro && (
        <label className="mt-3 flex min-h-[44px] items-start gap-2 text-xs text-bob-ink/80">
          <input
            type="checkbox"
            checked={concordato}
            onChange={(e) => setConcordato(e.target.checked)}
            className="mt-0.5"
            data-testid="sposta-concordato"
          />
          Ho parlato con {nomeAltro} e abbiamo concordato il nuovo orario.
        </label>
      )}

      {errore && (
        <p className="mt-2 text-xs text-red-600" data-testid="sposta-errore">
          {errore}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={salva}
          disabled={busy || !valido || uguale || (dentro && !concordato)}
          className="btn-primary min-h-[44px] px-4 py-2 text-sm disabled:opacity-50"
          data-testid="sposta-conferma"
        >
          {busy
            ? "Sposto…"
            : dentro
              ? "Registra lo spostamento"
              : `Proponi il nuovo orario a ${nomeAltro}`}
        </button>
        <button
          onClick={() => {
            setAperto(false);
            setErrore(null);
          }}
          className="inline-flex min-h-[44px] items-center px-2 text-xs font-medium text-bob-ink/65 hover:underline"
        >
          Lascia stare
        </button>
      </div>
    </div>
  );
}
