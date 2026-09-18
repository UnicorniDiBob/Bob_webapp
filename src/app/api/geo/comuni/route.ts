import { NextResponse } from "next/server";
import {
  cercaComuni,
  comunePerIstat,
  comuniPerCap,
  regioni,
} from "@/lib/comuni";

export const runtime = "nodejs";

// L'elenco dei comuni italiani, per il campo «dove hai la tua base».
//
// PERCHÉ UNA ROTTA E NON UN IMPORT. Il file generato
// (src/lib/data/comuni-italia.json) pesa 900 KB: 7.904 comuni con i loro CAP.
// Importarlo da un componente del browser vorrebbe dire spedirlo a chiunque
// apra l'iscrizione, per un campo di ricerca. Qui resta sul server e passa
// solo quello che serve: al massimo venti righe per volta.
//
// NESSUN DATO PERSONALE, IN NESSUNA DIREZIONE. Si leggono nomi di comuni e
// CAP — geografia pubblica. Non c'è niente da proteggere e niente da
// registrare: nessun terzo, nessuna chiamata in uscita, il file è nostro.
//
// Cache lunga, di proposito: l'elenco cambia quando cambiano i comuni
// d'Italia, cioè quasi mai, e lo aggiorna uno script committato.

const CACHE = "public, max-age=3600, stale-while-revalidate=86400";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const istat = (url.searchParams.get("istat") ?? "").trim();
  const cap = (url.searchParams.get("cap") ?? "").trim();
  const regione = (url.searchParams.get("regione") ?? "").trim();
  const elenco = url.searchParams.get("elenco");

  if (elenco === "regioni") {
    return NextResponse.json({ regioni: regioni() }, { headers: { "Cache-Control": CACHE } });
  }

  if (istat) {
    const comune = comunePerIstat(istat);
    if (!comune) {
      return NextResponse.json({ error: "Comune sconosciuto" }, { status: 404 });
    }
    return NextResponse.json({ comune }, { headers: { "Cache-Control": CACHE } });
  }

  if (cap) {
    // Un CAP può stare su più comuni (e a Milano un comune ha 42 CAP): si
    // risponde con l'elenco, e a scegliere è la persona.
    return NextResponse.json(
      { comuni: comuniPerCap(cap) },
      { headers: { "Cache-Control": CACHE } }
    );
  }

  // Meno di due lettere non è una ricerca: è l'intero elenco travestito.
  if (q.length < 2 && !regione) {
    return NextResponse.json({ comuni: [] }, { headers: { "Cache-Control": CACHE } });
  }

  return NextResponse.json(
    { comuni: cercaComuni(q, { regione, limite: 20 }) },
    { headers: { "Cache-Control": CACHE } }
  );
}
