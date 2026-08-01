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

  // Stato corrente: serve per la transizione di livello e per non rovinare una
  // verifica già ottenuta con un tentativo nuovo (vedi il controllo qui sotto).
  const { data: current } = await admin
    .from("professional_verification")
    .select("level")
    .eq("professional_id", pro.id)
    .maybeSingle();
  const fromLevel = (current?.level ?? "none") as
    | "none"
    | "vat_verified"
    | "documents_verified";

  // Chi è già verificato non ripassa da qui. Senza questo controllo un secondo
  // tentativo non confermato riscriverebbe la data del riscontro lasciando il
  // livello in piedi: il badge pubblico direbbe "Pro · oggi" sulla base di un
  // controllo fallito. Un cambio di partita IVA lo gestisce lo staff.
  if (fromLevel !== "none") {
    return NextResponse.json(
      {
        status: "already_verified",
        message:
          "Il tuo profilo risulta già verificato. Se la tua partita IVA è cambiata, scrivici: la aggiorniamo noi dopo un controllo.",
      },
      { status: 409 }
    );
  }

  // Nessuno può rivendicare una partita IVA già attribuita a un altro profilo:
  // sarebbe il modo più semplice per appropriarsi dell'identità fiscale di un
  // concorrente. Se succede, non è un errore di battitura: va guardato.
  const { data: claimed } = await admin
    .from("professional_verification")
    .select("professional_id")
    .eq("vat_number", vat)
    .neq("professional_id", pro.id)
    .not("level", "eq", "none")
    .maybeSingle();

  if (claimed) {
    await admin.from("verification_events").insert({
      professional_id: pro.id,
      event: "vat_check_failed",
      note: "Tentativo di comunicare una partita IVA già attribuita a un altro profilo verificato.",
      actor_user_id: user.id,
      actor_name: profile?.full_name ?? "Professionista",
      actor_role: "professional",
    });
    return NextResponse.json(
      {
        status: "already_claimed",
        message:
          "Questa partita IVA risulta già associata a un altro profilo verificato. Se è la tua, scrivici: controlliamo noi e sistemiamo.",
      },
      { status: 409 }
    );
  }

  // Registriamo il tentativo prima di chiamare l'esterno: così il limite vale
  // anche se la richiesta va in errore a metà. Se questa scrittura fallisce il
  // limite non varrebbe più: meglio fermarsi che restare senza freno.
  const { error: attemptError } = await admin
    .from("verification_events")
    .insert({
      professional_id: pro.id,
      event: "vat_submitted",
      actor_user_id: user.id,
      actor_name: profile?.full_name ?? "Professionista",
      actor_role: "professional",
    });
  if (attemptError) {
    return NextResponse.json(
      {
        error:
          "Non sono riuscito a registrare la richiesta. Riprova tra poco: se il problema resta, scrivici.",
      },
      { status: 500 }
    );
  }

  // --- 4. Gradino 2: VIES ---
  const outcome = await checkVatOnVies(vat);

  // Una scrittura che fallisce in silenzio direbbe al pro "verificata" con il
  // database invariato: qui l'errore si vede.
  const failedWrite = () =>
    NextResponse.json(
      {
        error:
          "Il controllo è stato eseguito ma non sono riuscito a salvarne l'esito. Riprova: se il problema resta, scrivici.",
      },
      { status: 500 }
    );

  if (outcome.status === "unavailable") {
    await admin.from("verification_events").insert({
      professional_id: pro.id,
      event: "vat_check_failed",
      note: `Servizio VIES non raggiungibile (${outcome.reason}). Da ritentare.`,
      actor_user_id: user.id,
      actor_name: profile?.full_name ?? "Professionista",
      actor_role: "professional",
    });
    // Salviamo comunque la P.IVA dichiarata: la verifica riprenderà da lì.
    // vat_review_state = 'pending' (migration 034) la mette nella coda umana:
    // finché non esiste un ritentativo automatico, il caso deve comunque
    // finire davanti a qualcuno. Azzeriamo l'esito precedente: non abbiamo
    // controllato niente, e l'operatore non deve leggere "confermata" su un
    // caso che è in coda proprio perché il controllo non è avvenuto.
    const { error: writeError } = await admin
      .from("professional_verification")
      .update({
        vat_number: vat,
        vat_active: null,
        vat_holder_name: null,
        vat_check_source: null,
        vat_review_state: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("professional_id", pro.id);
    if (writeError) return failedWrite();

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

  if (outcome.status === "confirmed" && nameMatches !== true) {
    // IL PUNTO PIÙ IMPORTANTE DI TUTTO IL FLUSSO.
    // "Esiste" non vuol dire "è sua": il VIES conferma che quel numero è
    // valido, non che appartiene a chi lo sta digitando. Senza il riscontro
    // sull'intestazione, chiunque potrebbe incollare la partita IVA di
    // un'azienda vera e prendersi il badge. Quindi la concessione automatica
    // avviene SOLO quando la denominazione del registro somiglia al nome del
    // profilo; in tutti gli altri casi — nomi diversi, o denominazione non
    // restituita — il caso va all'esame umano, che è esattamente ciò per cui
    // la coda esiste.
    const { error: writeError } = await admin
      .from("professional_verification")
      .update({
        vat_number: vat,
        vat_active: true,
        vat_holder_name: snap.name,
        vat_checked_at: snap.requestDate ?? new Date().toISOString(),
        vat_check_source: "vies",
        vat_check_payload: snap,
        vat_review_state: "pending",
        vat_review_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq("professional_id", pro.id);
    if (writeError) return failedWrite();

    await admin.from("verification_events").insert({
      professional_id: pro.id,
      event: "vat_check_ok",
      note: snap.name
        ? `Partita IVA valida ma intestata a "${snap.name}", che non corrisponde al nome del profilo: da attribuire a mano prima di concedere il livello.`
        : "Partita IVA valida ma il registro non ha restituito l'intestazione: impossibile attribuirla automaticamente.",
      actor_user_id: user.id,
      actor_name: profile?.full_name ?? "Professionista",
      actor_role: "professional",
    });

    return NextResponse.json({
      status: "needs_review",
      message: snap.name
        ? `La partita IVA risulta attiva, ma è intestata a "${snap.name}" e sul profilo hai un altro nome. Non concediamo il livello in automatico: controlliamo a mano che sia la tua e ti facciamo sapere. Se il nome del profilo è un nome commerciale, va benissimo — ci serve solo il riscontro.`
        : "La partita IVA risulta attiva ma il registro non ci ha restituito l'intestazione, quindi non possiamo attribuirla automaticamente al tuo profilo. Completiamo il controllo a mano.",
    });
  }

  if (outcome.status === "confirmed") {
    // Qui e solo qui la concessione è automatica: numero valido E intestazione
    // che corrisponde al nome del profilo.
    const { error: writeError } = await admin
      .from("professional_verification")
      .update({
        level: "vat_verified",
        vat_number: vat,
        vat_active: true,
        vat_holder_name: snap.name,
        vat_checked_at: snap.requestDate ?? new Date().toISOString(),
        vat_check_source: "vies",
        vat_check_payload: snap,
        // Niente più in sospeso: se c'era un caso aperto (o un rifiuto
        // precedente), il riscontro positivo lo chiude.
        vat_review_state: null,
        vat_review_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq("professional_id", pro.id);
    if (writeError) return failedWrite();

    await admin.from("verification_events").insert([
      {
        professional_id: pro.id,
        event: "vat_check_ok",
        note: `Confermata dal VIES e intestata a "${snap.name}", coerente col nome del profilo.`,
        actor_user_id: user.id,
      actor_name: profile?.full_name ?? "Professionista",
      actor_role: "professional",
      },
      {
        professional_id: pro.id,
        event: "level_granted",
        from_level: fromLevel,
        to_level: "vat_verified",
        note: "Concesso automaticamente dopo riscontro positivo sul VIES.",
        actor_user_id: user.id,
      actor_name: profile?.full_name ?? "Professionista",
      actor_role: "professional",
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
  // Il livello resta 'none' (chi era già verificato non arriva qui: si ferma al
  // controllo in cima), quindi scrivere la data del controllo è corretto.
  const { error: writeError } = await admin
    .from("professional_verification")
    .update({
      vat_number: vat,
      vat_active: false,
      vat_holder_name: snap.name,
      vat_checked_at: snap.requestDate ?? new Date().toISOString(),
      vat_check_source: "vies",
      vat_check_payload: snap,
      // In coda per l'esame umano, con la motivazione precedente azzerata.
      vat_review_state: "pending",
      vat_review_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("professional_id", pro.id);
  if (writeError) return failedWrite();

  await admin.from("verification_events").insert({
    professional_id: pro.id,
    event: "vat_check_failed",
    note: "Il VIES non ha confermato la partita IVA: può non essere iscritta alle operazioni intra-UE. Da esaminare manualmente.",
    actor_user_id: user.id,
      actor_name: profile?.full_name ?? "Professionista",
      actor_role: "professional",
  });

  return NextResponse.json({
    status: "needs_review",
    message:
      "La partita IVA è formalmente corretta ma non risulta nell'archivio europeo VIES: succede spesso a chi non lavora con l'estero. Abbiamo passato la richiesta al nostro team, che completa il controllo manualmente.",
  });
}
