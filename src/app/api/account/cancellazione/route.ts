import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { GIORNI_RIPENSAMENTO, motivoValido } from "@/lib/cancellazione";

export const runtime = "nodejs";

// Richiesta e annullamento della cancellazione dell'account.
//
// POST   apre la richiesta: spegne subito il profilo e fissa la scadenza.
// DELETE annulla: cancella la richiesta e riaccende il profilo.
//
// PERCHE' PASSA DA QUI E NON DAL CLIENT
// Tre cose devono avvenire insieme, e due il client non puo' farle: creare la
// richiesta, spegnere il professionista (le colonne di professionals sono
// protette dal trigger protect_professional_columns) e registrare il motivo in
// forma anonima. Se una sola andasse a buon fine il risultato sarebbe peggiore
// di niente: un account spento che nessuno cancellera', o una cancellazione in
// corso su un profilo ancora visibile.
//
// LA PASSWORD SI RICHIEDE, IL MOTIVO NO.
// Non e' un'incoerenza. La password non e' un ostacolo all'esercizio del
// diritto: e' la prova che chi lo esercita e' la persona giusta — senza, chi
// trova un telefono sbloccato puo' cancellare l'account di un altro, e sarebbe
// un danno irreversibile. Il motivo invece non aggiunge nessuna garanzia: solo
// attrito su un diritto che l'art. 12(2) GDPR ci obbliga ad agevolare.


function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  let body: { password?: string; reasonCode?: string; reasonNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Devi essere autenticato." }, { status: 401 });
  }

  const password = body.password ?? "";
  if (!password) {
    return NextResponse.json(
      { error: "Serve la tua password per confermare." },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = serviceClient();
  if (!url || !anonKey || !admin) {
    return NextResponse.json(
      { error: "Servizio momentaneamente non disponibile." },
      { status: 503 }
    );
  }

  // Verifica della password su un client separato e senza sessione persistente:
  // non deve toccare i cookie di chi sta navigando.
  const verifica = createServiceClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { error: authErr } = await verifica.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (authErr) {
    return NextResponse.json(
      { error: "La password non è corretta." },
      { status: 403 }
    );
  }

  // Lo staff non si cancella da qui: un admin che si autocancella si porta via
  // anche l'accesso al pannello, e quella e' una decisione da prendere in due.
  const { data: userRow } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (userRow as { role?: string } | null)?.role ?? "customer";
  if (role === "admin" || role === "cs") {
    return NextResponse.json(
      {
        error:
          "Gli account dello staff non si cancellano da qui: scrivi a un altro amministratore.",
      },
      { status: 403 }
    );
  }

  // Un motivo fuori elenco non e' un errore da mostrare: e' un campo
  // facoltativo che si ignora. Bloccare qui vorrebbe dire impedire una
  // cancellazione per un dato che non serviva.
  const reasonCode = motivoValido(body.reasonCode) ? body.reasonCode : null;
  const reasonNote = (body.reasonNote ?? "").trim().slice(0, 1000) || null;

  const scheduledFor = new Date(
    Date.now() + GIORNI_RIPENSAMENTO * 24 * 60 * 60 * 1000
  ).toISOString();

  // upsert: chi clicca due volte non deve ottenere un errore, e la scadenza
  // riparte dall'ultima richiesta.
  const { error: reqErr } = await admin.from("account_deletion_requests").upsert(
    {
      user_id: user.id,
      requested_at: new Date().toISOString(),
      scheduled_for: scheduledFor,
      reason_code: reasonCode,
      reason_note: reasonNote,
    },
    { onConflict: "user_id" }
  );
  if (reqErr) {
    return NextResponse.json(
      { error: "Non sono riuscito a registrare la richiesta. Riprova." },
      { status: 500 }
    );
  }

  // Spegnimento immediato: da adesso il profilo esce dagli elenchi. Se questo
  // fallisse avremmo una cancellazione in corso su un profilo ancora visibile,
  // quindi l'errore va detto, non ingoiato.
  if (role === "professional") {
    const { error: offErr } = await admin
      .from("professionals")
      .update({ deactivated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (offErr) {
      await admin.from("account_deletion_requests").delete().eq("user_id", user.id);
      return NextResponse.json(
        {
          error:
            "Non sono riuscito a disattivare il tuo profilo, quindi non ho registrato la richiesta. Riprova.",
        },
        { status: 500 }
      );
    }
  }

  // Il motivo, senza la persona. Best-effort: se non riesce, la cancellazione
  // resta valida — una statistica non vale il diritto di nessuno.
  if (reasonCode) {
    await admin
      .from("account_deletion_reasons")
      .insert({ reason_code: reasonCode, role });
  }

  return NextResponse.json({ ok: true, scheduledFor });
}

export async function DELETE() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Devi essere autenticato." }, { status: 401 });
  }

  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Servizio momentaneamente non disponibile." },
      { status: 503 }
    );
  }

  const { error } = await admin
    .from("account_deletion_requests")
    .delete()
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json(
      { error: "Non sono riuscito ad annullare. Riprova." },
      { status: 500 }
    );
  }

  // Riaccende. Nessun controllo sul ruolo: se non e' un professionista non c'e'
  // nessuna riga da aggiornare e l'update non fa niente.
  await admin
    .from("professionals")
    .update({ deactivated_at: null })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
