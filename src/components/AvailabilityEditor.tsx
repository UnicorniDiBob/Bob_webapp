"use client";

// Orari di disponibilità del professionista (professional_availability).
// Il pro imposta, per giorno della settimana, una o più fasce orarie.
// Questi orari alimenteranno gli slot prenotabili quando la prenotazione
// diretta sarà pubblica (Fase 1); oggi il pro può già configurarli.
//
// Persistenza: si cancellano le righe esistenti del pro e si reinseriscono
// quelle correnti (le policy RLS consentono al pro di gestire solo le proprie).
// weekday: 0 = domenica … 6 = sabato (coerente con la migration 028).

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DAYS: { w: number; label: string }[] = [
  { w: 1, label: "Lunedì" },
  { w: 2, label: "Martedì" },
  { w: 3, label: "Mercoledì" },
  { w: 4, label: "Giovedì" },
  { w: 5, label: "Venerdì" },
  { w: 6, label: "Sabato" },
  { w: 0, label: "Domenica" },
];

interface Range {
  start: string; // "HH:MM"
  end: string;
}
type DayState = Record<number, { open: boolean; ranges: Range[] }>;

const hhmm = (t: string) => (t ? t.slice(0, 5) : "");

function defaultState(): DayState {
  const s: DayState = {};
  for (const { w } of DAYS) {
    // Baseline pilota: lun-sab 08:00-18:00, domenica chiuso.
    s[w] =
      w === 0
        ? { open: false, ranges: [] }
        : { open: true, ranges: [{ start: "08:00", end: "18:00" }] };
  }
  return s;
}

export default function AvailabilityEditor({
  professionalId,
}: {
  professionalId: string;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DayState>(defaultState());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("professional_availability")
        .select("weekday, start_time, end_time")
        .eq("professional_id", professionalId);

      if (!active) return;

      const rows = (data ?? []) as {
        weekday: number;
        start_time: string;
        end_time: string;
      }[];

      if (rows.length === 0) {
        setDays(defaultState());
      } else {
        const s: DayState = {};
        for (const { w } of DAYS) s[w] = { open: false, ranges: [] };
        for (const r of rows) {
          const d = s[r.weekday] ?? { open: false, ranges: [] };
          d.open = true;
          d.ranges.push({ start: hhmm(r.start_time), end: hhmm(r.end_time) });
          s[r.weekday] = d;
        }
        setDays(s);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  function toggleDay(w: number, open: boolean) {
    setDays((prev) => {
      const d = prev[w] ?? { open: false, ranges: [] };
      const ranges =
        open && d.ranges.length === 0
          ? [{ start: "08:00", end: "18:00" }]
          : d.ranges;
      return { ...prev, [w]: { open, ranges } };
    });
  }
  function addRange(w: number) {
    setDays((prev) => {
      const d = prev[w];
      return {
        ...prev,
        [w]: { ...d, ranges: [...d.ranges, { start: "09:00", end: "13:00" }] },
      };
    });
  }
  function removeRange(w: number, i: number) {
    setDays((prev) => {
      const d = prev[w];
      return { ...prev, [w]: { ...d, ranges: d.ranges.filter((_, idx) => idx !== i) } };
    });
  }
  function updateRange(w: number, i: number, part: Partial<Range>) {
    setDays((prev) => {
      const d = prev[w];
      return {
        ...prev,
        [w]: {
          ...d,
          ranges: d.ranges.map((r, idx) => (idx === i ? { ...r, ...part } : r)),
        },
      };
    });
  }

  async function save() {
    if (saving) return;
    setError(null);

    // Validazione: ogni fascia dei giorni aperti deve avere inizio < fine.
    const toInsert: {
      professional_id: string;
      weekday: number;
      start_time: string;
      end_time: string;
    }[] = [];
    for (const { w, label } of DAYS) {
      const d = days[w];
      if (!d?.open) continue;
      for (const r of d.ranges) {
        if (!r.start || !r.end || r.start >= r.end)
          return setError(`${label}: la fascia oraria non è valida.`);
        toInsert.push({
          professional_id: professionalId,
          weekday: w,
          start_time: r.start,
          end_time: r.end,
        });
      }
    }

    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from("professional_availability")
        .delete()
        .eq("professional_id", professionalId);
      if (delErr) throw delErr;

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from("professional_availability")
          .insert(toInsert);
        if (insErr) throw insErr;
      }
      setSavedAt(Date.now());
    } catch {
      setError("Non sono riuscito a salvare gli orari. Riprova tra poco.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-bob-ink/50">Carico i tuoi orari…</div>;
  }

  return (
    <div className="space-y-3" data-testid="availability-editor">
      <p className="text-sm text-bob-ink/60">
        {"Imposta gli orari in cui accetti prenotazioni. Serviranno a mostrare gli slot liberi quando la prenotazione diretta sarà attiva."}
      </p>

      <div className="space-y-2">
        {DAYS.map(({ w, label }) => {
          const d = days[w];
          return (
            <div key={w} className="rounded-lg border border-black/10 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-bob-ink">{label}</span>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={d.open}
                    onChange={(e) => toggleDay(w, e.target.checked)}
                    data-testid={`availability-day-${w}`}
                  />
                  <span className="relative h-5 w-9 rounded-full bg-black/15 transition-colors peer-checked:bg-bob-indigo after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                  <span className="text-xs text-bob-ink/60">
                    {d.open ? "Aperto" : "Chiuso"}
                  </span>
                </label>
              </div>

              {d.open && (
                <div className="mt-2 space-y-2">
                  {d.ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={r.start}
                        onChange={(e) =>
                          updateRange(w, i, { start: e.target.value })
                        }
                        className="input-bob w-32"
                        aria-label={`${label} inizio`}
                      />
                      <span className="text-bob-ink/40">–</span>
                      <input
                        type="time"
                        value={r.end}
                        onChange={(e) =>
                          updateRange(w, i, { end: e.target.value })
                        }
                        className="input-bob w-32"
                        aria-label={`${label} fine`}
                      />
                      {d.ranges.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRange(w, i)}
                          className="text-sm text-red-500 hover:text-red-700"
                          aria-label="Rimuovi fascia"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addRange(w)}
                    className="text-xs font-medium text-bob-indigo hover:underline"
                  >
                    + Aggiungi fascia
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-red-600" data-testid="availability-error">
          {error}
        </p>
      )}
      {savedAt && !error && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ Orari salvati.
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="btn-secondary py-2.5"
        data-testid="availability-save"
      >
        {saving ? "Salvo…" : "Salva orari"}
      </button>
    </div>
  );
}
