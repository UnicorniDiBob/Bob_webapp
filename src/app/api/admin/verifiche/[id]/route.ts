// API: decisione umana su un caso di verifica P.IVA (blocco 10, §5.3).
//
// POST /api/admin/verifiche/[id]     [id] = professionals.id
// Body: { action: "grant" | "request_docs" | "reject", note?: string }
//
// Perché esiste: il VIES che non conferma NON è un rifiuto (un artigiano che
// non lavora con l'estero può non essere iscritto), quindi il caso finisce in
// coda e lo chiude una persona. È anche il requisito dell'art. 22 GDPR — niente
// esclusioni automatiche — e del Reg. UE 2019/1150 (P2B), che impone di
// motivare la limitazione verso il professionista: per questo la motivazione è
// obbligatoria su "chiedi documenti" e "rifiuta", e viene mostrata a lui.
//
// La scrittura passa dal service role perché professional_verification non ha
// policy di insert/update: nessuno si promuove da sé, nemmeno lo staff via SQL
// dal browser. La lettura del ruolo, invece, usa la sessione: è l'unica cosa
// che dice CHI sta decidendo.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { buildEmail, emailEnabled, sendEmail, type NotifyEvent } from "@/lib/email";
import type { VerificationLevel } from "@/lib/vat";

export const runtime = "nodejs";

type Action = "grant" | "request_docs" | "reject";

const ACTIONS: Action[] = ["grant", "request_docs", "reject"];

