// GET /api/pro/instant-slots?psid=<professional_service_id>
// Slot liberi per una prenotazione diretta, calcolati dagli orari del pro
// (professional_availability) meno gli appuntamenti già occupati.
// Pubblico per definizione: la prenotazione diretta è pensata per essere aperta.

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  busyFromAppointments,
  bookingDurationMinutes,
  computeFreeSlotsWithAvailability,
  type AvailabilityWindow,
} from "@/lib/slots";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const psid = searchParams.get("psid");
  const qty = Number(searchParams.get("qty") ?? "0");
  if (!psid) {
    return NextResponse.json({ error: "psid mancante" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ slots: [] });
  const admin = createServiceClient(url, serviceKey);

  const { data: ps } = await admin
    .from("professional_services")
    .select(
      "id, professional_id, instant_book_enabled, rate_unit, min_units, slot_duration_min, professionals!inner ( deactivated_at )"
    )
    .eq("id", psid)
    .maybeSingle();

  if (!ps || !ps.instant_book_enabled || !ps.slot_duration_min) {
    return NextResponse.json({ slots: [] });
  }

  // Profilo spento da una richiesta di cancellazione (mig 056): nessuno slot.
  // Il controllo va QUI e non solo nella pagina, perche' questa route gira col
  // service role e risponderebbe anche a chi la chiama direttamente.
  const proSpento =
    (ps as unknown as { professionals?: { deactivated_at: string | null } | null })
      .professionals?.deactivated_at != null;
  if (proSpento) {
    return NextResponse.json({ slots: [] });
  }

  // Durata reale della prenotazione (per servizi a ore = ore prenotate).
  const duration = bookingDurationMinutes({
    unit: ps.rate_unit ?? "hour",
    minUnits: Number(ps.min_units ?? 1),
    slotDurationMin: ps.slot_duration_min,
    qty,
  });

  const [{ data: avail }, { data: appts }] = await Promise.all([
    admin
      .from("professional_availability")
      .select("weekday, start_time, end_time")
      .eq("professional_id", ps.professional_id),
    admin
      .from("appointments")
      .select("starts_at, duration_minutes, status")
      .eq("professional_id", ps.professional_id)
      .gte("starts_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
  ]);

  const windows: AvailabilityWindow[] = ((avail ?? []) as {
    weekday: number;
    start_time: string;
    end_time: string;
  }[]).map((w) => ({
    weekday: w.weekday,
    start: w.start_time.slice(0, 5),
    end: w.end_time.slice(0, 5),
  }));

  const slots = computeFreeSlotsWithAvailability({
    windows,
    busy: busyFromAppointments(
      (appts ?? []) as {
        starts_at: string;
        duration_minutes: number;
        status: string;
      }[]
    ),
    durationMinutes: duration,
    stepMinutes: ps.slot_duration_min,
  });

  return NextResponse.json({
    slots: slots.map((s) => s.toISOString()),
    durationMinutes: duration,
  });
}
