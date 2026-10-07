"use client";

// ANNULLARE UN APPUNTAMENTO CON UN CLIENTE, DA TUTTE E DUE LE PARTI (113).
//
// La regola (Lucio, 05/10): il preavviso lo decide il professionista (48 ore
// di base) ed e' fotografato sull'appuntamento alla conferma. Fuori dal
// preavviso si annulla da qui, e parte il messaggio standard nella chat di
// quella richiesta. Dentro, si chiama: il cliente vede il numero del pro; il
// pro vede quello del cliente e, DOPO la telefonata, registra l'annullamento
// dichiarando di averlo concordato — cosi' il cliente non resta con un
// appuntamento fantasma. Il motivo e' facoltativo per tutti e due (116: prima
// il pro doveva scriverlo sempre); quando c'e', l'altra parte lo legge in
// chat e resta nello storico.
//
// Il conto del preavviso qui serve a scegliere cosa mostrare. Decide il
// database (annulla_appuntamento), con l'ora del server: se nel frattempo il
// limite e' passato, l'errore che torna dice gia' cosa fare.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import { annullaAppuntamento, contattoControparte } from "@/lib/messages";
import {
  PREAVVISO_BASE_ORE,
  oreInParole,
  statoDisdetta,
} from "@/lib/disdettaPrenotazione";

export interface AppuntamentoAnnullabile {
  id: string;
  starts_at: string;
  status: string;
  request_id: string | null;
  professional_id: string;
  cancellation_window_hours?: number | null;
}