// Una motivazione di tre parole non è una motivazione: chi la legge è il
// professionista, non noi.
const MIN_NOTE_LENGTH = 15;
const MAX_NOTE_LENGTH = 600;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // --- 1. Chi sta decidendo ---
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (userRow as { role?: string } | null)?.role;
  if (!role || !["admin", "cs"].includes(role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  // La firma della decisione: nome e ruolo di chi sta decidendo, fotografati
  // adesso (migration 040). Il riferimento all'account da solo non basta —
  // se un domani quell'account non c'è più, il registro non saprebbe più dire
  // chi ha concesso quel livello.
  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const actorName =
    (actorProfile as { full_name: string | null } | null)?.full_name ??
    user.email ??
    "Staff BOB";

  // --- 2. Cosa ha deciso ---
  let body: { action?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const action = body.action as Action;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  }

  const note = (body.note ?? "").trim().slice(0, MAX_NOTE_LENGTH);
  if (action !== "grant" && note.length < MIN_NOTE_LENGTH) {
    return NextResponse.json(
      {
        error:
          "Serve una motivazione: la legge il professionista, e deve dirgli cosa non va e cosa può fare.",
      },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Servizio di verifica non configurato" },
      { status: 503 }
    );
  }
  const admin = createServiceClient(url, serviceKey);

  // --- 3. Il caso esiste? ---
  const { data: current } = await admin
    .from("professional_verification")
    .select("professional_id, level, vat_number, vat_holder_name")
    .eq("professional_id", params.id)
    .maybeSingle();

  if (!current) {
    return NextResponse.json(
      { error: "Nessuna riga di verifica per questo professionista" },
      { status: 404 }
    );
  }
  const fromLevel = (current.level ?? "none") as VerificationLevel;
  const now = new Date().toISOString();

  // --- 4. Applica la decisione ---
  // Ogni riga porta la firma: chi, con che ruolo, e cosa ha scritto.
  const events: {
    professional_id: string;
    event: string;
    from_level?: string;
    to_level?: string;
    note?: string;
    actor_user_id: string;
    actor_name: string;
    actor_role: string;
  }[] = [];

  let update: Record<string, unknown>;
  let emailEvent: NotifyEvent;
  let responseMessage: string;

  if (action === "grant") {
    // Non si concede un livello su una partita IVA che non c'è: sarebbe un
    // "Pro" senza niente dietro, e il registro non potrebbe dimostrare nulla.
    if (!current.vat_number) {
      return NextResponse.json(
        {
          error:
            "Questo professionista non ha comunicato nessuna partita IVA: non c'è niente da concedere.",
        },
        { status: 409 }
      );
    }

    // Stessa partita IVA su due profili verificati: il database lo impedisce
    // (indice unico, migration 039), ma un errore secco 500 non dice niente a
    // chi sta decidendo. Qui il caso si spiega.
    const { data: claimed } = await admin
      .from("professional_verification")
      .select("professional_id")
      .eq("vat_number", current.vat_number)
      .neq("professional_id", params.id)
      .not("level", "eq", "none")
      .maybeSingle();
    if (claimed) {
      return NextResponse.json(
        {
          error:
            "Questa partita IVA è già attribuita a un altro profilo verificato. Prima di concederla qui va revocata là: due profili non possono avere la stessa.",
        },
        { status: 409 }
      );
    }

    // Chi è già Pro+ non va declassato da una conferma sulla P.IVA: il livello
    // documentale include quello fiscale. Senza questo, il registro
    // scriverebbe una revoca chiamandola concessione.
    const grantedLevel: VerificationLevel =
      fromLevel === "documents_verified" ? "documents_verified" : "vat_verified";

    // Concessione manuale: la data del livello diventa quella di QUESTO
    // controllo, non quella del VIES che non aveva confermato. Il payload del
    // VIES resta dov'è: è la prova di cosa risultava allora.
    update = {
      level: grantedLevel,
      vat_active: true,
      vat_checked_at: now,
      vat_check_source: "staff",
      vat_match_source: "staff",
      vat_review_state: null,
      vat_review_note: null,
      vat_reviewed_at: now,
      vat_reviewed_by: user.id,
      vat_reviewed_by_name: actorName,
      updated_at: now,
    };
    events.push({
      professional_id: params.id,
      event: "level_granted",
      from_level: fromLevel,
      to_level: grantedLevel,
      note:
        note ||
        "Partita IVA riscontrata a mano dopo che il controllo automatico non l'aveva confermata.",
      actor_user_id: user.id,
      actor_name: actorName,
      actor_role: role,
    });
    emailEvent = "verification_granted";
    responseMessage =
      grantedLevel === "documents_verified"
        ? "Partita IVA confermata a mano; il livello Pro+ resta invariato."
        : "Livello Pro concesso.";
  } else if (action === "request_docs") {
    // Il livello non cambia: stiamo chiedendo, non negando.
    update = {
      vat_review_state: "docs_requested",
      vat_review_note: note,
      vat_reviewed_at: now,
      vat_reviewed_by: user.id,
      vat_reviewed_by_name: actorName,
      updated_at: now,
    };
    events.push({
      professional_id: params.id,
      event: "documents_requested",
      note,
      actor_user_id: user.id,
      actor_name: actorName,
      actor_role: role,
    });
    emailEvent = "verification_docs_requested";
    responseMessage = "Documenti richiesti al professionista.";
  } else {
    // Rifiuto motivato. Se il professionista aveva già un livello, questo è
    // anche una revoca: va scritta come tale, non nascosta nel rifiuto.
    update = {
      level: "none",
      vat_active: false,
      vat_review_state: "rejected",
      vat_review_note: note,
      vat_reviewed_at: now,
      vat_reviewed_by: user.id,
      vat_reviewed_by_name: actorName,
      updated_at: now,
    };
    events.push({
      professional_id: params.id,
      event: "vat_rejected",
      note,
      actor_user_id: user.id,
      actor_name: actorName,
      actor_role: role,
    });
    if (fromLevel !== "none") {
      events.push({
        professional_id: params.id,
        event: "level_revoked",
        from_level: fromLevel,
        to_level: "none",
        note,
        actor_user_id: user.id,
        actor_name: actorName,
        actor_role: role,
      });
    }
    emailEvent = "verification_rejected";
    responseMessage = "Richiesta respinta con motivazione.";
  }

  const { error: updateError } = await admin
    .from("professional_verification")
    .update(update)
    .eq("professional_id", params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Il registro è la prova di cosa è stato fatto e da chi: se non si scrive,
  // la decisione non è difendibile. Perciò l'errore qui non è silenzioso.
  const { error: eventError } = await admin
    .from("verification_events")
    .insert(events);
  if (eventError) {
    return NextResponse.json(
      {
        error:
          "Decisione applicata ma non registrata negli eventi: segnala il problema prima di procedere con altri casi.",
        detail: eventError.message,
      },
      { status: 500 }
    );
  }

  // --- 5. Avviso al professionista (best-effort, dormiente senza Resend) ---
  let emailSent = false;
  if (emailEnabled()) {
    try {
      const { data: pro } = await admin
        .from("professionals")
        .select("user_id")
        .eq("id", params.id)
        .maybeSingle();
      const proUserId = (pro as { user_id: string } | null)?.user_id ?? null;
      if (proUserId) {
        const { data: authUser } = await admin.auth.admin.getUserById(proUserId);
        const to = authUser.user?.email ?? null;
        const { data: profile } = await admin
          .from("profiles")
          .select("full_name")
          .eq("user_id", proUserId)
          .maybeSingle();
        if (to) {
          emailSent = await sendEmail(
            buildEmail(emailEvent, to, {
              recipientName:
                (profile as { full_name: string | null } | null)?.full_name ?? null,
              // Chi ha deciso firma la mail: è la stessa firma che finisce nel
              // registro, così il professionista e noi leggiamo lo stesso nome.
              senderName: actorName,
              serviceName: null,
              cityName: null,
              preview: note || null,
              link: "/dashboard/verifica",
            })
          );
        }
      }
    } catch {
      // L'email non deve mai far fallire la decisione: l'esito è comunque
      // visibile nel profilo del professionista.
    }
  }

  return NextResponse.json({
    ok: true,
    action,
    message: responseMessage,
    emailSent,
  });
}
