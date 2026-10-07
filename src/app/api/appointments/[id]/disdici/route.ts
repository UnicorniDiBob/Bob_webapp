// POST /api/appointments/[id]/disdici  { motivo? }
// Il cliente disdice un appuntamento confermato, fuori dal preavviso
// fotografato alla conferma (appointments.cancellation_window_hours).
//
// LA DECISIONE NON E' PIU' QUI (113, 05/10). Controllo, scrittura, messaggio
// standard in chat e chiusura della richiesta stanno in una funzione sola del
// database, annulla_appuntamento(), la stessa che usa il professionista: due
// copie della regola prima o poi non sarebbero d'accordo sull'ultimo minuto.
// Gira con la sessione del cliente (non con il service role), cosi' il
// database sa chi ha disdetto e lo scrive nello storico.
//
// Questa route resta per due motivi: e' l'indirizzo che la pagina gia'
// chiama, e qui parte la copia per email quando la posta sara' accesa
// (src/lib/email.ts: oggi no).

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { buildEmail, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

// «motivo» non c'e' piu': dalla 116 il motivo e' facoltativo anche per il
// professionista, e il database non lo chiede a nessuno.
const STATO_PER_MOTIVO: Record<string, number> = {
  non_trovato: 404,
  non_attivo: 409,
  chiama: 409,
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

  let motivo: string | null = null;
  try {
    const body = (await request.json()) as { motivo?: unknown };
    motivo = typeof body.motivo === "string" ? body.motivo.slice(0, 500) : null;
  } catch {
    // Body vuoto: il motivo e' facoltativo (per il pro dalla 116).
  }

  const { data, error } = await supabase.rpc("annulla_appuntamento", {
    p_id: params.id,
    p_motivo: motivo,
    p_concordato_telefono: false,
  });
  if (error) {
    const stato = STATO_PER_MOTIVO[error.hint ?? ""];
    if (!stato) {
      console.error(`[disdici] annulla_appuntamento(${params.id}) ha fallito:`, error);
      return NextResponse.json({ error: "Disdetta non riuscita. Riprova." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message, motivo: error.hint }, { status: stato });
  }

  const esito = data as {
    ruolo: string;
    request_id: string | null;
    professional_id: string;
    customer_name: string | null;
    title: string | null;
    starts_at: string;
    richiesta_chiusa: boolean;
  };

  // Il pro annulla dal calendario e dal biglietto con la stessa funzione,
  // chiamata dal browser (lib/messages.ts). Se passa da qui l'annullamento
  // vale lo stesso; la copia per email qui sotto e' solo per il pro.
  if (esito.ruolo !== "customer") {
    return NextResponse.json({ ok: true, richiestaChiusa: esito.richiesta_chiusa });
  }

  // La copia per email, quando la posta e' accesa. Best effort: la disdetta
  // e' gia' valida e il messaggio in chat e' gia' scritto.
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
          const quando = new Date(esito.starts_at).toLocaleString("it-IT", {
            timeZone: "Europe/Rome",
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          await sendEmail(
            buildEmail("appointment_cancelled", to, {
              recipientName: null,
              senderName: esito.customer_name ?? null,
              serviceName: esito.title ?? null,
              cityName: null,
              preview: quando,
              link: esito.request_id
                ? `/messaggi?r=${esito.request_id}&p=${esito.professional_id}`
                : "/dashboard",
            })
          );
        }
      }
    } catch {
      // notifica non critica
    }
  }

  return NextResponse.json({ ok: true, richiestaChiusa: esito.richiesta_chiusa });
}
