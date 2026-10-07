"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { updateAppointment } from "@/lib/messages";
import { notifyEvent } from "@/lib/notify";
import type { Appointment } from "@/lib/supabase/types";
import { Key } from "lucide-react";
import {
  STATUS_CHIP,
  STATUS_LABEL,
  apptEnd,
  fmtDayLong,
  fmtDuration,
  fmtHour,
  mapsSearchUrl,
} from "@/lib/calendar";
import { AggiungiAlCalendario } from "@/components/AggiungiAlCalendario";
import { AnnullaAppuntamento } from "@/components/AnnullaAppuntamento";
import { SpostaAppuntamento } from "@/components/SpostaAppuntamento";
import { SegnalaRitardo } from "@/components/SegnalaRitardo";

/**
 * Pannello di dettaglio di un appuntamento.
 * Bottom sheet su mobile, cassetto laterale da sm in su.
 * Mostra solo dati già in possesso del professionista (nessun nuovo
 * trattamento di dati personali rispetto alla vista precedente).
 */
export function AppointmentDetail({
  appt,
  onClose,
  onEdit,
  onChanged,
}: {
  appt: Appointment;
  onClose: () => void;
  onEdit: (a: Appointment) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Blocca lo scroll della pagina sotto: su iOS Safari lo scroll che
    // "sfonda" nella pagina fa comparire/scomparire le toolbar del browser,
    // cambiando l'altezza del viewport e tagliando il fondo del pannello.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const start = new Date(appt.starts_at);
  const end = apptEnd(appt);
  const isPast = end < new Date();
  const mapsUrl = mapsSearchUrl(appt);
  // Confermato con un cliente e non ancora cominciato: si annulla solo dal
  // percorso con le regole (113), non con un cambio di stato secco.
  const annullabileConCliente =
    Boolean(appt.request_id) && appt.status === "confirmed" && start > new Date();
  const chat = appt.request_id
    ? `/messaggi?r=${appt.request_id}&p=${appt.professional_id}`
    : null;

  async function setStatus(status: Appointment["status"]) {
    setBusy(true);
    setError(null);
    const res = await updateAppointment(appt.id, { status });
    setBusy(false);
    if (res.error) {
      setError("Aggiornamento non riuscito. Riprova.");
      return;
    }
    // Il messaggio in chat al cliente lo scrive il database (107); questa e'
    // la copia per email, che parte solo quando la posta e' accesa.
    if (status === "cancelled" && appt.request_id) {
      notifyEvent("appointment_cancelled", {
        requestId: appt.request_id,
        professionalId: appt.professional_id,
        preview: `${fmtDayLong(start)}, ${fmtHour(start)}`,
      });
    }
    onChanged();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center bg-bob-ink/40 backdrop-blur-sm sm:items-stretch sm:justify-end"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full animate-fade-up overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-card-hover sm:max-h-none sm:w-[380px] sm:rounded-none sm:rounded-l-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Dettaglio appuntamento"
        data-testid="appointment-detail"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${
                STATUS_CHIP[appt.status]
              }`}
              data-testid="detail-status"
            >
              {STATUS_LABEL[appt.status]}
            </span>
            <h3 className="mt-2 break-words text-lg font-semibold text-bob-ink">
              {appt.title ?? "Appuntamento"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-bob-ink/65 hover:bg-black/5"
            aria-label="Chiudi"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Quando — cliccabile: apre «lo metto nel tuo calendario?» (05/09).
            Nell'elenco degli appuntamenti la riga e' gia' un bottone che apre
            questo pannello, e un bottone dentro un bottone non e' HTML
            valido: per il professionista la porta al calendario sta qui. */}
        <div className="rounded-xl bg-bob-indigo-50/60 px-3.5 py-3">
          <AggiungiAlCalendario
            appuntamento={appt}
            titoloVisibile={appt.title ?? undefined}
            className="no-underline"
          >
            <span className="block">
              <span className="block text-sm font-semibold capitalize text-bob-ink">
                {fmtDayLong(start)}
              </span>
              <span className="mt-0.5 block text-sm tabular-nums text-bob-indigo">
                {fmtHour(start)} – {fmtHour(end)}
                <span className="text-bob-ink/65">
                  {" "}
                  · {fmtDuration(appt.duration_minutes)}
                </span>
              </span>
            </span>
          </AggiungiAlCalendario>
        </div>

        {/* Dove */}
        <div className="mt-3 rounded-xl border border-black/[0.07] px-3.5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-bob-ink/65">
            Dove
          </p>
          {appt.location_address ? (
            <>
              <p className="mt-1 break-words text-sm font-medium text-bob-ink">
                {appt.location_address}
              </p>
              {appt.location_city && (
                <p className="text-sm text-bob-ink/70">{appt.location_city}</p>
              )}
              {appt.location_notes && (
                <p className="mt-1 flex items-start gap-1 break-words text-xs text-bob-ink/70">
                  <Key className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{appt.location_notes}</span>
                </p>
              )}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-bob-indigo hover:underline"
                  data-testid="detail-maps"
                >
                  Apri in Maps ↗
                </a>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-bob-ink/65">
              Nessun indirizzo. Aggiungilo con «Modifica» per vederlo nel giro
              del giorno.
            </p>
          )}
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Cliente" value={appt.customer_name} />
          {appt.price != null && (
            <Row
              label="Prezzo"
              value={`€ ${appt.price.toLocaleString("it-IT")}`}
            />
          )}
          <Row
            label="Origine"
            value={
              appt.source === "direct"
                ? "Prenotazione diretta online"
                : appt.proposed_by === "customer"
                  ? "Orario proposto dal cliente"
                  : "Inserito da te"
            }
          />
          {appt.notes && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-bob-ink/65">
                Note
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-bob-ink/80">
                {appt.notes}
              </dd>
            </div>
          )}
          {appt.booking_answers &&
            Object.keys(appt.booking_answers).length > 0 && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-bob-ink/65">
                  Dettagli della prenotazione
                </dt>
                <dd className="mt-1 space-y-1">
                  {Object.entries(appt.booking_answers).map(([k, v]) => (
                    <p key={k} className="break-words text-bob-ink/80">
                      <span className="text-bob-ink/65">{k}:</span> {String(v)}
                    </p>
                  ))}
                </dd>
              </div>
            )}
        </dl>

        {error && (
          <p className="mt-3 text-sm text-red-600" data-testid="detail-error">
            {error}
          </p>
        )}

        {/* Azioni */}
        <div className="mt-5 flex flex-col gap-2 border-t border-black/5 pt-4">
          {/* DAL CALENDARIO ALLA CHAT IN UN CLIC (05/10). La conversazione
              e' quella di questa richiesta con questo pro, non l'elenco. */}
          {chat && (
            <Link
              href={chat}
              className="btn-secondary w-full py-2 text-center text-sm"
              data-testid="detail-conversation"
            >
              Apri la chat con {appt.customer_name || "il cliente"}
            </Link>
          )}

          <button
            onClick={() => onEdit(appt)}
            className="btn-primary w-full py-2.5 text-sm"
            data-testid="detail-edit"
          >
            Modifica appuntamento
          </button>

          {/* Confermare spetta a chi NON ha proposto: su una proposta sua,
              legata a un cliente, il database la lascerebbe da confermare
              (107) e il bottone non farebbe niente. */}
          {appt.status === "proposed" &&
            (appt.proposed_by === "customer" || !appt.request_id) && (
            <button
              onClick={() => setStatus("confirmed")}
              disabled={busy}
              className="btn-secondary w-full py-2 text-center text-sm"
              data-testid="detail-confirm"
            >
              Conferma
            </button>
          )}

          {appt.status === "confirmed" && isPast && (
            <button
              onClick={() => setStatus("completed")}
              disabled={busy}
              className="btn-secondary w-full py-2 text-center text-sm"
              data-testid="detail-complete"
            >
              Segna come completato
            </button>
          )}

          {/* IL RITARDO E LO SPOSTAMENTO DEL PRO (116). «Sono in ritardo»
              compare solo oggi, finche' l'appuntamento non e' finito, e lo
              lascia confermato. «Sposta» segue la regola dell'annullamento:
              fuori dal preavviso il cliente riconferma, dentro si chiama. */}
          {appt.request_id && appt.status === "confirmed" && (
            <SegnalaRitardo
              appt={appt}
              nomeCliente={appt.customer_name || "il cliente"}
              onFatto={onChanged}
            />
          )}

          {annullabileConCliente && (
            <SpostaAppuntamento
              appt={appt}
              ruolo="professional"
              nomeAltro={appt.customer_name || "il cliente"}
              onSpostato={() => {
                onChanged();
                onClose();
              }}
            />
          )}

          {annullabileConCliente && (
            <AnnullaAppuntamento
              appt={appt}
              ruolo="professional"
              nomeAltro={appt.customer_name || "il cliente"}
              onAnnullato={() => {
                onChanged();
                onClose();
              }}
            />
          )}

          {/* Agenda privata, o una proposta da ritirare: un cambio di stato
              basta, e per le proposte il messaggio lo scrive il database
              (107). Su una proposta con un cliente il bottone dice cosa fa. */}
          {!annullabileConCliente &&
            !(appt.request_id && appt.status === "confirmed") &&
            appt.status !== "cancelled" &&
            appt.status !== "completed" &&
            appt.status !== "declined" && (
            <button
              onClick={() => setStatus("cancelled")}
              disabled={busy}
              className="btn-ghost w-full justify-center text-sm text-red-600 hover:bg-red-50"
              data-testid="detail-cancel"
            >
              {appt.request_id && appt.status === "proposed" && appt.proposed_by !== "customer"
                ? "Ritira la proposta"
                : appt.request_id && appt.status === "proposed"
                  ? "Rifiuta la proposta"
                  : "Annulla appuntamento"}
            </button>
          )}
          {appt.request_id && appt.status !== "cancelled" && appt.status !== "completed" && (
            <p className="text-center text-2xs text-bob-ink/65">
              Se lo sposti, {appt.customer_name || "il cliente"} lo legge subito
              nella vostra chat e lo riconferma. Un ritardo invece glielo dici
              e basta: l&apos;appuntamento resta confermato.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-bob-ink/65">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-right font-medium text-bob-ink">
        {value}
      </dd>
    </div>
  );
}
