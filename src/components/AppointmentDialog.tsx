"use client";

import { useEffect, useState } from "react";
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  type NewAppointment,
} from "@/lib/messages";
import type { Appointment } from "@/lib/supabase/types";

// Converte una data ISO in valore per <input type="datetime-local">.
function toLocalInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export function AppointmentDialog({
  professionalId,
  existing,
  defaultDate,
  onClose,
  onSaved,
}: {
  professionalId: string;
  existing?: Appointment | null;
  defaultDate?: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerName, setCustomerName] = useState(existing?.customer_name ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [startsAt, setStartsAt] = useState(
    toLocalInput(existing?.starts_at ?? defaultDate?.toISOString())
  );
  const [duration, setDuration] = useState(existing?.duration_minutes ?? 60);
  const [price, setPrice] = useState<string>(
    existing?.price != null ? String(existing.price) : ""
  );
  const [status, setStatus] = useState<Appointment["status"]>(
    existing?.status ?? "confirmed"
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  // Luogo del lavoro (031). Non precompilato dagli indirizzi salvati del
  // cliente: il pro non ha accesso a customer_addresses e non gliene diamo uno
  // nuovo qui (disclosure progressiva, DATA_COMPLIANCE §4). Nelle prenotazioni
  // dirette l'indirizzo arriva dal cliente stesso al momento della prenotazione.
  const [locAddress, setLocAddress] = useState(existing?.location_address ?? "");
  const [locCity, setLocCity] = useState(existing?.location_city ?? "");
  const [locNotes, setLocNotes] = useState(existing?.location_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleSave() {
    if (customerName.trim().length < 2) {
      setError("Inserisci il nome del cliente.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: NewAppointment = {
      customer_name: customerName.trim(),
      title: title.trim() || null,
      starts_at: new Date(startsAt).toISOString(),
      duration_minutes: Number(duration) || 60,
      price: price.trim() === "" ? null : Number(price),
      status,
      notes: notes.trim() || null,
      location_address: locAddress.trim().slice(0, 200) || null,
      location_city: locCity.trim().slice(0, 80) || null,
      location_notes: locNotes.trim().slice(0, 300) || null,
    };

    const res = existing
      ? await updateAppointment(existing.id, payload)
      : await createAppointment(professionalId, payload);

    setSaving(false);
    if (res.error) {
      setError("Salvataggio non riuscito. Riprova.");
      return;
    }
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!existing) return;
    setSaving(true);
    const res = await deleteAppointment(existing.id);
    setSaving(false);
    if (res.error) {
      setError("Eliminazione non riuscita.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bob-ink/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-fade-up rounded-t-2xl bg-white p-5 shadow-card-hover sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="appointment-dialog"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-bob-ink">
            {existing ? "Modifica appuntamento" : "Nuovo appuntamento"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-bob-ink/50 hover:bg-black/5"
            aria-label="Chiudi"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label-bob">Cliente</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="input-bob"
              placeholder="Nome del cliente"
              data-testid="input-customer"
            />
          </div>
          <div>
            <label className="label-bob">Tipo di lavoro</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-bob"
              placeholder="Es. Riparazione perdita"
              data-testid="input-title"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-bob">Data e ora</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="input-bob"
                data-testid="input-startsat"
              />
            </div>
            <div>
              <label className="label-bob">Durata (min)</label>
              <input
                type="number"
                min={15}
                step={15}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="input-bob"
                data-testid="input-duration"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-bob">Prezzo (€)</label>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input-bob"
                placeholder="Opzionale"
                data-testid="input-price"
              />
            </div>
            <div>
              <label className="label-bob">Stato</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as Appointment["status"])
                }
                className="input-bob"
                data-testid="select-status"
              >
                <option value="confirmed">Confermato</option>
                <option value="completed">Completato</option>
                <option value="cancelled">Annullato</option>
              </select>
            </div>
          </div>
          {/* Luogo: serve al pro per sapere dove andare e per il giro del giorno */}
          <div className="rounded-xl border border-black/[0.07] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bob-ink/45">
              Luogo
            </p>
            <div className="space-y-3">
              <div>
                <label className="label-bob">Indirizzo</label>
                <input
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  className="input-bob"
                  placeholder="Via e numero civico"
                  maxLength={200}
                  data-testid="input-location-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-bob">Città</label>
                  <input
                    value={locCity}
                    onChange={(e) => setLocCity(e.target.value)}
                    className="input-bob"
                    placeholder="Es. Milano"
                    maxLength={80}
                    data-testid="input-location-city"
                  />
                </div>
                <div>
                  <label className="label-bob">Accesso</label>
                  <input
                    value={locNotes}
                    onChange={(e) => setLocNotes(e.target.value)}
                    className="input-bob"
                    placeholder="Citofono, piano…"
                    maxLength={300}
                    data-testid="input-location-notes"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="label-bob">Note</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input-bob resize-none"
              placeholder="Opzionale"
              data-testid="input-notes"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" data-testid="text-appt-error">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            {existing && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="btn-ghost text-red-600 hover:bg-red-50"
                data-testid="button-delete-appt"
              >
                Elimina
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary ml-auto px-5 py-2.5"
              data-testid="button-save-appt"
            >
              {saving ? "Salvo…" : existing ? "Salva modifiche" : "Aggiungi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
