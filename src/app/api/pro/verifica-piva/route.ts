// API: richiesta di verifica della partita IVA da parte di un professionista.
//
// POST /api/pro/verifica-piva   Body: { vatNumber: string }
//
// Flusso (i tre gradini descritti in docs/legal/VERIFICA_PIVA_come_farla.md):
//   1. checksum locale (gratis, immediato) → se fallisce si ferma qui
//   2. VIES (gratis, ~2-3 s) → se conferma, livello "Pro" concesso subito
//   3. se il VIES non conferma o è irraggiungibile, resta in attesa di esame
//      umano: MAI un rifiuto automatico (un pro regolare può non essere
//      iscritto al VIES, e un guasto del servizio non è colpa sua).
//
// Limite anti-abuso: massimo 3 tentativi ogni 24 ore per professionista.
//
// La scrittura su professional_verification passa dal service role perché la
// tabella non ha policy di insert/update: il professionista non può
// promuoversi da sé, può solo chiedere la verifica tramite questa route.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { vatValidationError, normalizeVat, nameLooksConsistent } from "@/lib/vat";
import { checkVatOnVies } from "@/lib/vies";

export const runtime = "nodejs";

const MAX_ATTEMPTS_24H = 3;

export async function POST(request: Request) {
  // --- 1. Autenticazione e identificazione del professionista ---
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: pro } = await supabase
    .from("professionals")
    .select("id, user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pro) {
    return NextResponse.json(
      { error: "Solo i profili professionali possono richiedere la verifica" },
      { status: 403 }
    );
  }

  // Nome sul profilo, per il confronto con la denominazione del registro.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // --- 2. Input ---
  let body: { vatNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const formatError = vatValidationError(body.vatNumber ?? "");
  if (formatError) {
    // Gradino 1 fallito: nessuna chiamata esterna, nessun consumo di tentativi.
    return NextResponse.json({ status: "invalid_format", message: formatError }, { status: 400 });
  }
  const vat = normalizeVat(body.vatNumber ?? "");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Servizio di verifica non configurato" },
      { status: 503 }
    );
  }
  const admin = createServiceClient(url, serviceKey);

  // --- 3. Limite anti-abuso: 3 tentativi / 24 h ---
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: recentAttempts } = await admin
    .from("verification_events")
    .select("*", { count: "exact", head: true })
    .eq("professional_id", pro.id)
    .eq("event", "vat_submitted")
    .gte("created_at", since);

  if ((recentAttempts ?? 0) >= MAX_ATTEMPTS_24H) {
    return NextResponse.json(
      {
        status: "rate_limited",
        message:
          "Hai già effettuato 3 tentativi nelle ultime 24 ore. Riprova domani o scrivici se il problema persiste.",
      },
      { status: 429 }
    );
  }

  // Registriamo il tentativo prima di chiamare l'esterno: così il limite vale
  // anche se la richiesta va in errore a metà.
  await admin.from("verification_events").insert({
    professional_id: pro.id,
    event: "vat_submitted",
    actor_user_id: user.id,
  });

  // --- 4. Gradino 2: VIES ---
  const outcome = await checkVatOnVies(vat);

  // Stato corrente, per registrare la transizione di livello.
  const { data: current } = await admin
    .from("professional_verification")
    .select("level")
    .eq("professional_id", pro.id)
    .maybeSingle();
  const fromLevel = current?.level ?? "none";

  if (outcome.status === "unavailable") {
    await admin.from("verification_events").insert({
      professional_id: pro.id,
      event: "vat_check_failed",
      note: `Servizio VIES non raggiungibile (${outcome.reason}). Da ritentare.`,
      actor_user_id: user.id,
    });
    // Salviamo comunque la P.IVA dichiarata: la verifica riprenderà da lì.
    await admin
      .from("professional_verification")
      .update({ vat_number: vat, updated_at: new Date().toISOString() })
      .eq("professional_id", pro.id);

    return NextResponse.json({
      status: "pending",
      message:
        "Il servizio di verifica europeo non è raggiungibile in questo momento. Abbiamo registrato la tua richiesta e la completiamo appena possibile: non serve fare altro.",
    });
  }

  const snap = outcome.snapshot;
  const nameMatches =
    snap.name && profile?.full_name
      ? nameLooksConsistent(profile.full_name, snap.name)
      : null;

  if (outcome.status === "confirmed") {
    // Concessione del livello. La discordanza di nome NON blocca (le ditte
    // individuali risultano col nome della persona, il profilo può avere un
    // nome commerciale): viene annotata per l'eventuale controllo umano.
    await admin
      .from("professional_verification")
      .update({
        level: "vat_verified",
        vat_number: vat,
        vat_active: true,
        vat_holder_name: snap.name,
        vat_checked_at: snap.requestDate ?? new Date().toISOString(),
        vat_check_source: "vies",
        vat_check_payload: snap,
        updated_at: new Date().toISOString(),
      })
      .eq("professional_id", pro.id);

    await admin.from("verification_events").insert([
      {
        professional_id: pro.id,
        event: "vat_check_ok",
        note: nameMatches === false
          ? `Confermata dal VIES come "${snap.name}", da verificare la corrispondenza col nome del profilo.`
          : `Confermata dal VIES come "${snap.name}".`,
        actor_user_id: user.id,
      },
      {
        professional_id: pro.id,
        event: "level_granted",
        from_level: fromLevel,
        to_level: "vat_verified",
        note: "Concesso automaticamente dopo riscontro positivo sul VIES.",
        actor_user_id: user.id,
      },
    ]);

    return NextResponse.json({
      status: "verified",
      level: "vat_verified",
      holderName: snap.name,
      checkedAt: snap.requestDate,
      nameMatches,
      message: `Partita IVA verificata: risulta attiva e intestata a "${snap.name}".`,
    });
  }

  // outcome.status === "not_confirmed": in attesa di esame umano, non rifiuto.
  await admin
    .from("professional_verification")
    .update({
      vat_number: vat,
      vat_active: false,
      vat_checked_at: snap.requestDate ?? new Date().toISOString(),
      vat_check_source: "vies",
      vat_check_payload: snap,
      updated_at: new Date().toISOString(),
    })
    .eq("professional_id", pro.id);

  await admin.from("verification_events").insert({
    professional_id: pro.id,
    event: "vat_check_failed",
    note: "Il VIES non ha confermato la partita IVA: può non essere iscritta alle operazioni intra-UE. Da esaminare manualmente.",
    actor_user_id: user.id,
  });

  return NextResponse.json({
    status: "needs_review",
    message:
      "La partita IVA è formalmente corretta ma non risulta nell'archivio europeo VIES: succede spesso a chi non lavora con l'estero. Abbiamo passato la richiesta al nostro team, che completa il controllo manualmente.",
  });
}
