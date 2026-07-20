"use client";

// Riquadro "Prenota online" sul profilo pubblico del professionista.
// Mostra i servizi con prenotazione diretta attiva e apre il dialog.
// Se il pro non ha servizi prenotabili (o è sceso a Free) non mostra nulla.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  RATE_UNIT_LABELS,
  type BookingField,
  type RateUnit,
} from "@/lib/supabase/types";
import InstantBookingDialog, {
  type InstantService,
} from "@/components/InstantBookingDialog";

export default function InstantBookingEntry({
  professionalId,
  professionalName,
}: {
  professionalId: string;
  professionalName: string;
}) {
  const supabase = createClient();
  const [services, setServices] = useState<InstantService[]>([]);
  const [active, setActive] = useState<InstantService | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      const [{ data: pro }, { data: rows }, { count: availCount }] =
        await Promise.all([
          supabase
            .from("professionals")
            .select("subscription_tier")
            .eq("id", professionalId)
            .maybeSingle(),
          supabase
            .from("professional_services")
            .select(
              "id, rate_amount, rate_unit, min_units, slot_duration_min, cancellation_window_hours, subservices(name, booking_fields)"
            )
            .eq("professional_id", professionalId)
            .eq("instant_book_enabled", true),
          supabase
            .from("professional_availability")
            .select("id", { count: "exact", head: true })
            .eq("professional_id", professionalId),
        ]);

      if (!on) return;

      const tier = (pro as { subscription_tier?: string } | null)
        ?.subscription_tier;
      // Senza orari salvati non ci sono slot: non mostrare un ingresso che
      // porterebbe il cliente a un vicolo cieco.
      if (tier === "free" || !availCount || availCount === 0) {
        setReady(true);
        return;
      }

      const list: InstantService[] = ((rows ?? []) as Record<string, unknown>[])
        .map((r) => {
          const subRel = r.subservices;
          const sub = (Array.isArray(subRel) ? subRel[0] : subRel) as
            | { name?: string; booking_fields?: BookingField[] }
            | null;
          if (
            r.rate_amount == null ||
            r.min_units == null ||
            r.slot_duration_min == null ||
            !sub
          )
            return null;
          return {
            id: r.id as string,
            rate_amount: Number(r.rate_amount),
            rate_unit: (r.rate_unit as RateUnit) ?? "hour",
            min_units: Number(r.min_units),
            slot_duration_min: Number(r.slot_duration_min),
            cancellation_window_hours:
              r.cancellation_window_hours != null
                ? Number(r.cancellation_window_hours)
                : null,
            subserviceName: sub.name ?? "Servizio",
            bookingFields: Array.isArray(sub.booking_fields)
              ? sub.booking_fields
              : [],
          } as InstantService;
        })
        .filter((x): x is InstantService => x !== null);

      setServices(list);
      setReady(true);
    })();
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  if (!ready || services.length === 0) return null;

  return (
    <div className="card mb-4 p-6" data-testid="instant-booking-entry">
      <p className="text-xs font-semibold uppercase tracking-wide text-bob-indigo">
        Prenota online
      </p>
      <p className="mt-1 text-sm text-bob-ink/60">
        Blocca subito uno slot a tariffa fissa, senza attendere un preventivo.
      </p>
      <ul className="mt-3 space-y-2">
        {services.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-bob-ink">
                {s.subserviceName}
              </p>
              <p className="text-xs text-bob-ink/55">
                {s.rate_amount.toLocaleString("it-IT")}€ /{" "}
                {RATE_UNIT_LABELS[s.rate_unit]} · min {s.min_units}
              </p>
            </div>
            <button
              onClick={() => setActive(s)}
              className="btn-primary shrink-0 px-4 py-2 text-sm"
              data-testid={`instant-book-${s.id}`}
            >
              Prenota
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <InstantBookingDialog
          service={active}
          professionalName={professionalName}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
