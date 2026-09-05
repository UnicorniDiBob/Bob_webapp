// GET /api/appuntamenti/[id]/ics
// L'appuntamento come file di calendario, per il cliente o per il pro.
//
// PERCHE' UNA ROTTA E NON UN BLOB NEL BROWSER. Un file costruito nel browser
// e scaricato con un blob: funziona male proprio dove serve di piu' — su
// iPhone Safari non lo apre nel Calendario, lo salva e basta. Una risposta
// text/calendar da un URL vero, invece, la aprono tutti: iOS la passa al
// Calendario, Android a quello di sistema, il desktop la scarica.
//
// PERMESSI: nessun controllo scritto qui. Si legge con la sessione della
// persona e decide la RLS, che su appointments ha gia' le tre regole giuste
// (il pro proprietario, il cliente della richiesta collegata — mig 021 — e il
// cliente della prenotazione diretta — mig 028). Se non ha diritto di vederlo,
// la select non torna niente e la rotta risponde 404: nessuna regola
// duplicata qui che possa allontanarsi da quelle.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { costruisciIcs } from "@/lib/ics";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, starts_at, duration_minutes, status, title, request_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!appt) {
    return NextResponse.json({ error: "Appuntamento non trovato" }, { status: 404 });
  }

  const a = appt as {
    id: string;
    starts_at: string;
    duration_minutes: number;
    status: string;
    title: string | null;
    request_id: string | null;
  };

  // Un appuntamento annullato o rifiutato non si aggiunge a un calendario:
  // non esiste piu'. Meglio dirlo che consegnare un evento fantasma.
  if (a.status === "cancelled" || a.status === "declined") {
    return NextResponse.json(
      { error: "Questo appuntamento non è più in programma" },
      { status: 409 }
    );
  }

  const inizio = new Date(a.starts_at);
  if (isNaN(inizio.getTime())) {
    return NextResponse.json({ error: "Data non valida" }, { status: 500 });
  }

  const sito = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.meetonda.com";

  const ics = costruisciIcs({
    // Stabile nel tempo: chi riscarica il file aggiorna l'evento che ha gia'
    // in calendario invece di ritrovarsene due.
    uid: `appuntamento-${a.id}@meetonda.com`,
    inizio,
    durataMinuti: a.duration_minutes,
    titolo: `${a.title?.trim() || "Appuntamento"} · BOB`,
    url: a.request_id ? `${sito}/messaggi?r=${a.request_id}` : `${sito}/dashboard`,
    daConfermare: a.status === "proposed",
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="appuntamento-bob.ics"`,
      // Il file dipende dalla sessione: nessuna cache condivisa.
      "Cache-Control": "private, no-store",
    },
  });
}
