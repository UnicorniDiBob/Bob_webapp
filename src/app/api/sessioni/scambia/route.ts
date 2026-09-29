import { NextResponse } from "next/server";
import { decidiScambio } from "@/lib/sessioni/attesa";
import { barattolo, rinnovaSulServer, stessaOrigine } from "@/lib/sessioni/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/sessioni/scambia — l'account in attesa diventa attivo, e
// quello attivo va in attesa.
//
// L'ATTIVO NON SI TOCCA (decisione 3): il suo refresh token va in bob-attesa
// cosi' com'e', senza rinnovarlo. Si rinnova solo quello in attesa, adesso che
// ci si torna sopra. Se non si rinnova, quell'account diventa «da
// riconnettere» e la sessione attiva resta esattamente com'era: nessun cookie
// sb- viene scritto. La decisione sta in decidiScambio() (lib/sessioni/attesa),
// che ha i test.
//
// Il middleware non passa di qui (matcher in src/middleware.ts): nella stessa
// richiesta rinnoverebbe l'attivo e scriverebbe i suoi cookie contro i nostri.
export async function POST(request: Request) {
  if (!stessaOrigine(request)) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 403 });
  }
  const b = barattolo();
  const esito = await decidiScambio(await b.attivo(), b.attesa(), rinnovaSulServer);

  switch (esito.tipo) {
    case "scambiato":
      b.scriviAttivo(esito.nuovoAttivo);
      b.scriviAttesa(esito.nuovaAttesa);
      return NextResponse.json({ ok: true, attivo: { email: esito.nuovoAttivo.user.email ?? "" } });
    case "da_riconnettere":
      b.scriviAttesa(esito.nuovaAttesa);
      return NextResponse.json(
        { ok: false, motivo: "da_riconnettere", email: esito.nuovaAttesa.email },
        { status: 409 }
      );
    case "stesso_account":
      return NextResponse.json({ ok: false, motivo: "stesso_account" }, { status: 409 });
    case "nessuna_attesa":
      return NextResponse.json({ ok: false, motivo: "nessuna_attesa" }, { status: 409 });
  }
}
