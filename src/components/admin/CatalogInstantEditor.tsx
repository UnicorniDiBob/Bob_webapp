"use client";

// Editor admin del catalogo prenotazione diretta.
// Per ogni subservice: idoneità, unità di tariffa predefinita e i campi
// (booking_fields) che il cliente compilerà. Esattamente un campo per job è
// quello "fatturabile" (is_billable_unit) — quello che moltiplica la tariffa.

import { useMemo, useState } from "react";
import {
  RATE_UNIT_LABELS,
  type BookingField,
  type RateUnit,
} from "@/lib/supabase/types";

export interface EditorService {
  id: string;
  name: string;
  slug: string;
}
export interface EditorSubservice {
  id: string;
  service_id: string;
  name: string;
  slug: string;
  instant_book_eligible: boolean;
  default_rate_unit: RateUnit | null;
  booking_fields: BookingField[];
}

const FIELD_TYPES: BookingField["type"][] = ["number", "select", "bool", "text"];
const RATE_UNITS: RateUnit[] = ["hour", "m2", "job", "session"];

interface FieldRow {
  key: string;
  label: string;
  type: BookingField["type"];
  unit: string;
  required: boolean;
  is_billable_unit: boolean;
  options: string; // CSV in UI
  help: string;
}

function toRows(fields: BookingField[]): FieldRow[] {
  return (Array.isArray(fields) ? fields : []).map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    unit: f.unit ?? "",
    required: Boolean(f.required),
    is_billable_unit: Boolean(f.is_billable_unit),
    options: (f.options ?? []).join(", "),
    help: f.help ?? "",
  }));
}

function toPayload(rows: FieldRow[]): BookingField[] {
  return rows.map((r) => ({
    key: r.key.trim(),
    label: r.label.trim(),
    type: r.type,
    ...(r.unit.trim() ? { unit: r.unit.trim() } : {}),
    required: r.required,
    is_billable_unit: r.is_billable_unit,
    ...(r.type === "select"
      ? {
          options: r.options
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean),
        }
      : {}),
    ...(r.help.trim() ? { help: r.help.trim() } : {}),
  }));
}

