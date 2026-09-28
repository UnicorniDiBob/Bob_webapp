import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { pubblicoPerRuolo, ultimaPubblicata } from "@/lib/termini/registro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/termini/accetta  { versione }
//
// Registra che l'utente autenticato accetta la versione dei termini pubblicata
// oggi per il suo pubblico. E' il MECCANISMO dell'accettazione successiva
// all'iscrizione (mig 100): la finestra che la chiede, e il testo che spiega
// cosa vuol dire accettare prima della data di efficacia, non stanno qui —
// sono parte del preavviso, e il preavviso e' una decisione di Lucio.
//
// PERCHE' PASSA DAL SERVER. terms_acceptances non ha nessuna policy di
// scrittura: una prova che il client puo' scrivere da solo non e' una prova.
// Qui l'utente e la versione si controllano, l'ora la mette il database e il
// commit online lo mette Vercel.
//
// COSA SI ACCETTA. Solo l'ultima versione pubblicata, e solo per il proprio
// pubblico: un professionista non accetta i termini dei clienti, nessuno
// accetta una versione vecchia o una non ancora pubblicata. Lo staff non ha un
// pubblico e riceve 403.
//
// IDEMPOTENTE. Se l'ultima accettazione registrata e' gia' questa versione,
// risponde ok senza scrivere un doppione.

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  let body: { versione?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }
  const versione = typeof body.versione === "string" ? body.versione : "";

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

  const { data: riga, error: ruoloErr } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (ruoloErr) {
    console.error(`[termini/accetta] lettura del ruolo fallita: ${ruoloErr.message}`);
    return NextResponse.json({ error: "Non riesco a leggere il tuo account." }, { status: 500 });
  }
  const pubblico = pubblicoPerRuolo(riga?.role);
  if (!pubblico) {
    return NextResponse.json(
      { error: "Questo account non accetta termini da qui." },
      { status: 403 }
    );
  }

  const corrente = ultimaPubblicata(pubblico);
  if (versione !== corrente.versione) {
    return NextResponse.json(
      {
        error: "Si può accettare solo la versione dei termini pubblicata oggi.",
        versioneCorrente: corrente.versione,
      },
      { status: 409 }
    );
  }

  const { data: ultima, error: ultimaErr } = await admin
    .from("terms_acceptances")
    .select("version")
    .eq("user_id", user.id)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultimaErr) {
    console.error(`[termini/accetta] lettura dello storico fallita: ${ultimaErr.message}`);
    return NextResponse.json({ error: "Non riesco a registrare l'accettazione." }, { status: 500 });
  }
  if (ultima?.version === corrente.versione) {
    return NextResponse.json({ ok: true, versione: corrente.versione, gia: true });
  }

  const { error: insErr } = await admin.from("terms_acceptances").insert({
    user_id: user.id,
    audience: pubblico,
    version: corrente.versione,
    method: "dialog",
    commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    effective_from: corrente.efficaceDal,
  });
  if (insErr) {
    console.error(`[termini/accetta] scrittura fallita: ${insErr.message}`);
    return NextResponse.json({ error: "Non riesco a registrare l'accettazione." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, versione: corrente.versione });
}
