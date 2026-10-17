import { NextResponse } from "next/server";
import { isPubblico, testoTermini } from "@/lib/termini/testoPerApp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/termini/[versione]?pubblico=customer|professional
//
// Il solo testo di una versione dei termini, per l'app (Bob_app). E' UN
// CONTRATTO CON L'APP: la forma della risposta non cambia senza cambiare anche
// Bob_app. Il testo viene dagli stessi componenti della pagina
// /termini/<versione> (vedi lib/termini/testoPerApp).
//
// PUBBLICA, SENZA LOGIN: i termini si leggono prima di iscriversi.
//
// RISPOSTE.
//   200  { versione, pubblico, pubblicataIl, html }
//   400  pubblico mancante o diverso da customer/professional
//   404  versione inesistente, non di quel pubblico o non ancora pubblicata —
//        come la pagina: l'archivio non anticipa
//
// DINAMICA E CON CACHE BREVE. Quale versione esiste dipende dall'ora della
// richiesta (pubblicazione programmata, vedi registro.ts): una risposta
// costruita al build ignorerebbe la data. Cinque minuti di cache sono il
// ritardo massimo con cui una versione appena pubblicata arriva all'app.

const CACHE_OK = "public, max-age=300, s-maxage=300";
const CACHE_ERRORE = "public, max-age=60, s-maxage=60";

export async function GET(request: Request, { params }: { params: { versione: string } }) {
  const pubblico = new URL(request.url).searchParams.get("pubblico");
  if (!isPubblico(pubblico)) {
    return NextResponse.json(
      { error: "Parametro pubblico mancante o non valido: customer o professional." },
      { status: 400, headers: { "Cache-Control": CACHE_ERRORE } }
    );
  }

  const testo = await testoTermini(pubblico, params.versione);
  if (!testo) {
    return NextResponse.json(
      { error: "Versione dei termini non trovata." },
      { status: 404, headers: { "Cache-Control": CACHE_ERRORE } }
    );
  }

  return NextResponse.json(testo, { headers: { "Cache-Control": CACHE_OK } });
}
