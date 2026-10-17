// POST /api/notify  { event, requestId, professionalId? }
// Notifica email transazionale: risolve il destinatario SERVER-SIDE (la
// controparte del thread, o i pro di una richiesta) e invia via Resend.
// Spenta finche' l'interruttore in src/lib/email.ts e' «spenta» (lo e' per
// scelta, dal 01/10), e comunque senza RESEND_API_KEY. Best-effort: risponde sempre 200, non
// blocca mai i flussi. Le email dei destinatari (auth.users) non escono
// mai dal server.

import { NextResponse } from "next/server";
import { chiamante } from "@/lib/supabase/chiamante";
import { emailEnabled, type NotifyEvent } from "@/lib/email";
import { notificaEvento } from "@/lib/notificaEvento";

export const runtime = "nodejs";

const EVENTS: NotifyEvent[] = [
  "new_request",
  "new_message",
  "appointment_proposed",
  "appointment_confirmed",
  "appointment_declined",
  // 107: annullato o spostato dal professionista. Il messaggio in chat lo
  // scrive il database; questa e' la copia per email, quando sara' accesa.
  "appointment_cancelled",
  "appointment_moved",
];

export async function POST(request: Request) {
  // Posta spenta (interruttore o chiave): rispondiamo subito, nessun lavoro inutile.
  if (!emailEnabled()) return NextResponse.json({ sent: false });

  let body: { event?: string; requestId?: string; professionalId?: string; preview?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ sent: false });
  }
  const event = body.event as NotifyEvent;
  if (!EVENTS.includes(event) || !body.requestId) {
    return NextResponse.json({ sent: false });
  }

  const { user } = await chiamante(request);
  if (!user) return NextResponse.json({ sent: false }, { status: 401 });

  const sent = await notificaEvento({
    userId: user.id,
    event,
    requestId: body.requestId,
    professionalId: body.professionalId,
    preview: body.preview,
  });
  return NextResponse.json({ sent });
}
