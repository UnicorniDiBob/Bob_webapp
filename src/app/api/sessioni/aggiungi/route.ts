import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { extractClientIp, readBodyWithLimit } from "@/lib/rate-limit";
import {
  ERRORE_CREDENZIALI,
  ERRORE_TROPPI,
  decidiDopoLogin,
  puoTentare,
} from "@/lib/sessioni/aggiungi";
import { accediIsolato, barattolo, revocaLocale, stessaOrigine } from "@/lib/sessioni/server";
import {
  LIMITI_ACCESSO,
  chiaveEmail,
  chiaveIp,
  segretoValido,
  tentativoAmmesso,
} from "@/lib/sessioni/tetto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/sessioni/aggiungi  { email, password }
//
// Mette un secondo account nel browser, IN ATTESA, senza toccare quello attivo;
// oppure riconnette quello «da riconnettere». E' una superficie che accetta
// una password e prima non esisteva, quindi i vincoli di Lucio (29/09):
//   - se il login fallisce non si tocca NIENTE, nemmeno bob-attesa;
//   - un tetto di tentativi per IP e per email (HMAC, mai in chiaro: tetto.ts,
//     migrazione 104), controllato PRIMA del login;
//   - errore IDENTICO per email sbagliata e password sbagliata;
//   - la password (e l'email) fuori da ogni log: qui non si registra mai il
//     corpo della richiesta, nemmeno in caso di errore.
const MAX_CORPO = 4096;

export async function POST(request: Request) {
  if (!stessaOrigine(request)) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 403 });
  }

  // Senza la chiave HMAC non si parte: ripiegare su un hash nudo farebbe della
  // tabella dei contatori l'elenco di chi ha provato a entrare.
  const segreto = process.env.ACCESSO_HMAC_SEGRETO;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segretoValido(segreto) || !url || !serviceKey) {
    console.error("[sessioni/aggiungi] configurazione mancante (ACCESSO_HMAC_SEGRETO o chiavi Supabase): rifiuto");
    return NextResponse.json({ error: "Servizio momentaneamente non disponibile." }, { status: 503 });
  }

  const corpo = await readBodyWithLimit(request, MAX_CORPO);
  if (!corpo.ok) return NextResponse.json({ error: "Richiesta non valida." }, { status: 413 });
  let email = "";
  let password = "";
  try {
    const j = JSON.parse(corpo.text) as { email?: unknown; password?: unknown };
    email = typeof j.email === "string" ? j.email.trim() : "";
    password = typeof j.password === "string" ? j.password : "";
  } catch {
    // corpo non JSON: trattato come campi vuoti, sotto
  }
  if (!email || !password || email.length > 320 || password.length > 1024) {
    return NextResponse.json({ error: ERRORE_CREDENZIALI }, { status: 400 });
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

  // Il tetto PRIMA del login: si contano i tentativi, non solo quelli falliti.
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } });
  const [perIp, perEmail] = await Promise.all([
    tentativoAmmesso(admin, chiaveIp(extractClientIp(request)), LIMITI_ACCESSO.ip),
    tentativoAmmesso(admin, chiaveEmail(email, segreto), LIMITI_ACCESSO.email),
  ]);
  if (!perIp || !perEmail) {
    return NextResponse.json({ error: ERRORE_TROPPI }, { status: 429, headers: { "retry-after": "60" } });
  }

  const esito = decidiDopoLogin(attivo!.id, attesa, await accediIsolato(email, password));

  switch (esito.tipo) {
    case "credenziali":
      // NIENTE da scrivere: bob-attesa resta com'era.
      return NextResponse.json({ error: ERRORE_CREDENZIALI }, { status: 401 });
    case "stesso_account":
      await revocaLocale(esito.daRevocare);
      return NextResponse.json({ error: "È l'account con cui sei già dentro." }, { status: 409 });
    case "altro_da_riconnettere":
      await revocaLocale(esito.daRevocare);
      return NextResponse.json(
        { error: "C'è un altro account da riconnettere in questo browser: riconnetti quello, o esci da tutti prima." },
        { status: 409 }
      );
    case "aggiunto":
      b.scriviAttesa(esito.attesa);
      return NextResponse.json({ ok: true, attesa: { email: esito.attesa.email } });
  }
}
