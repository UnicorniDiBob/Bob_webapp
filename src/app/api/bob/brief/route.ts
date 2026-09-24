import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_BRIEF, validateScope, type JobBrief } from "@/lib/bob";
import type { QuoteField } from "@/lib/supabase/types";
import {
  checkActorRateLimit,
  extractClientIp,
  readBodyWithLimit,
  ACTOR_LIMITS,
  MAX_BODY_BYTES,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

// Salva il job brief completato (una riga per chat conclusa).
// È il fondamento dati del ranking: logga cosa chiedono i clienti e come.
// Scrittura via service role: la tabella job_briefs non ha policy di insert.
//
// QUESTA ROUTE NON HA AUTENTICAZIONE (G20-G22): chi la chiama non è
// necessariamente passato dalla chat, quindi non ci si può fidare che
// scope sia già stato filtrato da mergeBrief lato client. subtaskSlug va
// riletto dal catalogo — non solo per sapere se esiste, ma per avere
// l'elenco di quote_fields con cui filtrare scope prima di scriverlo.
export async function POST(request: Request) {
  // Tetto al payload PRIMA di leggere qualunque cosa (Fase 5, P1.5): questa
  // rotta non porta mai binario, solo JSON strutturato - vedi rate-limit.ts.
  const bodyRead = await readBodyWithLimit(request, MAX_BODY_BYTES.brief);
  if (!bodyRead.ok) {
    return NextResponse.json(
      { error: "Corpo della richiesta troppo grande" },
      { status: 413 }
    );
  }

  let body: { brief?: JobBrief; source?: string };
  try {
    body = JSON.parse(bodyRead.text);
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const brief: JobBrief = { ...EMPTY_BRIEF, ...(body.brief ?? {}) };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Logging best-effort: senza service role non blocchiamo la UX. Il
    // limite di frequenza non serve nemmeno qui: senza service role
    // l'insert sotto fallisce comunque, quindi non c'e' niente da abusare.
    return NextResponse.json({ saved: false });
  }

  // Se l'utente è loggato, agganciamo il brief al suo account — e usiamo lo
  // stesso id come chiave del limite di frequenza, invece di un secondo
  // giro di autenticazione.
  let userId: string | null = null;
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  const admin = createServiceClient(url, serviceKey);

  // Limite di frequenza per attore (Fase 5, P1.5). Qui il service role
  // esiste per costruzione (controllato sopra): un controllo che fallisce
  // o va in timeout chiude (nega) — vedi rate-limit.ts.
  const actorKey = userId ? `user:${userId}` : `ip:${extractClientIp(request)}`;
  const actorLimits = userId
    ? ACTOR_LIMITS.brief.authenticated
    : ACTOR_LIMITS.brief.anonymous;
  const actorCheck = await checkActorRateLimit(
    admin,
    actorKey,
    "brief",
    actorLimits
  );
  if (!actorCheck.allowed) {
    return NextResponse.json(
      { error: "Troppe richieste, riprova fra poco" },
      {
        status: 429,
        headers: { "Retry-After": String(actorCheck.retryAfterSeconds) },
      }
    );
  }

  // subtaskSlug e le sue quote_fields sono la fonte di verità per filtrare
  // scope, non quello che il client dichiara di aver già validato. Uno slug
  // sconosciuto o superseded (081) non viene scartato con un errore — non
  // blocchiamo la UX per questo — ma smette di essere fidato: subtask_slug
  // e scope finiscono entrambi vuoti, come se non fosse mai stato scelto.
  let subtaskSlug = brief.subtaskSlug;
  let quoteFields: QuoteField[] = [];
  if (subtaskSlug) {
    const { data: sub } = await admin
      .from("subservices")
      .select("quote_fields")
      .eq("slug", subtaskSlug)
      .is("superseded_by", null)
      .maybeSingle();
    if (sub) {
      quoteFields = (sub.quote_fields as QuoteField[] | null) ?? [];
    } else {
      subtaskSlug = null;
    }
  }
  const scope = validateScope(brief.scope ?? {}, quoteFields);

  try {
    const { data, error } = await admin
      .from("job_briefs")
      .insert({
        user_id: userId,
        service_slug: brief.serviceSlug,
        subtask_slug: subtaskSlug,
        severity: brief.severity,
        urgency: brief.urgency,
        summary: brief.summary,
        property_type: brief.propertyType,
        access_notes: brief.accessNotes,
        timing_availability: brief.timingAvailability,
        budget_min: brief.budgetMin,
        budget_max: brief.budgetMax,
        budget_flexible: brief.budgetFlexible ?? false,
        city_slug: brief.citySlug,
        zone: brief.zone,
        scope,
        red_flags: brief.redFlags ?? [],
        photos: brief.photos ?? [],
        field_meta: brief.fieldMeta ?? {},
        // job_briefs.source ammette solo 'ai'/'rules' (mig 014): vero SOLO se
        // /api/bob/chat ha davvero risposto con un tool_use. Prima il verso
        // era invertito (tutto cio' che non era letteralmente "rules"
        // diventava "ai") e siccome il client non mandava mai questo campo,
        // la colonna diceva 'ai' sempre — anche per rules, rules-fallback e
        // rules-error. Ora il default onesto e' 'rules': non sappiamo che
        // sia stato davvero Claude finche' non ce lo dice esplicitamente.
        source: body.source === "ai" ? "ai" : "rules",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ saved: false });
    return NextResponse.json({ saved: true, id: data.id });
  } catch {
    return NextResponse.json({ saved: false });
  }
}
