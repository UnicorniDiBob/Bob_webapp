"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { updateAppointment } from "@/lib/messages";
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

  async function setStatus(status: Appointment["status"]) {
    setBusy(true);
    setError(null);
    const res = await updateAppointment(appt.id, { status });
    setBusy(false);
    if (res.error) {
      setError("Aggiornamento non riuscito. Riprova.");
      return;
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
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
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
            className="shrink-0 rounded-lg p-1.5 text-bob-ink/50 hover:bg-black/5"
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

        {/* Quando */}
        <div className="rounded-xl bg-bob-indigo-50/60 px-3.5 py-3">
          <p className="text-sm font-semibold capitalize text-bob-ink">
            {fmtDayLong(start)}
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-bob-indigo">
            {fmtHour(start)} – {fmtHour(end)}
            <span className="text-bob-ink/50">
              {" "}
              · {fmtDuration(appt.duration_minutes)}
            </span>
          </p>
        </div>

        {/* Dove */}
        <div className="mt-3 rounded-xl border border-black/[0.07] px-3.5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-bob-ink/45">
            Dove
          </p>
          {appt.location_address ? (
            <>
              <p className="mt-1 break-words text-sm font-medium text-bob-ink">
                {appt.location_address}
              </p>
              {appt.location_city && (
                <p className="text-sm text-bob-ink/60">{appt.location_city}</p>
              )}
              {appt.location_notes && (
                <p className="mt-1 flex items-start gap-1 break-words text-xs text-bob-ink/55">
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
            <p className="mt-1 text-sm text-bob-ink/50">
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
              <dt className="text-xs font-medium uppercase tracking-wide text-bob-ink/45">
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
                <dt className="text-xs font-medium uppercase tracking-wide text-bob-ink/45">
                  Dettagli della prenotazione
                </dt>
                <dd className="mt-1 space-y-1">
                  {Object.entries(appt.booking_answers).map(([k, v]) => (
                    <p key={k} className="break-words text-bob-ink/80">
                      <span className="text-bob-ink/50">{k}:</span> {String(v)}
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
          <button
            onClick={() => onEdit(appt)}
            className="btn-primary w-full py-2.5 text-sm"
            data-testid="detail-edit"
          >
            Modifica appuntamento
          </button>

          {appt.status === "proposed" && (
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

          {appt.request_id && (
            <Link
              href={`/messaggi?r=${appt.request_id}`}
              className="btn-secondary w-full py-2 text-center text-sm"
              data-testid="detail-conversation"
            >
              Vai alla conversazione
            </Link>
          )}

          {appt.status !== "cancelled" && appt.status !== "completed" && (
            <button
              onClick={() => setStatus("cancelled")}
              disabled={busy}
              className="btn-ghost w-full justify-center text-sm text-red-600 hover:bg-red-50"
              data-testid="detail-cancel"
            >
              Annulla appuntamento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-bob-ink/45">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-right font-medium text-bob-ink">
        {value}
      </dd>
    </div>
  );
}
