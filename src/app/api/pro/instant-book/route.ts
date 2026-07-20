// POST /api/pro/instant-book  { psid, answers, startsAt }
// Prenotazione diretta di uno slot a tariffa fissa. Anteprima SENZA pagamento:
// crea l'appuntamento confermato e svela i contatti del pro. Il pagamento
// (Stripe) si innesterà qui in fase di attivazione (vedi spec §6).
//
// Via service role: il cliente non ha INSERT su appointments. Prezzo e slot
// sono ricalcolati lato server (mai fidarsi del client).

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  busyFromAppointments,
  bookingDurationMinutes,
  computeFreeSlotsWithAvailability,
  type AvailabilityWindow,
} from "@/lib/slots";

export const runtime = "nodejs";

interface BookingField {
  key: string;
  required?: boolean;
  is_billable_unit?: boolean;
}

export async function POST(request: Request) {
  let body: { psid?: string; answers?: Record<string, unknown>; startsAt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }
  const { psid, startsAt } = body;
  const answers = body.answers ?? {};
  if (!psid || !startsAt) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }
  const when = new Date(startsAt);
  if (isNaN(when.getTime()) || when.getTime() < Date.now()) {
    return NextResponse.json({ error: "Orario non valido" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Accedi per prenotare" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Config mancante" }, { status: 500 });
  }
  const admin = createServiceClient(url, serviceKey);

  // 1. Servizio prenotabile + parametri tariffa.
  const { data: ps } = await admin
    .from("professional_services")
    .select(
      "id, professional_id, subservice_id, instant_book_enabled, rate_amount, rate_unit, min_units, slot_duration_min, cancellation_window_hours"
    )
    .eq("id", psid)
    .maybeSingle();
  if (
    !ps ||
    !ps.instant_book_enabled ||
    !ps.rate_amount ||
    !ps.min_units ||
    !ps.slot_duration_min ||
    !ps.subservice_id
  ) {
    return NextResponse.json(
      { error: "Servizio non prenotabile" },
      { status: 400 }
    );
  }

  // 2. Campi del job → individua il campo fatturabile.
  const { data: sub } = await admin
    .from("subservices")
    .select("name, booking_fields")
    .eq("id", ps.subservice_id)
    .maybeSingle();
  const fields = (sub?.booking_fields ?? []) as BookingField[];
  const billable = fields.find((f) => f.is_billable_unit);
  if (!billable) {
    return NextResponse.json(
      { error: "Configurazione servizio incompleta" },
      { status: 400 }
    );
  }

  // 3. Per una prenotazione serve SOLO il campo fatturabile (es. le ore):
  // gli altri campi sono contesto facoltativo per il pro, non bloccano.
  const qty = Number(answers[billable.key]);
  if (!(qty > 0)) {
    return NextResponse.json(
      { error: "Quantità non valida." },
      { status: 400 }
    );
  }

  // 4. Prezzo lato server: max(min, qty) * tariffa.
  const units = Math.max(Number(ps.min_units), qty);
  const price = Math.round(units * Number(ps.rate_amount) * 100) / 100;

  // Durata reale: per i servizi a ore blocca le ore prenotate (non uno slot fisso),
  // così l'agenda non si sovrappone su lavori lunghi.
  const duration = bookingDurationMinutes({
    unit: ps.rate_unit ?? "hour",
    minUnits: Number(ps.min_units),
    slotDurationMin: ps.slot_duration_min,
    qty,
  });

  // 5. Lo slot deve essere fra quelli liberi (orari del pro meno occupati).
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
  const free = computeFreeSlotsWithAvailability({
    windows,
    busy: busyFromAppointments(
      (appts ?? []) as {
        starts_at: string;
        duration_minutes: number;
        status: string;
      }[]
    ),
    durationMinutes: duration,
  });
  const chosen = when.getTime();
  if (!free.some((s) => s.getTime() === chosen)) {
    return NextResponse.json(
      { error: "Questo orario non è più disponibile: scegline un altro." },
      { status: 409 }
    );
  }

  // 6. Nome cliente per l'agenda del pro.
  const { data: prof } = await admin
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const customerName = (prof?.full_name as string | null) ?? "Cliente";

  // 7. Crea l'appuntamento confermato.
  const { data: ins, error: insErr } = await admin
    .from("appointments")
    .insert({
      professional_id: ps.professional_id,
      customer_id: user.id,
      professional_service_id: ps.id,
      customer_name: customerName,
      title: (sub?.name as string | null) ?? "Prenotazione diretta",
      starts_at: when.toISOString(),
      duration_minutes: duration,
      price,
      status: "confirmed",
      proposed_by: "customer",
      source: "direct",
      booking_answers: answers,
    })
    .select("id")
    .single();
  if (insErr) {
    return NextResponse.json({ error: "Prenotazione non riuscita" }, { status: 500 });
  }

  // 8. Progressive disclosure: solo ORA si svelano i contatti del pro.
  const { data: proRow } = await admin
    .from("professionals")
    .select("user_id")
    .eq("id", ps.professional_id)
    .maybeSingle();
  let contact: { name: string | null; phone: string | null } = {
    name: null,
    phone: null,
  };
  if (proRow?.user_id) {
    const { data: proProfile } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", proRow.user_id)
      .maybeSingle();
    contact = {
      name: (proProfile?.full_name as string | null) ?? null,
      phone: (proProfile?.phone as string | null) ?? null,
    };
  }

  return NextResponse.json({
    ok: true,
    appointmentId: ins.id,
    price,
    durationMinutes: ps.slot_duration_min,
    startsAt: when.toISOString(),
    cancellationWindowHours: ps.cancellation_window_hours ?? null,
    contact,
  });
}
