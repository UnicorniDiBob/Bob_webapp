"use client";

// Dialog di prenotazione diretta (anteprima SENZA pagamento).
// Flusso: compila i campi → prezzo in tempo reale → scegli uno slot →
// conferma → l'appuntamento è creato e vengono svelati i contatti del pro.
// Il passaggio di pagamento si aggiungerà tra il "conferma" e la creazione
// in fase di attivazione (2027).

import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  RATE_UNIT_LABELS,
  type BookingField,
  type RateUnit,
} from "@/lib/supabase/types";

export interface InstantService {
  id: string; // professional_services.id
  rate_amount: number;
  rate_unit: RateUnit;
  min_units: number;
  slot_duration_min: number;
  cancellation_window_hours: number | null;
  subserviceName: string;
  bookingFields: BookingField[];
}

interface BookResult {
  price: number;
  startsAt: string;
  durationMinutes: number;
  cancellationWindowHours: number | null;
  contact: { name: string | null; phone: string | null };
}

function slotLabel(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InstantBookingDialog({
  service,
  professionalName,
  onClose,
}: {
  service: InstantService;
  professionalName: string;
  onClose: () => void;
}) {
  const { user, loading } = useAuth();
  const [step, setStep] = useState<"form" | "slot" | "done">("form");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookResult | null>(null);

  const billable = useMemo(
    () => service.bookingFields.find((f) => f.is_billable_unit),
    [service.bookingFields]
  );

  const price = useMemo(() => {
    if (!billable) return null;
    const q = Number(answers[billable.key]);
    if (!(q > 0)) return null;
    const units = Math.max(service.min_units, q);
    return Math.round(units * service.rate_amount * 100) / 100;
  }, [answers, billable, service.min_units, service.rate_amount]);

  function setField(key: string, val: string | boolean) {
    setAnswers((p) => ({ ...p, [key]: val }));
  }

  function validateForm(): string | null {
    for (const f of service.bookingFields) {
      if (f.required) {
        const v = answers[f.key];
        if (v === undefined || v === "" || v === null)
          return `Compila: ${f.label}.`;
      }
    }
    if (!billable || !(Number(answers[billable.key]) > 0))
      return "Inserisci una quantità valida.";
    return null;
  }

  async function goToSlots() {
    const v = validateForm();
    if (v) return setError(v);
    setError(null);
    setStep("slot");
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/pro/instant-slots?psid=${service.id}`);
      const data = await res.json();
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function confirm() {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pro/instant-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ psid: service.id, answers, startsAt: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Errore");
      setResult(data as BookResult);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prenotazione non riuscita");
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of slots) {
      const k = dayKey(s);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return Array.from(m.entries());
  }, [slots]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-bob-ink">
              Prenota — {service.subserviceName}
            </h2>
            <p className="text-sm text-bob-ink/55">con {professionalName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-bob-ink/40 hover:text-bob-ink"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-bob-ink/50">Carico…</p>
        ) : !user ? (
          <div className="space-y-3">
            <p className="text-sm text-bob-ink/70">
              Accedi per prenotare direttamente uno slot con {professionalName}.
            </p>
            <a
              href={`/login?returnTo=${encodeURIComponent(
                typeof window !== "undefined" ? window.location.pathname : "/"
              )}`}
              className="btn-primary inline-block py-2.5"
            >
              Accedi per prenotare
            </a>
          </div>
        ) : step === "form" ? (
          <div className="space-y-4">
            {service.bookingFields.map((f) => (
              <div key={f.key}>
                <label className="label-bob">
                  {f.label}
                  {f.unit ? ` (${f.unit})` : ""}
                  {f.required ? " *" : ""}
                </label>
                {f.type === "select" ? (
                  <select
                    className="input-bob"
                    value={(answers[f.key] as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                  >
                    <option value="">Scegli…</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.type === "bool" ? (
                  <label className="mt-1 flex items-center gap-2 text-sm text-bob-ink/70">
                    <input
                      type="checkbox"
                      checked={Boolean(answers[f.key])}
                      onChange={(e) => setField(f.key, e.target.checked)}
                    />
                    Sì
                  </label>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    min={f.type === "number" ? 0 : undefined}
                    className="input-bob"
                    value={(answers[f.key] as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.help ?? ""}
                  />
                )}
              </div>
            ))}

            <div className="rounded-lg bg-bob-indigo-50 px-3 py-2 text-sm text-bob-ink">
              {price != null ? (
                <>
                  Totale stimato: <strong>{price.toLocaleString("it-IT")}€</strong>{" "}
                  <span className="text-bob-ink/55">
                    ({service.rate_amount.toLocaleString("it-IT")}€ /{" "}
                    {RATE_UNIT_LABELS[service.rate_unit]}, minimo{" "}
                    {service.min_units})
                  </span>
                </>
              ) : (
                <span className="text-bob-ink/55">
                  Inserisci i dati per vedere il totale.
                </span>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={goToSlots} className="btn-primary w-full py-2.5">
              Scegli data e ora
            </button>
          </div>
        ) : step === "slot" ? (
          <div className="space-y-4">
            {slotsLoading ? (
              <p className="text-sm text-bob-ink/50">Carico gli orari liberi…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-bob-ink/60">
                Nessuno slot libero al momento. Riprova più tardi o contatta{" "}
                {professionalName} per un preventivo.
              </p>
            ) : (
              <div className="space-y-3">
                {grouped.map(([day, isos]) => (
                  <div key={day}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-bob-ink/45">
                      {day}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {isos.map((iso) => (
                        <button
                          key={iso}
                          onClick={() => setSelected(iso)}
                          className={`chip ${
                            selected === iso
                              ? "bg-bob-indigo text-white"
                              : "hover:bg-bob-indigo-100"
                          }`}
                        >
                          {timeLabel(iso)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg bg-bob-indigo-50 px-3 py-2 text-sm text-bob-ink">
              {price != null && (
                <>
                  Totale: <strong>{price.toLocaleString("it-IT")}€</strong> ·{" "}
                  {service.slot_duration_min} min
                </>
              )}
            </div>
            {service.cancellation_window_hours != null && (
              <p className="text-xs text-bob-ink/50">
                Cancellazione gratuita fino a {service.cancellation_window_hours}{" "}
                ore prima.
              </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setStep("form")}
                className="btn-secondary flex-1 py-2.5"
              >
                Indietro
              </button>
              <button
                onClick={confirm}
                disabled={!selected || busy}
                className="btn-primary flex-1 py-2.5"
              >
                {busy ? "Prenoto…" : "Conferma prenotazione"}
              </button>
            </div>
            <p className="text-center text-xs text-bob-ink/45">
              Anteprima: nessun pagamento richiesto in questa fase.
            </p>
          </div>
        ) : (
          result && (
            <div className="space-y-3">
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                ✓ Prenotazione confermata con {professionalName}.
              </div>
              <div className="text-sm text-bob-ink/75">
                <p>
                  <strong>{slotLabel(result.startsAt)}</strong> ·{" "}
                  {result.durationMinutes} min
                </p>
                <p>
                  Totale: <strong>{result.price.toLocaleString("it-IT")}€</strong>
                </p>
                {result.cancellationWindowHours != null && (
                  <p className="text-xs text-bob-ink/50">
                    Cancellazione gratuita fino a{" "}
                    {result.cancellationWindowHours} ore prima.
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-black/10 px-3 py-2 text-sm">
                <p className="font-semibold text-bob-ink">Contatti del pro</p>
                <p className="text-bob-ink/70">
                  {result.contact.name ?? professionalName}
                  {result.contact.phone ? ` · ${result.contact.phone}` : ""}
                </p>
                {!result.contact.phone && (
                  <p className="mt-0.5 text-xs text-bob-ink/45">
                    Trovi la prenotazione anche nella tua area personale.
                  </p>
                )}
              </div>
              <button onClick={onClose} className="btn-primary w-full py-2.5">
                Fatto
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
