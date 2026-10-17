import { NextResponse } from "next/server";
import {
  CACHE_ERRORE,
  CACHE_OK,
  isPubblico,
  versioneCorrente,
} from "@/lib/termini/testoPerApp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/termini/corrente?pubblico=customer|professional
//
// La versione dei termini pubblicata oggi per un pubblico: la stessa che
// mostra /termini[/professionisti] e che accetta chi si iscrive dal sito
// (ultimaPubblicata nel registro). Il testo si chiede poi a
// /api/termini/[versione]. E' UN CONTRATTO CON L'APP (Bob_app), come quella.
//
// «corrente» non e' una versione: il segmento statico vince su [versione], e
// il formato delle versioni (AAAA-MM-vN) non puo' mai valere «corrente».
//
// PUBBLICA, SENZA LOGIN, stessa cache dell'altra route: dipende dall'ora della
// richiesta (pubblicazione programmata), quindi niente risposta costruita al
// build.
//
// RISPOSTE.
//   200  { versione, pubblico, pubblicataIl }
//   400  pubblico mancante o diverso da customer/professional
//   404  nessuna versione pubblicata per quel pubblico (oggi non succede)

export function GET(request: Request) {
  const pubblico = new URL(request.url).searchParams.get("pubblico");
  if (!isPubblico(pubblico)) {
    return NextResponse.json(
      { error: "Parametro pubblico mancante o non valido: customer o professional." },
      { status: 400, headers: { "Cache-Control": CACHE_ERRORE } }
    );
  }

  const corrente = versioneCorrente(pubblico);
  if (!corrente) {
    return NextResponse.json(
      { error: "Nessuna versione dei termini pubblicata." },
      { status: 404, headers: { "Cache-Control": CACHE_ERRORE } }
    );
  }

  return NextResponse.json(corrente, { headers: { "Cache-Control": CACHE_OK } });
}
