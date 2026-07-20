"use client";

// Dialog di prenotazione diretta (anteprima SENZA pagamento).
// Flusso snello: UNA domanda principale (la quantità fatturabile, es. le ore) +
// dettagli facoltativi a scomparsa → scegli lo slot da una vista settimanale →
// conferma → appuntamento creato e contatti del pro svelati.
// Il passaggio di pagamento si aggiungerà tra "conferma" e creazione (2027).

import { useEffect, useMemo, useState } from "react";
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

const TZ = "Europe/Rome";
const WD_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const pad = (n: number) => String(n).padStart(2, "0");

function romeKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fullLabel(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() + 6) % 7));
}
function keyToDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
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
  const [showDetails, setShowDetails] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookResult | null>(null);

  const billable = useMemo(
    () => service.bookingFields.find((f) => f.is_billable_unit),
    [service.bookingFields]
  );
  const details = useMemo(
    () => service.bookingFields.filter((f) => !f.is_billable_unit),
    [service.bookingFields]
  );

  const price = useMemo(() => {
    if (!billable) return null;
    const q = Number(answers[billable.key]);
    if (!(q > 0)) return null;
    const units = Math.max(service.min_units, q);
    return Math.round(units * service.rate_amount * 100) / 100;
  }, [answers, billable, service.min_units, service.rate_amount]);

  // Durata reale: per i servizi a ore = ore prenotate (min compreso).
  const durationMin = useMemo(() => {
    if (billable && service.rate_unit === "hour") {
      const q = Number(answers[billable.key]);
      if (q > 0) return Math.max(service.min_units, q) * 60;
    }
    return service.slot_duration_min;
  }, [answers, billable, service.rate_unit, service.min_units, service.slot_duration_min]);

  function setField(key: string, val: string | boolean) {
    setAnswers((p) => ({ ...p, [key]: val }));
  }

  async function goToSlots() {
    if (!billable || !(Number(answers[billable.key]) > 0))
      return setError("Inserisci una quantità valida.");
    setError(null);
    setStep("slot");
    setSlotsLoading(true);
    try {
      const q = billable ? Number(answers[billable.key]) || 0 : 0;
      const res = await fetch(
        `/api/pro/instant-slots?psid=${service.id}&qty=${q}`
      );
      const data = await res.json();
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function confirm() {
    if (!selectedIso || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pro/instant-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          psid: service.id,
          answers,
          startsAt: selectedIso,
        }),
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

  const slotsByDate = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of slots) {
      const k = romeKey(s);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return m;
  }, [slots]);

  // All'arrivo degli slot, apri la settimana del primo giorno disponibile.
  useEffect(() => {
    if (slots.length === 0) return;
    setWeekStart(mondayOf(keyToDate(romeKey(slots[0]))));
    setSelectedIso(null);
  }, [slots]);

  const lastKey = slots.length ? romeKey(slots[slots.length - 1]) : "";

  function renderWeek() {
    if (!weekStart) return null;
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const end = addDays(weekStart, 6);
    const label = `${weekStart.toLocaleDateString("it-IT", {
      day: "numeric",
    })}–${end.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`;
    const canPrev = keyOf(weekStart) > keyOf(mondayOf(new Date()));
    const canNext = keyOf(addDays(weekStart, 7)) <= lastKey;

    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={() => canPrev && setWeekStart(addDays(weekStart, -7))}
            disabled={!canPrev}
            className={`px-2 py-1 text-sm ${
              canPrev ? "text-bob-indigo" : "text-bob-ink/25"
            }`}
            aria-label="Settimana precedente"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-bob-ink">{label}</span>
          <button
            onClick={() => canNext && setWeekStart(addDays(weekStart, 7))}
            disabled={!canNext}
            className={`px-2 py-1 text-sm ${
              canNext ? "text-bob-indigo" : "text-bob-ink/25"
            }`}
            aria-label="Settimana successiva"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const dslots = slotsByDate.get(keyOf(day)) ?? [];
            return (
              <div key={keyOf(day)} className="min-w-0">
                <div className="text-center text-[10px] font-semibold uppercase text-bob-ink/45">
                  {WD_LABELS[i]}
                  <div className="text-xs text-bob-ink/70">{day.getDate()}</div>
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {dslots.length === 0 ? (
                    <span className="text-center text-[10px] text-bob-ink/25">
                      —
                    </span>
                  ) : (
                    dslots.map((iso) => (
                      <button
                        key={iso}
                        onClick={() => setSelectedIso(iso)}
                        className={`rounded-md px-0.5 py-1 text-[11px] leading-tight ${
                          selectedIso === iso
                            ? "bg-bob-indigo text-white"
                            : "bg-bob-indigo-50 text-bob-indigo hover:bg-bob-indigo-100"
                        }`}
                      >
                        {timeLabel(iso)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
            {billable && (
              <div>
                <label className="label-bob">
                  {billable.label}
                  {billable.unit ? ` (${billable.unit})` : ""}
                </label>
                <input
                  type="number"
                  min={0}
                  className="input-bob"
                  value={(answers[billable.key] as string) ?? ""}
                  onChange={(e) => setField(billable.key, e.target.value)}
                  placeholder={billable.help ?? "Es. 3"}
                  autoFocus
                />
              </div>
            )}

            {details.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-sm font-medium text-bob-indigo hover:underline"
                >
                  {showDetails
                    ? "− Nascondi dettagli"
                    : "+ Aggiungi dettagli (facoltativo)"}
                </button>
                {showDetails && (
                  <div className="mt-3 space-y-3">
                    {details.map((f) => (
                      <div key={f.key}>
                        <label className="label-bob">
                          {f.label}
                          {f.unit ? ` (${f.unit})` : ""}
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
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg bg-bob-indigo-50 px-3 py-2 text-sm text-bob-ink">
              {price != null ? (
                <>
                  Totale stimato:{" "}
                  <strong>{price.toLocaleString("it-IT")}€</strong>{" "}
                  <span className="text-bob-ink/55">
                    ({service.rate_amount.toLocaleString("it-IT")}€ /{" "}
                    {RATE_UNIT_LABELS[service.rate_unit]}, minimo{" "}
                    {service.min_units})
                  </span>
                </>
              ) : (
                <span className="text-bob-ink/55">
                  Inserisci la quantità per vedere il totale.
                </span>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={goToSlots} className="btn-primary w-full py-2.5">
              Scegli quando
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
              renderWeek()
            )}

            {selectedIso && (
              <p className="text-sm text-bob-ink/70">
                Scelto: <strong>{fullLabel(selectedIso)}</strong>
              </p>
            )}
            <div className="rounded-lg bg-bob-indigo-50 px-3 py-2 text-sm text-bob-ink">
              {price != null && (
                <>
                  Totale: <strong>{price.toLocaleString("it-IT")}€</strong> ·{" "}
                  {durationMin} min
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
                disabled={!selectedIso || busy}
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
                  <strong>{fullLabel(result.startsAt)}</strong> ·{" "}
                  {result.durationMinutes} min
                </p>
                <p>
                  Totale:{" "}
                  <strong>{result.price.toLocaleString("it-IT")}€</strong>
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