function SubEditor({ sub }: { sub: EditorSubservice }) {
  const [eligible, setEligible] = useState(sub.instant_book_eligible);
  const [unit, setUnit] = useState<RateUnit | "">(sub.default_rate_unit ?? "");
  const [rows, setRows] = useState<FieldRow[]>(toRows(sub.booking_fields));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function update(i: number, part: Partial<FieldRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...part } : r)));
  }
  function setBillable(i: number) {
    setRows((prev) =>
      prev.map((r, idx) => ({ ...r, is_billable_unit: idx === i }))
    );
  }
  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: "",
        label: "",
        type: "number",
        unit: "",
        required: false,
        is_billable_unit: prev.length === 0,
        options: "",
        help: "",
      },
    ]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (saving) return;
    setMsg(null);

    if (eligible) {
      if (rows.length === 0)
        return setMsg({ ok: false, text: "Un servizio idoneo deve avere almeno un campo." });
      const billable = rows.filter((r) => r.is_billable_unit).length;
      if (billable !== 1)
        return setMsg({ ok: false, text: "Serve esattamente un campo fatturabile." });
      if (rows.some((r) => !r.key.trim() || !r.label.trim()))
        return setMsg({ ok: false, text: "Ogni campo deve avere chiave ed etichetta." });
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/subservices/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instant_book_eligible: eligible,
          default_rate_unit: unit || null,
          booking_fields: toPayload(rows),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Errore");
      setMsg({ ok: true, text: "Salvato." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Errore" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card space-y-3 p-4" data-testid={`catalog-sub-${sub.slug}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="font-semibold text-bob-ink">{sub.name}</span>
          <span className="ml-2 text-xs text-bob-ink/40">{sub.slug}</span>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={eligible}
            onChange={(e) => setEligible(e.target.checked)}
            data-testid={`catalog-eligible-${sub.slug}`}
          />
          <span className="relative h-5 w-9 rounded-full bg-black/15 transition-colors peer-checked:bg-bob-indigo after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          <span className="text-xs text-bob-ink/60">
            {eligible ? "Idoneo" : "Non idoneo"}
          </span>
        </label>
      </div>

      {eligible && (
        <>
          <div className="max-w-xs">
            <label className="label-bob">Unità di tariffa predefinita</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as RateUnit | "")}
              className="input-bob"
            >
              <option value="">—</option>
              {RATE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {RATE_UNIT_LABELS[u]} ({u})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <span className="label-bob">Campi di prenotazione</span>
            {rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-lg border border-black/10 p-2 sm:grid-cols-12"
              >
                <input
                  value={r.key}
                  onChange={(e) => update(i, { key: e.target.value })}
                  placeholder="chiave"
                  className="input-bob sm:col-span-2"
                  aria-label="Chiave campo"
                />
                <input
                  value={r.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Etichetta"
                  className="input-bob sm:col-span-3"
                  aria-label="Etichetta campo"
                />
                <select
                  value={r.type}
                  onChange={(e) =>
                    update(i, { type: e.target.value as BookingField["type"] })
                  }
                  className="input-bob sm:col-span-2"
                  aria-label="Tipo campo"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  value={r.unit}
                  onChange={(e) => update(i, { unit: e.target.value })}
                  placeholder="unità"
                  className="input-bob sm:col-span-2"
                  aria-label="Unità campo"
                />
                <label className="flex items-center gap-1 text-xs text-bob-ink/60 sm:col-span-1">
                  <input
                    type="checkbox"
                    checked={r.required}
                    onChange={(e) => update(i, { required: e.target.checked })}
                  />
                  obbl.
                </label>
                <label className="flex items-center gap-1 text-xs text-bob-ink/60 sm:col-span-1">
                  <input
                    type="radio"
                    name={`billable-${sub.id}`}
                    checked={r.is_billable_unit}
                    onChange={() => setBillable(i)}
                  />
                  €
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-sm text-red-500 hover:text-red-700 sm:col-span-1"
                  aria-label="Rimuovi campo"
                >
                  ✕
                </button>
                {r.type === "select" && (
                  <input
                    value={r.options}
                    onChange={(e) => update(i, { options: e.target.value })}
                    placeholder="opzioni separate da virgola"
                    className="input-bob sm:col-span-12"
                    aria-label="Opzioni campo"
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="chip hover:bg-bob-indigo-100"
            >
              + Aggiungi campo
            </button>
            <p className="text-xs text-bob-ink/45">
              {"Il pallino € indica il campo fatturabile: è quello moltiplicato per la tariffa del pro. Deve essercene esattamente uno."}
            </p>
          </div>
        </>
      )}

      {msg && (
        <p
          className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}
        >
          {msg.ok ? "✓ " : ""}
          {msg.text}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="btn-secondary py-2"
        data-testid={`catalog-save-${sub.slug}`}
      >
        {saving ? "Salvo…" : "Salva"}
      </button>
    </div>
  );
}

export default function CatalogInstantEditor({
  services,
  subservices,
}: {
  services: EditorService[];
  subservices: EditorSubservice[];
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");

  const subs = useMemo(
    () => subservices.filter((s) => s.service_id === serviceId),
    [subservices, serviceId]
  );

  const eligibleCount = useMemo(
    () => subservices.filter((s) => s.instant_book_eligible).length,
    [subservices]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xs flex-1">
          <label className="label-bob">Categoria</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="input-bob"
            data-testid="catalog-service"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-bob-ink/50">
          {eligibleCount} servizi idonei in totale
        </span>
      </div>

      <div className="space-y-3">
        {subs.map((s) => (
          <SubEditor key={s.id} sub={s} />
        ))}
      </div>
    </div>
  );
}
