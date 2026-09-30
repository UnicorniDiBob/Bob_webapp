import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readBodyWithLimit } from "@/lib/rate-limit";
import { decidiDopoLogin, puoTentare } from "@/lib/sessioni/aggiungi";
import { barattolo, revocaLocale, rinnovaSulServer, stessaOrigine } from "@/lib/sessioni/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/sessioni/adotta  { refresh_token }
//
// L'ULTIMO PASSO DI «AGGIUNGI UN ALTRO ACCOUNT» (30/09, R6). L'accesso vero e
// proprio avviene nel pannello di /login in modalita' «aggiungi», su un client
// Supabase che vive solo in memoria e non scrive i cookie dell'account attivo
// (AccessoAggiuntivo). Qui arriva solo il refresh token della sessione appena
// nata: MAI una password. Cosi' qualunque seconda prova — 2FA, link magico,
// Google — avviene prima, nel pannello, e questa route non cambia.
//
// Prima era /api/sessioni/aggiungi { email, password }, con il login sul
// server: con la 2FA la seconda prova non avrebbe avuto dove avvenire. E' stata
// tolta con questa route.
//
// IL TOKEN SI RINNOVA SUBITO, e per due ragioni: prova che e' vero (scaduto,
// gia' revocato o inventato -> non si scrive niente) e fa dire a Supabase di
// chi e' l'account, invece di fidarsi della pagina. Quello che finisce in
// bob-attesa e' il token nuovo, che non passa dal browser.
// COSA NON FA, misurato il 30/09: non spegne quello vecchio. Con le
// impostazioni di questo progetto Supabase il token inviato dalla pagina si
// rinnova ancora dopo 20 secondi (roadmap/findings.csv). Resta esposto quanto
// quelli dell'account attivo, che stanno gia' in cookie leggibili dal
// JavaScript (NOTE_E_DECISIONI 29/09), e in piu' ha vissuto solo in memoria.
//
// Niente tetto di tentativi qui: le password le prova Supabase, con i suoi
// limiti, e un refresh token non si indovina.
const MAX_CORPO = 4096;
const ERRORE_ACCESSO = "L'accesso non è andato a buon fine. Riprova.";

export async function POST(request: Request) {
  if (!stessaOrigine(request)) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 403 });
  }

  const corpo = await readBodyWithLimit(request, MAX_CORPO);
  if (!corpo.ok) return NextResponse.json({ error: "Richiesta non valida." }, { status: 413 });
  let refreshToken = "";
  try {
    const j = JSON.parse(corpo.text) as { refresh_token?: unknown };
    refreshToken = typeof j.refresh_token === "string" ? j.refresh_token : "";
  } catch {
    // corpo non JSON: trattato come campo vuoto, sotto
  }
  if (!refreshToken || refreshToken.length > 1024) {
    return NextResponse.json({ error: ERRORE_ACCESSO }, { status: 400 });
  }

  // Chi e' attivo lo dice il punto unico.
  const {
    data: { user: attivo },
  } = await createClient().auth.getUser();
  const b = barattolo();
  const attesa = b.attesa();
  const prima = puoTentare(attivo?.id ?? null, attesa);
  if (!prima.ok) {
    return NextResponse.json(
      {
        error:
          prima.motivo === "nessun_attivo"
            ? "Per aggiungere un account devi essere già dentro con un altro."
            : "In questo browser c'è già un secondo account: esci da quello prima di aggiungerne un altro.",
      },
      { status: 409 }
    );
  }

  const esito = decidiDopoLogin(attivo!.id, attesa, await rinnovaSulServer(refreshToken));

  switch (esito.tipo) {
    case "credenziali":
      // NIENTE da scrivere: bob-attesa resta com'era.
      return NextResponse.json({ error: ERRORE_ACCESSO }, { status: 401 });
    case "stesso_account":
      await revocaLocale(esito.daRevocare);
      return NextResponse.json({ error: "È l'account con cui sei già dentro." }, { status: 409 });
    case "altro_da_riconnettere":
      await revocaLocale(esito.daRevocare);
      return NextResponse.json(
        { error: "C'è un altro account da riconnettere in questo browser: riconnetti quello, o esci da quello prima." },
        { status: 409 }
      );
    case "aggiunto":
      b.scriviAttesa(esito.attesa);
      return NextResponse.json({ ok: true, attesa: { email: esito.attesa.email } });
  }
}