function quando(d: Date): string {
  return d.toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AnnullaAppuntamento({
  appt,
  ruolo,
  nomeAltro,
  onAnnullato,
  compatto = false,
}: {
  appt: AppuntamentoAnnullabile;
  ruolo: "professional" | "customer";
  /** Come chiamare l'altra parte: «Marco Rossi», «il cliente». */
  nomeAltro: string;
  onAnnullato: () => void;
  /** Bottone piccolo, per le righe di un elenco. */
  compatto?: boolean;
}) {
  const stato = statoDisdetta(appt);
  const [aperto, setAperto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [concordato, setConcordato] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [dentro, setDentro] = useState(stato.tipo === "scaduta");
  const [contatto, setContatto] = useState<{
    nome: string | null;
    telefono: string | null;
  } | null>(null);

  const ore = appt.cancellation_window_hours ?? PREAVVISO_BASE_ORE;
  const pro = ruolo === "professional";
  const chat = appt.request_id
    ? `/messaggi?r=${appt.request_id}&p=${appt.professional_id}`
    : null;

  // Il numero si chiede solo quando serve: dentro il preavviso, a pannello
  // aperto. E' un dato personale dell'altra parte, non da caricare per ogni
  // riga di un elenco.
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

  if (stato.tipo === "no") return null;

  async function conferma() {
    setBusy(true);
    setErrore(null);
    let esito: { ok: true } | { ok: false; motivo: string; messaggio: string };
    if (pro) {
      esito = await annullaAppuntamento(appt.id, {
        motivo,
        concordatoTelefono: dentro && concordato,
      });
    } else {
      // Il cliente passa dalla route: stessa funzione nel database, piu' la
      // copia per email al pro quando la posta sara' accesa.
      try {
        const r = await fetch(`/api/appointments/${appt.id}/disdici`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: motivo.trim() || null }),
        });
        const d = (await r.json().catch(() => ({}))) as {
          error?: string;
          motivo?: string;
        };
        esito = r.ok
          ? { ok: true }
          : {
              ok: false,
              motivo: d.motivo ?? "errore",
              messaggio: d.error ?? "Disdetta non riuscita. Riprova.",
            };
      } catch {
        esito = { ok: false, motivo: "errore", messaggio: "Disdetta non riuscita. Riprova." };
      }
    }
    setBusy(false);
    if (esito.ok) {
      setAperto(false);
      onAnnullato();
      return;
    }
    // Il limite e' passato mentre il pannello era aperto: si passa alla
    // telefonata invece di lasciare un errore e basta.
    if (esito.motivo === "chiama") setDentro(true);
    setErrore(esito.messaggio);
  }

  const etichetta = pro
    ? dentro
      ? "Annulla (dopo una telefonata)"
      : "Annulla appuntamento"
    : dentro
      ? "Chiama per annullare"
      : "Disdici";

  // IL TASTO DEL CLIENTE E' ROSSO (07/10): pieno, non bianco con la scritta
  // rossa. Accanto a «Cambia orario» deve leggersi da lontano qual e' quello
  // che toglie l'appuntamento. La variante e' una sola (.btn-danger).
  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className={
          pro
            ? compatto
              ? "inline-flex min-h-[40px] items-center text-xs font-medium text-red-600 hover:underline"
              : "btn-ghost min-h-[44px] w-full justify-center text-sm text-red-600 hover:bg-red-50"
            : compatto
              ? "btn-danger min-h-[40px] px-3 py-1.5 text-xs"
              : "btn-danger min-h-[44px] w-full py-2.5"
        }
        data-testid={`annulla-apri-${appt.id}`}
      >
        {etichetta}
      </button>
    );
  }

  return (
    <div
      className="w-full rounded-xl border border-red-200 bg-red-50/40 p-3 text-left text-sm"
      data-testid={`annulla-pannello-${appt.id}`}
    >
      {dentro ? (
        <>
          <p className="text-bob-ink/80">
            Mancano meno di {oreInParole(ore)} all&apos;appuntamento: per
            annullarlo chiama {nomeAltro}.
          </p>
          {contatto === null ? (
            <p className="mt-2 text-xs text-bob-ink/65">Cerco il numero…</p>
          ) : contatto.telefono ? (
            <a
              href={`tel:${contatto.telefono.replace(/\s+/g, "")}`}
              className="btn-secondary mt-2 inline-flex items-center gap-1.5 py-2 text-sm"
              data-testid="annulla-telefono"
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
          {pro ? (
            <label className="mt-3 flex items-start gap-2 text-xs text-bob-ink/80">
              <input
                type="checkbox"
                checked={concordato}
                onChange={(e) => setConcordato(e.target.checked)}
                className="mt-0.5"
                data-testid="annulla-concordato"
              />
              Ho parlato con {nomeAltro} e abbiamo deciso di annullare.
            </label>
          ) : (
            <p className="mt-3 text-xs text-bob-ink/65">
              Dopo la telefonata l&apos;annullamento lo registra il
              professionista, e lo trovi qui e in chat.
            </p>
          )}
        </>
      ) : (
        <p className="text-bob-ink/80">
          {pro ? "Puoi annullarlo" : "Puoi disdire"} da qui fino a{" "}
          {quando(stato.finoA)}. {nomeAltro} lo
          legge subito nella vostra chat.
        </p>
      )}

      {(pro || !dentro) && (
        <div className="mt-3">
          <label className="label-bob" htmlFor={`motivo-${appt.id}`}>
            {pro ? "Motivo (facoltativo, lo legge in chat)" : "Motivo (facoltativo)"}
          </label>
          <textarea
            id={`motivo-${appt.id}`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
            rows={2}
            className="input-bob resize-none"
            placeholder={pro ? "Es. imprevisto, sono malato" : "Es. ho risolto da solo"}
            data-testid="annulla-motivo"
          />
        </div>
      )}

      {errore && (
        <p className="mt-2 text-xs text-red-600" data-testid="annulla-errore">
          {errore}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(pro || !dentro) && (
          <button
            onClick={conferma}
            disabled={busy || (pro && dentro && !concordato)}
            className="btn-danger min-h-[44px] px-4 py-2"
            data-testid="annulla-conferma"
          >
            {busy
              ? "Annullo…"
              : pro
                ? dentro
                  ? "Registra l'annullamento"
                  : `Annulla e avvisa ${nomeAltro}`
                : "Disdici e avvisa il professionista"}
          </button>
        )}
        <button
          onClick={() => {
            setAperto(false);
            setErrore(null);
          }}
          className="inline-flex min-h-[40px] items-center px-2 text-xs font-medium text-bob-ink/65 hover:underline"
        >
          Lascia stare
        </button>
      </div>
    </div>
  );
}
