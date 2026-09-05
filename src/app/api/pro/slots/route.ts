// GET /api/pro/slots?professionalId=&duration=60
// Slot liberi di un professionista per i prossimi 7 giorni.
// Privacy: il cliente vede SOLO gli orari liberi — mai il perché di quelli
// occupati. Può chiederli solo per pro con cui ha una richiesta in corso.
//
// GLI ORARI SONO QUELLI DEL PROFESSIONISTA, NON I NOSTRI (05/09).
// Fino a oggi questa rotta chiamava computeFreeSlots, che aveva dentro una
// settimana inventata da noi: lunedì-sabato 8-18, uguale per tutti, senza mai
// guardare professional_availability. Le conseguenze erano tre, tutte vere
// insieme: il cliente sceglieva «martedì alle 8» da un pro che il martedì non
// lavora e alle 8 dorme; il pro si trovava a rifiutare proposte una per una
// per orari che non aveva mai dichiarato; e la pagina Orari prometteva
// «finché non salvi, i clienti non vedono slot liberi», cosa che non era vera.
//
// Adesso le fasce arrivano da professional_availability — la stessa tabella
// che usa già la prenotazione diretta, così esiste una sola verità su quando
// un pro lavora. Se non le ha confermate NON si inventa niente: zero slot e
// orariConfermati: false, e l'interfaccia dice al cliente di proporre lui un
// orario in chat, invece di fargli scegliere fra ore a caso.

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  busyFromAppointments,
  computeFreeSlotsWithAvailability,
  type AvailabilityWindow,
} from "@/lib/slots";

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
  if (!user) {
    return NextResponse.json({ slots: [], orariConfermati: true }, { status: 401 });
  }

  // Il chiamante deve avere una richiesta collegata a questo pro
  // (evita che chiunque sondi le agende dei professionisti).
  const { data: link } = await supabase
    .from("request_professionals")
    .select("request_id, requests!inner ( customer_id )")
    .eq("professional_id", professionalId)
    .eq("requests.customer_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!link) {
    return NextResponse.json({ slots: [], orariConfermati: true }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ slots: [], orariConfermati: true });
  }

  const admin = createServiceClient(url, serviceKey);
  const [{ data: avail, error: availErr }, { data: appts }] = await Promise.all([
    admin
      .from("professional_availability")
      .select("weekday, start_time, end_time")
      .eq("professional_id", professionalId),
    admin
      .from("appointments")
      .select("starts_at, duration_minutes, status")
      .eq("professional_id", professionalId)
      .gte("starts_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
  ]);

  // Una lettura fallita non è «nessun orario»: dirlo sarebbe un'altra bugia,
  // solo dalla parte opposta. Si dichiara che gli orari ci sono e non si
  // propone niente, così il cliente scrive in chat invece di credere che il
  // pro non abbia mai confermato nulla.
  if (availErr) {
    return NextResponse.json({ slots: [], orariConfermati: true });
  }

  const windows: AvailabilityWindow[] = ((avail ?? []) as {
    weekday: number;
    start_time: string;
    end_time: string;
  }[]).map((w) => ({
    weekday: w.weekday,
    start: w.start_time.slice(0, 5),
    end: w.end_time.slice(0, 5),
  }));

  if (windows.length === 0) {
    return NextResponse.json({ slots: [], orariConfermati: false });
  }

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
    // Inizi all'ora tonda, come prima: cambiare la finestra non deve
    // cambiare anche il passo con cui si propone.
    stepMinutes: 60,
    days: 7,
    max: 24,
  });

  return NextResponse.json({
    slots: slots.map((s) => s.toISOString()),
    orariConfermati: true,
  });
}
