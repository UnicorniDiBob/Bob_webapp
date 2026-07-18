// GET /api/pro/slots?professionalId=&duration=60
// Slot liberi di un professionista per i prossimi 7 giorni.
// Privacy: il cliente vede SOLO gli orari liberi — mai il perché di quelli
// occupati. Può chiederli solo per pro con cui ha una richiesta in corso.

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { busyFromAppointments, computeFreeSlots } from "@/lib/slots";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const professionalId = searchParams.get("professionalId");
  const duration = Math.min(
    240,
    Math.max(30, Number(searchParams.get("duration") ?? 60))
  );
  if (!professionalId) {
    return NextResponse.json({ error: "professionalId mancante" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ slots: [] }, { status: 401 });

  // Il chiamante deve avere una richiesta collegata a questo pro
  // (evita che chiunque sondi le agende dei professionisti).
  const { data: link } = await supabase
    .from("request_professionals")
    .select("request_id, requests!inner ( customer_id )")
    .eq("professional_id", professionalId)
    .eq("requests.customer_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!link) return NextResponse.json({ slots: [] }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ slots: [] });

  const admin = createServiceClient(url, serviceKey);
  const { data: appts } = await admin
    .from("appointments")
    .select("starts_at, duration_minutes, status")
    .eq("professional_id", professionalId)
    .gte("starts_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());

  const slots = computeFreeSlots({
    busy: busyFromAppointments(
      (appts ?? []) as {
        starts_at: string;
        duration_minutes: number;
        status: string;
      }[]
    ),
    durationMinutes: duration,
  });

  return NextResponse.json({ slots: slots.map((s) => s.toISOString()) });
}
