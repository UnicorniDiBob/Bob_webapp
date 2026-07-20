"use client";

// Prenotazione diretta (instant booking) — configurazione lato professionista.
// Per ogni subservice idoneo (instant_book_eligible) che il pro offre, permette
// di impostare tariffa, unità, minimo, durata slot e finestra di cancellazione,
// e di attivare/disattivare la prenotazione diretta.
//
// Vincoli replicati dal trigger DB (migration 028): per attivare servono
// rate_amount, rate_unit, min_units, slot_duration_min e una finestra di
// cancellazione >= MIN_CANCELLATION_WINDOW_HOURS. Il salvataggio crea/aggiorna
// una riga professional_services dedicata, con subservice_id valorizzato
// (separata dalla riga "servizio principale" a forbice usata per i preventivi).
//
// Nota Fase 0: qui il pro configura; non esiste ancora una superficie pubblica
// di prenotazione. instant_book_enabled resta un flag "pronto per il lancio".

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MIN_CANCELLATION_WINDOW_HOURS,
  RATE_UNIT_LABELS,
  type BookingField,
  type RateUnit,
  type SubscriptionTier,
} from "@/lib/supabase/types";

interface EligibleSub {
  id: string;
  slug: string;
  name: string;
  default_rate_unit: RateUnit | null;
  booking_fields: BookingField[];
}

interface Cfg {
  subserviceId: string;
  name: string;
  unit: RateUnit;
  billableLabel: string;
  rowId: string | null;
  enabled: boolean;
  rate: string;
  minUnits: string;
  slotDuration: string;
  cancelHours: string;
}

function billableLabelOf(fields: BookingField[]): string {
  const f = Array.isArray(fields)
    ? fields.find((x) => x.is_billable_unit)
    : undefined;
  return f?.label ?? "Quantità";
}

