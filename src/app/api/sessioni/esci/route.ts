import { NextResponse } from "next/server";
import { decidiPromozione } from "@/lib/sessioni/attesa";
import {
  barattolo,
  chiudiSessione,
  rinnovaSulServer,
  revocaLocale,
  stessaOrigine,
} from "@/lib/sessioni/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/sessioni/esci  { quale: "questo" | "tutti" }
//
// «ESCI DA QUESTO» (decisione di Lucio, 29/09): esci dall'account attivo, in
// questo browser, e quello in attesa DIVENTA ATTIVO. Vuol dire «smetto questo
// cappello», non «me ne vado da Bob». Se l'altro non si rinnova, resta «da
// riconnettere» e non e' attivo nessuno.
// «ESCI DA TUTTI»: tutti e due gli account, in questo browser.
//
// SCOPE LOCALE, SEMPRE. Ogni sessione si chiude solo in questo browser: prima
// il logout usava lo scope predefinito di supabase-js, globale, e uscire dal
// portatile chiudeva anche il telefono. Cambio di comportamento per tutti gli
// utenti, scritto in docs/NOTE_E_DECISIONI.md (29/09). «Esci da tutti i
// dispositivi» e' una voce del Piano, non costruita.
export async function POST(request: Request) {
  if (!stessaOrigine(request)) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 403 });
  }
  let quale: unknown;
  try {
    quale = ((await request.json()) as { quale?: unknown }).quale;
  } catch {
    quale = undefined;
  }
  if (quale !== "questo" && quale !== "tutti") {
    return NextResponse.json({ error: "Specifica «questo» o «tutti»." }, { status: 400 });
  }

  const b = barattolo();
  const attivo = await b.attivo();
  const attesa = b.attesa();

  // 1) L'account attivo si chiude in questo browser, qualunque sia la scelta.
  if (attivo) {
    const chiusa = await chiudiSessione(attivo);
    if (!chiusa) console.error("[sessioni/esci] la sessione attiva non si e' revocata su Supabase: tolti comunque i cookie");
    b.scriviAttivo(null);
  }

  if (quale === "questo") {
    const p = await decidiPromozione(attesa, rinnovaSulServer);
    if (p.tipo === "promosso") {
      b.scriviAttivo(p.nuovoAttivo);
      b.scriviAttesa(null);
      return NextResponse.json({ ok: true, attivo: { email: p.nuovoAttivo.user.email ?? "" } });
    }
    if (p.tipo === "da_riconnettere") {
      b.scriviAttesa(p.nuovaAttesa);
      return NextResponse.json({ ok: true, attivo: null, daRiconnettere: p.nuovaAttesa.email });
    }
    return NextResponse.json({ ok: true, attivo: null });
  }

  // 2) «Tutti»: anche quello in attesa si chiude davvero su Supabase, non solo
  //    togliendo il cookie. Rinnovarlo qui serve solo a poterlo revocare.
  if (attesa?.refreshToken) {
    const r = await rinnovaSulServer(attesa.refreshToken);
    if (r && !(await revocaLocale(r.access_token))) {
      console.error("[sessioni/esci] la sessione in attesa non si e' revocata su Supabase: tolto comunque il cookie");
    }
  }
  b.scriviAttesa(null);
  return NextResponse.json({ ok: true, attivo: null });
}
