// Esecuzione delle cancellazioni scadute.
//
// GET /api/cron/cancella-account — la chiama Vercel una volta al giorno.
//
// La richiesta ha spento il profilo subito; qui, passata la finestra di
// ripensamento, l'account viene cancellato davvero. La cancellazione di
// auth.users porta via tutto il resto per cascata (verificato vincolo per
// vincolo il 19/08), tranne due cose che vanno fatte a mano e che la cascata
// non conosce:
//   - i FILE nello storage, che non sono righe di database: verifica-documenti,
//     portfolio e brief-photos, cartella dell'utente e foto della chat citate
//     nei suoi job_briefs (src/lib/fileUtente.ts, dal 16/10; prima solo
//     verifica-documenti, e solo i primi 100 file — ROPA A28);
//   - i BRIEF del cliente (job_briefs): si cancellano per intero prima di
//     deleteUser, perche' job_briefs.user_id e' ON DELETE SET NULL e la
//     cascata li lascerebbe anonimi. Nessuna copia de-identificata
//     (decisione del 17/10, docs/legal/DECISIONE_conservazione_garanzia.md);
//   - niente altro: le recensioni restano di proposito, de-identificate dalla
//     056 (customer_id a NULL), perche' appartengono anche al professionista
//     che le ha ricevute.
//
// REGISTRA SEMPRE UN GIRO, anche a vuoto e anche in errore. Il cron gemello
// (verifica-piva) scriveva la riga solo sul ramo "niente da fare": undici notti
// di semaforo verde che dimostravano solo che il processo partiva. Qui no.
//
// Protezione: come l'altro cron, Authorization con CRON_SECRET. Senza segreto
// configurato la route rifiuta di lavorare — e su una route che CANCELLA
// account questo conta molto piu' che altrove.

import { NextResponse } from "next/server";
import { svuotaFileUtente } from "@/lib/fileUtente";
import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quante cancellazioni per giro: sono irreversibili, meglio a piccoli passi. */
const MAX_PER_RUN = 25;

async function registraGiro(
  admin: SupabaseClient,
  dati: {
    started_at: string;
    ok: boolean;
    outcome?: Record<string, number>;
    error?: string | null;
  }
) {
  try {
    await admin.from("system_job_runs").insert({
      job: "cancella-account",
      started_at: dati.started_at,
      finished_at: new Date().toISOString(),
      ok: dati.ok,
      outcome: dati.outcome ?? null,
      error: dati.error ?? null,
    });
  } catch {
    // Se non riesco a registrare il giro non devo far fallire il giro.
  }
}

export async function GET(request: Request) {
  const inizioGiro = new Date().toISOString();

  const segreto = process.env.CRON_SECRET;
  if (!segreto) {
    return NextResponse.json(
      { error: "CRON_SECRET non configurato: la cancellazione resta spenta." },
      { status: 503 }
    );
  }
  const atteso = `Bearer ${segreto}`;
  if (request.headers.get("authorization") !== atteso) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Configurazione mancante" }, { status: 503 });
  }
  const admin = createServiceClient(url, key, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin
    .from("account_deletion_requests")
    .select("user_id, scheduled_for")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    await registraGiro(admin, {
      started_at: inizioGiro,
      ok: false,
      error: error.message,
    });
    return NextResponse.json({ error: "Lettura della coda fallita" }, { status: 500 });
  }

  const scadute = (data ?? []) as { user_id: string; scheduled_for: string }[];

  if (scadute.length === 0) {
    await registraGiro(admin, {
      started_at: inizioGiro,
      ok: true,
      outcome: { scadute: 0, cancellati: 0, falliti: 0 },
    });
    return NextResponse.json({ ok: true, cancellati: 0 });
  }

  let cancellati = 0;
  let falliti = 0;
  let fileRimossi = 0;
  const errori: string[] = [];

  for (const riga of scadute) {
    // Prima i file, poi l'account: se cancellassi prima l'account perderei
    // l'unica cosa che mi dice quale cartella svuotare — e job_briefs.user_id
    // andrebbe a NULL, quindi anche quali foto della chat erano sue.
    // Un bucket che non risponde non blocca una cancellazione dovuta: il file
    // orfano lo segnaliamo con il contatore, l'account va via.
    const file = await svuotaFileUtente(admin, riga.user_id);
    fileRimossi += Object.values(file.rimossi).reduce((a, n) => a + n, 0);
    if (file.errori.length > 0) {
      errori.push(`storage:${riga.user_id.slice(0, 8)}`);
      // Il motivo, non solo il prefisso: il 16/10 un errore di query restava
      // muto dietro «storage:…». I messaggi non contengono dati personali.
      console.error(`[cancella-account] file di ${riga.user_id.slice(0, 8)}:`, file.errori.join("; "));
    }

    // I brief si cancellano per intero (decisione del 17/10): oggi nessun
    // lavoro e' coperto dalla Garanzia Bob, quindi non c'e' niente che la
    // legge imponga di tenere. L'unica chiave esterna verso job_briefs e'
    // requests.brief_id, ON DELETE SET NULL: le richieste del cliente perdono
    // il collegamento e poi vanno via con deleteUser (customer_id CASCADE);
    // i trigger BEFORE UPDATE di requests col service role lasciano passare
    // (verificato sulla produzione il 17/10). Una sola DELETE: o tutti o
    // nessuno. Va fatto DOPO i file, che si ritrovano proprio dai brief, e
    // PRIMA di deleteUser, che li lascerebbe anonimi e irraggiungibili.
    // Se non riesce l'account non si cancella stanotte: si riprova domani.
    const { error: briefErr } = await admin
      .from("job_briefs")
      .delete()
      .eq("user_id", riga.user_id);
    if (briefErr) {
      falliti++;
      errori.push(`brief:${riga.user_id.slice(0, 8)}`);
      console.error(`[cancella-account] brief di ${riga.user_id.slice(0, 8)}:`, briefErr.message);
      continue;
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(riga.user_id);
    if (delErr) {
      falliti++;
      errori.push(`auth:${riga.user_id.slice(0, 8)}`);
      continue;
    }
    cancellati++;
  }

  await registraGiro(admin, {
    started_at: inizioGiro,
    ok: falliti === 0,
    outcome: { scadute: scadute.length, cancellati, falliti, file_rimossi: fileRimossi },
    error: errori.length > 0 ? errori.join(", ") : null,
  });

  return NextResponse.json({ ok: falliti === 0, cancellati, falliti });
}
