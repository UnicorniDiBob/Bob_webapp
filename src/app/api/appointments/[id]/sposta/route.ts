// POST /api/appointments/[id]/sposta  { inizio, motivo? }
// Il cliente sposta un appuntamento confermato, fuori dal preavviso
// fotografato alla conferma (stessa regola della disdetta, 113).
//
// LA DECISIONE STA NEL DATABASE (115). Controllo, scrittura, ritorno a «da
// confermare» e messaggio in chat stanno in sposta_appuntamento(), che gira
// con la sessione del cliente: cosi' lo storico sa chi ha spostato. Se il
// pro poi rifiuta, torna l'orario di prima: anche quello e' nel database.
//
// Qui, come nella disdetta: tradurre gli errori in stati HTTP e partire con
// la copia per email al pro quando la posta sara' accesa (src/lib/email.ts:
// oggi no).

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { buildEmail, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

const STATO_PER_MOTIVO: Record<string, number> = {
  non_trovato: 404,
  non_attivo: 409,
  chiama: 409,
  occupato: 409,
  orario: 400,
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  let inizio: Date | null = null;
  let motivo: string | null = null;
  try {
    const body = (await request.json()) as { inizio?: unknown; motivo?: unknown };
    if (typeof body.inizio === "string") {
      const d = new Date(body.inizio);
      if (!isNaN(d.getTime())) inizio = d;
    }
    motivo = typeof body.motivo === "string" ? body.motivo.slice(0, 500) : null;
  } catch {
    // Body non valido: lo dice il controllo qui sotto.
  }
  if (!inizio) {
    return NextResponse.json(
      { error: "Scegli il nuovo orario.", motivo: "orario" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("sposta_appuntamento", {
    p_id: params.id,
    p_inizio: inizio.toISOString(),
    p_motivo: motivo,
  });
  if (error) {
    const stato = STATO_PER_MOTIVO[error.hint ?? ""];
    if (!stato) {
      console.error(`[sposta] sposta_appuntamento(${params.id}) ha fallito:`, error);
      return NextResponse.json({ error: "Spostamento non riuscito. Riprova." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message, motivo: error.hint }, { status: stato });
  }

  const esito = data as {
    request_id: string;
    professional_id: string;
    customer_name: string | null;
    title: string | null;
    inizio_prima: string;
    inizio_dopo: string;
    duration_minutes: number;
  };

  // La copia per email, quando la posta e' accesa. Best effort: lo
  // spostamento e' gia' valido e il messaggio in chat e' gia' scritto.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    try {
      const admin = createServiceClient(url, serviceKey);
      const { data: proRow } = await admin
        .from("professionals")
        .select("user_id")
        .eq("id", esito.professional_id)
        .maybeSingle();
      const proUserId = (proRow as { user_id: string | null } | null)?.user_id;
      if (proUserId) {
        const { data: proUser } = await admin.auth.admin.getUserById(proUserId);
        const to = proUser.user?.email ?? null;
        if (to) {
          const fmt = (iso: string) =>
            new Date(iso).toLocaleString("it-IT", {
              timeZone: "Europe/Rome",
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
          await sendEmail(
            buildEmail("appointment_moved", to, {
              recipientName: null,
              senderName: esito.customer_name ?? null,
              serviceName: esito.title ?? null,
              cityName: null,
              preview: `Da ${fmt(esito.inizio_prima)} a ${fmt(esito.inizio_dopo)}`,
              link: `/messaggi?r=${esito.request_id}&p=${esito.professional_id}`,
            })
          );
        }
      }
    } catch {
      // notifica non critica
    }
  }

  return NextResponse.json({ ok: true });
}
