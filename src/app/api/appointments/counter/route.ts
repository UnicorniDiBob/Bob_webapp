// POST /api/appointments/counter  { appointmentId, startsAt }
// Contro-proposta del cliente: rifiuta la proposta del pro e ne crea una
// nuova nello slot scelto (tra quelli liberi), da confermare dal pro.
// Via service role: il cliente non ha (volutamente) INSERT su appointments;
// qui validiamo tutto lato server prima di scrivere.

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { busyFromAppointments } from "@/lib/slots";
import { buildEmail, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { appointmentId?: string; startsAt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }
  const { appointmentId, startsAt } = body;
  if (!appointmentId || !startsAt) {
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
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Config mancante" }, { status: 500 });
  }
  const admin = createServiceClient(url, serviceKey);

  // L'appuntamento deve essere una proposta su una richiesta del chiamante.
  const { data: appt } = await admin
    .from("appointments")
    .select(
      "id, professional_id, request_id, customer_name, title, duration_minutes, status"
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt || appt.status !== "proposed" || !appt.request_id) {
    return NextResponse.json({ error: "Proposta non trovata" }, { status: 404 });
  }
  const { data: req } = await admin
    .from("requests")
    .select("id, customer_id")
    .eq("id", appt.request_id)
    .maybeSingle();
  if (!req || req.customer_id !== user.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  // Lo slot deve essere ancora libero per il pro (esclusa la proposta stessa).
  const { data: others } = await admin
    .from("appointments")
    .select("id, starts_at, duration_minutes, status")
    .eq("professional_id", appt.professional_id)
    .neq("id", appt.id)
    .gte("starts_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  const s = when.getTime();
  const e = s + appt.duration_minutes * 60000;
  const busy = busyFromAppointments(
    (others ?? []) as {
      starts_at: string;
      duration_minutes: number;
      status: string;
    }[]
  );
  if (busy.some((b) => s < b.end && e > b.start)) {
    return NextResponse.json(
      { error: "Questo orario non è più disponibile: scegline un altro." },
      { status: 409 }
    );
  }

  // Rifiuta la vecchia proposta e crea la contro-proposta del cliente.
  const { error: updErr } = await admin
    .from("appointments")
    .update({ status: "declined" })
    .eq("id", appt.id);
  if (updErr) return NextResponse.json({ error: "Salvataggio fallito" }, { status: 500 });

  const { error: insErr } = await admin.from("appointments").insert({
    professional_id: appt.professional_id,
    request_id: appt.request_id,
    customer_name: appt.customer_name,
    title: appt.title,
    starts_at: when.toISOString(),
    duration_minutes: appt.duration_minutes,
    status: "proposed",
    proposed_by: "customer",
  });
  if (insErr) return NextResponse.json({ error: "Salvataggio fallito" }, { status: 500 });

  // Traccia in chat, nel thread giusto.
  // timeZone esplicita: il server gira in UTC, il messaggio deve dire
  // l'ora italiana che il cliente ha effettivamente scelto.
  const label = when.toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  await admin.from("request_messages").insert({
    request_id: appt.request_id,
    professional_id: appt.professional_id,
    sender_type: "customer",
    sender_id: user.id,
    message: `🔄 Ti propongo un orario diverso: ${label}. Puoi confermarlo dal tuo calendario.`,
  });

  const relName = (rel: unknown): string | null => {
    const r = Array.isArray(rel) ? rel[0] : rel;
    return (r as { name?: string } | null)?.name ?? null;
  };
  // Notifica email al pro (dormiente senza RESEND_API_KEY): il cliente ha
  // proposto un nuovo orario, il pro lo conferma dal suo calendario.
  try {
    const { data: proRow } = await admin
      .from("professionals")
      .select("user_id")
      .eq("id", appt.professional_id)
      .maybeSingle();
    const proUserId = (proRow as { user_id: string | null } | null)?.user_id;
    if (proUserId) {
      const { data: proUser } = await admin.auth.admin.getUserById(proUserId);
      const to = proUser.user?.email ?? null;
      const { data: reqRow } = await admin
        .from("requests")
        .select("services ( name ), cities ( name )")
        .eq("id", appt.request_id)
        .maybeSingle();
      if (to) {
        await sendEmail(
          buildEmail("appointment_proposed", to, {
            recipientName: null,
            senderName: appt.customer_name ?? null,
            serviceName: relName((reqRow as Record<string, unknown> | null)?.services),
            cityName: relName((reqRow as Record<string, unknown> | null)?.cities),
            preview: `${label} (${appt.duration_minutes} min)`,
            link: "/dashboard",
          })
        );
      }
    }
  } catch {
    // notifica non critica
  }

  return NextResponse.json({ ok: true });
}
