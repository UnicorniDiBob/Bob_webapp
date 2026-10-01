// POST /api/appointments/[id]/disdici
// Il cliente disdice una prenotazione diretta, entro la finestra fissata al
// momento della prenotazione (appointments.cancellation_window_hours, 106).
//
// IL LIMITE E' QUI, NON NEL BOTTONE (01/10, Lucio). La pagina nasconde
// «Disdici» quando la finestra e' chiusa, ma un bottone che sparisce non e' un
// limite: la decisione la prende questa route, con l'ora del server. E non
// c'e' una strada laterale: il trigger appointments_customer_guard (031)
// consente al cliente, via PostgREST, solo proposed -> confirmed/declined,
// quindi una riga confermata il cliente non la puo' toccare se non da qui.
//
// Il controllo e la scrittura sono UNA istruzione: l'UPDATE vale solo se la
// riga e' ancora confermata e l'inizio e' ancora oltre il limite. Due
// richieste in parallelo, o una che arriva un secondo dopo la scadenza, non
// passano.

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { disdicibileFinoA } from "@/lib/disdettaPrenotazione";
import { buildEmail, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

  const { data: a } = await admin
    .from("appointments")
    .select(
      "id, professional_id, request_id, customer_id, customer_name, title, starts_at, duration_minutes, status, source, cancellation_window_hours"
    )
    .eq("id", params.id)
    .maybeSingle();
  // Stessa risposta per «non esiste» e «non e' tuo»: da fuori non si deve
  // poter sapere quali id esistono.
  if (!a || a.customer_id !== user.id) {
    return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }
  if (a.status !== "confirmed") {
    return NextResponse.json(
      { error: "Questa prenotazione non è più attiva." },
      { status: 409 }
    );
  }
  const finoA = disdicibileFinoA(a);
  if (!finoA) {
    return NextResponse.json(
      {
        error:
          "Questo appuntamento non si disdice da qui: scrivi al professionista in chat.",
      },
      { status: 409 }
    );
  }
  const adesso = new Date();
  if (adesso.getTime() > finoA.getTime()) {
    return NextResponse.json(
      {
        error: `Il termine per disdire era ${finoA.toLocaleString("it-IT", {
          timeZone: "Europe/Rome",
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })}: ormai va concordato con il professionista in chat.`,
      },
      { status: 409 }
    );
  }

  // Controllo e scrittura insieme: vale solo se nel frattempo non e' cambiato
  // niente e l'inizio e' ancora oltre la finestra, misurata adesso.
  const limiteInizio = new Date(
    adesso.getTime() + (a.cancellation_window_hours as number) * 3600 * 1000
  ).toISOString();
  const { data: aggiornate, error: updErr } = await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", a.id)
    .eq("status", "confirmed")
    .gte("starts_at", limiteInizio)
    .select("id");
  if (updErr) {
    return NextResponse.json({ error: "Disdetta non riuscita. Riprova." }, { status: 500 });
  }
  if (!aggiornate || aggiornate.length === 0) {
    return NextResponse.json(
      { error: "Nel frattempo la prenotazione è cambiata: ricarica la pagina." },
      { status: 409 }
    );
  }

  const quando = new Date(a.starts_at).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Il professionista lo legge dove si parlano: in chat. Best effort — la
  // disdetta e' gia' valida, un messaggio mancato non la annulla.
  if (a.request_id) {
    await admin.from("request_messages").insert({
      request_id: a.request_id,
      professional_id: a.professional_id,
      sender_type: "customer",
      sender_id: user.id,
      message: `Ho disdetto la prenotazione di ${quando}${
        a.title ? ` (${a.title})` : ""
      }.`,
    });
  }

  // E per email, se le email sono accese (transazionale, non promozionale).
  try {
    const { data: proRow } = await admin
      .from("professionals")
      .select("user_id")
      .eq("id", a.professional_id)
      .maybeSingle();
    const proUserId = (proRow as { user_id: string | null } | null)?.user_id;
    if (proUserId) {
      const { data: proUser } = await admin.auth.admin.getUserById(proUserId);
      const to = proUser.user?.email ?? null;
      if (to) {
        await sendEmail(
          buildEmail("appointment_cancelled", to, {
            recipientName: null,
            senderName: a.customer_name ?? null,
            serviceName: a.title ?? null,
            cityName: null,
            preview: quando,
            link: a.request_id
              ? `/messaggi?r=${a.request_id}&p=${a.professional_id}`
              : "/dashboard",
          })
        );
      }
    }
  } catch {
    // notifica non critica
  }

  return NextResponse.json({ ok: true });
}