export default function InstantBookingConfig({
  professionalId,
  serviceId,
  cityId,
  subSlugs,
  tier,
}: {
  professionalId: string;
  serviceId: string;
  cityId: string;
  subSlugs: string[];
  tier: SubscriptionTier;
}) {
  const supabase = createClient();
  const canUse = tier === "pro" || tier === "business";

  const [loading, setLoading] = useState(true);
  const [cfgs, setCfgs] = useState<Cfg[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [catEligible, setCatEligible] = useState<{ name: string; slug: string }[]>([]);

  // Servizi della categoria del pro che supportano la prenotazione diretta:
  // serve a spiegare cosa selezionare quando non c'è ancora nulla di idoneo.
  useEffect(() => {
    let on = true;
    (async () => {
      if (!serviceId) {
        setCatEligible([]);
        return;
      }
      const { data } = await supabase
        .from("subservices")
        .select("name, slug")
        .eq("service_id", serviceId)
        .eq("instant_book_eligible", true)
        .order("name");
      if (on) setCatEligible((data ?? []) as { name: string; slug: string }[]);
    })();
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      if (subSlugs.length === 0) {
        if (active) {
          setCfgs([]);
          setLoading(false);
        }
        return;
      }

      const { data: subs } = await supabase
        .from("subservices")
        .select("id, slug, name, default_rate_unit, booking_fields, instant_book_eligible")
        .in("slug", subSlugs)
        .eq("instant_book_eligible", true);

      const eligible = (subs ?? []) as unknown as EligibleSub[];
      if (eligible.length === 0) {
        if (active) {
          setCfgs([]);
          setLoading(false);
        }
        return;
      }

      const { data: existing } = await supabase
        .from("professional_services")
        .select(
          "id, subservice_id, instant_book_enabled, rate_amount, rate_unit, min_units, slot_duration_min, cancellation_window_hours"
        )
        .eq("professional_id", professionalId)
        .in(
          "subservice_id",
          eligible.map((s) => s.id)
        );

      const bySub = new Map<string, Record<string, unknown>>();
      for (const row of existing ?? []) {
        const r = row as Record<string, unknown>;
        if (r.subservice_id) bySub.set(r.subservice_id as string, r);
      }

      const next: Cfg[] = eligible.map((s) => {
        const r = bySub.get(s.id);
        const unit = (s.default_rate_unit ?? "hour") as RateUnit;
        return {
          subserviceId: s.id,
          name: s.name,
          unit: (r?.rate_unit as RateUnit) ?? unit,
          billableLabel: billableLabelOf(s.booking_fields),
          rowId: (r?.id as string) ?? null,
          enabled: Boolean(r?.instant_book_enabled),
          rate: r?.rate_amount != null ? String(r.rate_amount) : "",
          minUnits: r?.min_units != null ? String(r.min_units) : "1",
          slotDuration:
            r?.slot_duration_min != null ? String(r.slot_duration_min) : "60",
          cancelHours:
            r?.cancellation_window_hours != null
              ? String(r.cancellation_window_hours)
              : String(MIN_CANCELLATION_WINDOW_HOURS),
        };
      });

      if (active) {
        setCfgs(next);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId, JSON.stringify(subSlugs)]);

  function patch(subserviceId: string, part: Partial<Cfg>) {
    setCfgs((prev) =>
      prev.map((c) => (c.subserviceId === subserviceId ? { ...c, ...part } : c))
    );
  }

  function validate(c: Cfg): string | null {
    if (!c.enabled) return null;
    const rate = Number(c.rate);
    const min = Number(c.minUnits);
    const slot = Number(c.slotDuration);
    const cancel = Number(c.cancelHours);
    if (!(rate > 0)) return `${c.name}: inserisci una tariffa valida.`;
    if (!(min > 0)) return `${c.name}: il minimo deve essere maggiore di zero.`;
    if (!(slot > 0)) return `${c.name}: la durata dello slot non è valida.`;
    if (!(cancel >= MIN_CANCELLATION_WINDOW_HOURS))
      return `${c.name}: la finestra di cancellazione deve essere di almeno ${MIN_CANCELLATION_WINDOW_HOURS} ore.`;
    return null;
  }

  async function handleSave() {
    if (saving || !canUse) return;
    setError(null);

    for (const c of cfgs) {
      const v = validate(c);
      if (v) return setError(v);
    }

    setSaving(true);
    try {
      for (const c of cfgs) {
        // Nessuna riga e disattivato: niente da salvare.
        if (!c.rowId && !c.enabled) continue;

        const fields = {
          professional_id: professionalId,
          service_id: serviceId,
          city_id: cityId,
          subservice_id: c.subserviceId,
          instant_book_enabled: c.enabled,
          rate_amount: c.rate ? Number(c.rate) : null,
          rate_unit: c.unit,
          min_units: c.minUnits ? Number(c.minUnits) : null,
          slot_duration_min: c.slotDuration ? Number(c.slotDuration) : null,
          cancellation_window_hours: c.cancelHours
            ? Number(c.cancelHours)
            : null,
        };

        if (c.rowId) {
          const { error: e } = await supabase
            .from("professional_services")
            .update(fields)
            .eq("id", c.rowId);
          if (e) throw e;
        } else {
          const { data: ins, error: e } = await supabase
            .from("professional_services")
            .insert(fields)
            .select("id")
            .single();
          if (e) throw e;
          const newId = (ins as { id: string }).id;
          patch(c.subserviceId, { rowId: newId });
        }
      }
      setSavedAt(Date.now());
    } catch {
      setError(
        "Non sono riuscito a salvare la prenotazione diretta. Controlla i campi e riprova."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-bob-ink/50">
        Carico le opzioni di prenotazione diretta…
      </div>
    );
  }

  if (cfgs.length === 0) {
    const selected = new Set(subSlugs);
    const toPick = catEligible.filter((s) => !selected.has(s.slug));
    return (
      <div className="space-y-2 text-sm text-bob-ink/60">
        <p>
          {"La prenotazione diretta permette ai clienti di prenotare uno slot a tariffa fissa senza chiederti un preventivo."}
        </p>
        {catEligible.length === 0 ? (
          <p className="rounded-lg bg-black/[0.03] px-3 py-2">
            {"La tua categoria non prevede (ancora) la prenotazione diretta: è pensata per i lavori a tariffa fissa come pulizie, ripetizioni o piccoli interventi."}
          </p>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            {"È disponibile per: "}
            <strong>{(toPick.length ? toPick : catEligible).map((s) => s.name).join(", ")}</strong>
            {'. Selezionali qui sopra in "Di cosa ti occupi" e torna qui per impostare tariffa e attivarla.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="instant-booking-config">
      <p className="text-sm text-bob-ink/60">
        {"Attiva la prenotazione diretta sui lavori a tariffa fissa: i clienti potranno prenotare uno slot senza doverti scrivere prima. Puoi attivarla o disattivarla per ogni servizio quando vuoi."}
      </p>

      {!canUse && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {"La prenotazione diretta è inclusa nel piano Bob Pro. Passa a Pro per attivarla."}
        </div>
      )}

      <div className={`space-y-3 ${!canUse ? "pointer-events-none opacity-50" : ""}`}>
        {cfgs.map((c) => (
          <div key={c.subserviceId} className="card space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-bob-ink">{c.name}</span>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={c.enabled}
                  onChange={(e) =>
                    patch(c.subserviceId, { enabled: e.target.checked })
                  }
                  disabled={!canUse}
                  data-testid={`instant-toggle-${c.subserviceId}`}
                />
                <span className="relative h-5 w-9 rounded-full bg-black/15 transition-colors peer-checked:bg-bob-indigo after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                <span className="text-xs text-bob-ink/60">
                  {c.enabled ? "Attiva" : "Disattivata"}
                </span>
              </label>
            </div>

            {c.enabled && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-bob">
                    Tariffa (€ per {RATE_UNIT_LABELS[c.unit]})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={c.rate}
                    onChange={(e) =>
                      patch(c.subserviceId, { rate: e.target.value })
                    }
                    className="input-bob"
                    placeholder="Es. 25"
                    data-testid={`instant-rate-${c.subserviceId}`}
                  />
                </div>
                <div>
                  <label className="label-bob">
                    Minimo ({c.billableLabel.toLowerCase()})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={c.minUnits}
                    onChange={(e) =>
                      patch(c.subserviceId, { minUnits: e.target.value })
                    }
                    className="input-bob"
                    placeholder="Es. 2"
                  />
                </div>
                <div>
                  <label className="label-bob">Durata slot (minuti)</label>
                  <input
                    type="number"
                    min={0}
                    step={15}
                    value={c.slotDuration}
                    onChange={(e) =>
                      patch(c.subserviceId, { slotDuration: e.target.value })
                    }
                    className="input-bob"
                    placeholder="Es. 60"
                  />
                </div>
                <div>
                  <label className="label-bob">
                    Cancellazione gratuita fino a (ore prima)
                  </label>
                  <input
                    type="number"
                    min={MIN_CANCELLATION_WINDOW_HOURS}
                    value={c.cancelHours}
                    onChange={(e) =>
                      patch(c.subserviceId, { cancelHours: e.target.value })
                    }
                    className="input-bob"
                    placeholder={String(MIN_CANCELLATION_WINDOW_HOURS)}
                  />
                  <p className="mt-1 text-xs text-bob-ink/45">
                    {"Minimo "}
                    {MIN_CANCELLATION_WINDOW_HOURS}
                    {" ore, imposto dalla piattaforma."}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600" data-testid="instant-error">
          {error}
        </p>
      )}
      {savedAt && !error && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ Prenotazione diretta salvata.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !canUse}
        className="btn-secondary py-2.5"
        data-testid="instant-save"
      >
        {saving ? "Salvo…" : "Salva prenotazione diretta"}
      </button>
      <p className="text-xs text-bob-ink/45">
        {"Perché i clienti possano prenotare, imposta anche i tuoi orari in “Orari di disponibilità” qui sotto."}
      </p>
    </div>
  );
}
