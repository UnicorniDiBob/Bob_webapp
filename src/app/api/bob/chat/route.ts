import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getServices, getAllSubservices } from "@/lib/data";
import { guessServiceSlug } from "@/lib/matching";
import {
  checkActorRateLimit,
  checkGlobalDailyCap,
  extractClientIp,
  readBodyWithLimit,
  ACTOR_LIMITS,
  GLOBAL_DAILY_CAP_CHAT,
  MAX_BODY_BYTES,
} from "@/lib/rate-limit";
import {
  buildSystemPrompt,
  buildBriefTool,
  mergeBrief,
  ruleBasedDecision,
  fieldsForSubtask,
  fieldsForService,
  EMPTY_BRIEF,
  type BobDecision,
  type BobMessage,
  type JobBrief,
  type ServiceRef,
} from "@/lib/bob";

export const runtime = "nodejs";

interface ChatBody {
  messages: BobMessage[];
  brief?: JobBrief;
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Carica la foto nel bucket privato brief-photos (service role, server-only).
// Se il service role non è configurato la foto viene comunque usata per la vision.
async function uploadBriefPhoto(
  base64: string,
  mediaType: string
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  try {
    const admin = createServiceClient(url, serviceKey);
    const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
    const path = `chat/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const buffer = Buffer.from(base64, "base64");
    const { error } = await admin.storage
      .from("brief-photos")
      .upload(path, buffer, { contentType: mediaType });
    return error ? null : path;
  } catch {
    return null;
  }
}

// Converte la cronologia nel formato Anthropic; solo l'ULTIMO messaggio utente
// può portare un'immagine (i turni precedenti restano solo testo).
function toAnthropicMessages(
  messages: BobMessage[]
): Anthropic.MessageParam[] {
  const lastUserIdx = messages.reduce(
    (acc, m, i) => (m.role === "user" ? i : acc),
    -1
  );
  return messages.map((m, i) => {
    const role = m.role === "bob" ? ("assistant" as const) : ("user" as const);
    if (
      i === lastUserIdx &&
      m.imageBase64 &&
      m.imageMediaType &&
      ALLOWED_IMAGE_TYPES.has(m.imageMediaType)
    ) {
      return {
        role,
        content: [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: m.imageMediaType as
                | "image/jpeg"
                | "image/png"
                | "image/webp",
              data: m.imageBase64,
            },
          },
          { type: "text" as const, text: m.content || "Ecco una foto del problema." },
        ],
      };
    }
    return { role, content: m.content };
  });
}

export async function POST(request: Request) {
  // Tetto al payload PRIMA di leggere qualunque cosa (Fase 5, P1.5): una
  // sola foto per turno, gia' ridotta lato client - vedi rate-limit.ts per
  // il perche' di 2MB.
  const bodyRead = await readBodyWithLimit(request, MAX_BODY_BYTES.chat);
  if (!bodyRead.ok) {
    return NextResponse.json(
      { error: "Corpo della richiesta troppo grande" },
      { status: 413 }
    );
  }

  let body: ChatBody;
  try {
    body = JSON.parse(bodyRead.text) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  // Limite di frequenza per attore (Fase 5, P1.5): loggato = il suo
  // account, anonimo = il suo IP. Un IP falso valore e' gia' il default
  // sicuro di extractClientIp ("unknown") - tutti gli anonimi senza IP
  // leggibile condividono lo stesso contatore, il che li limita PIU'
  // stretto, non meno: comportamento accettabile per un caso limite.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin =
    url && serviceKey ? createServiceClient(url, serviceKey) : null;

  let actorKey = `ip:${extractClientIp(request)}`;
  try {
    const supabase = createServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user?.id) actorKey = `user:${data.user.id}`;
  } catch {
    // Nessuna sessione leggibile: resta l'IP, comportamento invariato.
  }
  const isAuthenticated = actorKey.startsWith("user:");
  const actorLimits = isAuthenticated
    ? ACTOR_LIMITS.chat.authenticated
    : ACTOR_LIMITS.chat.anonymous;

  if (!admin) {
    // Senza service role il controllo non puo' nemmeno partire: chiude
    // (nega), stessa regola di quando il controllo risponde con un errore
    // - vedi rate-limit.ts.
    console.error(
      "[bob/chat] service role assente: limite di frequenza chiuso (nego)."
    );
    return NextResponse.json(
      { error: "Servizio temporaneamente non disponibile" },
      { status: 503 }
    );
  }

  const actorCheck = await checkActorRateLimit(
    admin,
    actorKey,
    "chat",
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

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const prev: JobBrief = body.brief ?? EMPTY_BRIEF;

  // Catalogo reale dal DB per ancorare le scelte di Bob.
  const [servicesRaw, subservices] = await Promise.all([
    getServices(),
    getAllSubservices(),
  ]);
  const services: ServiceRef[] = servicesRaw.map((s) => ({
    slug: s.slug,
    name: s.name,
    // Genere e numero servono a Bob per articolare il nome nei messaggi.
    gender: s.gender,
    is_plural: s.is_plural,
    takes_article: s.takes_article,
  }));

  // Foto sull'ultimo messaggio utente: upload nel bucket privato (in parallelo alla vision).
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const hasPhoto =
    !!lastUser?.imageBase64 &&
    !!lastUser?.imageMediaType &&
    ALLOWED_IMAGE_TYPES.has(lastUser.imageMediaType);
  const uploadPromise = hasPhoto
    ? uploadBriefPhoto(lastUser!.imageBase64!, lastUser!.imageMediaType!)
    : Promise.resolve<string | null>(null);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Nessuna chiave configurata: fallback a regole (l'app funziona comunque).
  // Loggato apposta: per tre mesi questo ramo e' scattato ad ogni chat senza
  // lasciare traccia da nessuna parte, e job_briefs.source non lo diceva
  // nemmeno (vedi PR #80 — il client non rimandava mai il campo indietro).
  if (!apiKey) {
    console.error("[bob/chat] ANTHROPIC_API_KEY assente: rispondo solo con le regole, nessuna chiamata a Claude.");
    const decision = ruleBasedDecision(messages, services, subservices, prev);
    return NextResponse.json({ ...decision, source: "rules" });
  }

  // Tetto giornaliero aggregato (Fase 5, P1.5): rotto, nessun errore per il
  // cliente - si degrada a ruleBasedDecision esattamente come sopra, e lo
  // stesso log dice il perche'. Il limite per attore, appena passato, limita
  // UN chiamante; questo limita la spesa TOTALE della rotta, indipendente da
  // chi chiama (rate-limit.ts ha il ragionamento sul numero).
  const withinDailyCap = await checkGlobalDailyCap(
    admin,
    "chat",
    GLOBAL_DAILY_CAP_CHAT
  );
  if (!withinDailyCap) {
    console.error(
      `[bob/chat] tetto giornaliero globale (${GLOBAL_DAILY_CAP_CHAT}) raggiunto: rispondo solo con le regole, nessuna chiamata a Claude.`
    );
    const decision = ruleBasedDecision(messages, services, subservices, prev);
    return NextResponse.json({ ...decision, source: "rules" });
  }

  try {
    const client = new Anthropic({ apiKey });
    // Le chiavi valide per il sotto-servizio già noto da un turno precedente
    // (spec §3, Fase 3): se prev.subtaskSlug non è ancora impostato, questa
    // è [] e sia il prompt sia lo schema restano nella modalità "non lo so
    // ancora" — non un elenco vuoto interpretato come "nessuna chiave è
    // ammessa mai".
    const candidateFields = fieldsForSubtask(prev.subtaskSlug, subservices);
    // Riferimento piu' ampio per il turno in cui il sotto-servizio non e'
    // ancora risolto: il servizio gia' noto, o un'ipotesi dal testo
    // dell'ultimo messaggio (stessa euristica del fallback a regole). Senza
    // questo il modello non ha NESSUN nome di chiave a cui appoggiarsi nel
    // turno in cui assegna il sotto-servizio, e lo scope resta vuoto anche
    // quando la risposta era gia' nel messaggio di apertura.
    const serviceFieldsHint =
      candidateFields.length === 0
        ? fieldsForService(
            prev.serviceSlug ?? guessServiceSlug(lastUser?.content ?? ""),
            subservices
          )
        : [];
    const tool = buildBriefTool(services, subservices, candidateFields);
    const completion = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      temperature: 0.4,
      system: buildSystemPrompt(
        services,
        subservices,
        candidateFields,
        serviceFieldsHint
      ),
      tools: [tool as Anthropic.Tool],
      tool_choice: { type: "tool", name: "update_job_brief" },
      messages: toAnthropicMessages(messages),
    });

    const toolBlock = completion.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolBlock) {
      console.error(
        "[bob/chat] Claude ha risposto senza tool_use, fallback a regole:",
        JSON.stringify(completion.content)
      );
      const fallback = ruleBasedDecision(messages, services, subservices, prev);
      return NextResponse.json({ ...fallback, source: "rules-fallback" });
    }

    const input = toolBlock.input as Record<string, unknown>;
    const briefIn =
      input.brief && typeof input.brief === "object"
        ? (input.brief as Record<string, unknown>)
        : {};

    let brief = mergeBrief(prev, briefIn, services, subservices);

    // Aggancia la foto caricata al brief, con la didascalia dell'AI.
    const storagePath = await uploadPromise;
    if (storagePath) {
      const aiCaption =
        typeof briefIn.photoCaption === "string" && briefIn.photoCaption.trim()
          ? briefIn.photoCaption.trim()
          : null;
      brief = { ...brief, photos: [...brief.photos, { storagePath, aiCaption }] };
    }

    const modelNext = input.next === "city" ? "city" : "ask";
    // Backstop deterministico: una volta noti servizio + sotto-servizio +
    // severity non c'e' piu' nessuna domanda legittima (vedi bob.ts, politica
    // delle domande) - tocca alla scheda lavoro. Il modello a volte ne fa
    // comunque una in piu', soprattutto nel turno in cui risolve il
    // sotto-servizio per la prima volta (non ha ancora l'elenco delle sue
    // chiavi di scope per sapere se la sta duplicando, vedi scopeGuidance).
    // La sua reply puo' restare una domanda testuale, ma la conversazione
    // non aspetta piu' la risposta: la scheda prende il testimone subito.
    const next: BobDecision["next"] =
      modelNext === "city" ||
      (brief.serviceSlug && brief.subtaskSlug && brief.severity)
        ? "city"
        : "ask";
    // Se il backstop ha appena forzato next="city", la reply del modello e'
    // stata scritta pensando di restare in ascolto (next="ask" nella sua
    // testa) - puo' essere letteralmente una domanda ("goccia o flusso
    // costante?") mostrata giusto sopra la scheda che chiede la stessa cosa
    // con un tap. Non fidarsi del testo del modello in questo caso: una
    // frase neutra, mai una domanda che nessuno aspetterà piu' una risposta.
    const backstopFired = modelNext === "ask" && next === "city";
    const reply = backstopFired
      ? "Perfetto, ho capito abbastanza per andare avanti. Guarda qui sotto quello che ho capito: puoi correggere quello che non torna."
      : typeof input.reply === "string" && input.reply.trim()
        ? input.reply.trim()
        : "Raccontami un po' meglio cosa ti serve.";

    const decision: BobDecision = {
      reply,
      brief,
      next,
      shortlistReason:
        typeof input.shortlistReason === "string" && input.shortlistReason.trim()
          ? input.shortlistReason.trim()
          : null,
      suggestedMessage:
        typeof input.suggestedMessage === "string" &&
        input.suggestedMessage.trim()
          ? input.suggestedMessage.trim()
          : null,
      // Opzioni per la recap card (correzione one-tap del sotto-servizio).
      subtaskOptions:
        next === "city" && brief.serviceSlug
          ? subservices
              .filter((x) => x.serviceSlug === brief.serviceSlug)
              .map((x) => ({
                slug: x.slug,
                name: x.name,
                quoteFields: x.quoteFields ?? [],
              }))
          : undefined,
      // La scheda lavoro (Fase 4) ne ha bisogno solo quando si passa alla
      // città: prima sarebbe un dato pronto ma inutile ad ogni turno.
      quoteFields:
        next === "city" ? fieldsForSubtask(brief.subtaskSlug, subservices) : undefined,
    };

    return NextResponse.json({ ...decision, source: "ai" });
  } catch (err) {
    // Errore API (chiave non valida, modello inesistente, rate limit, ecc.):
    // fallback a regole. L'errore vero si logga — prima veniva scartato in
    // silenzio, ed e' esattamente cosi' che un model id ritirato e' rimasto
    // invisibile per mesi (vedi PR #80).
    console.error("[bob/chat] eccezione nella chiamata a Claude, fallback a regole:", err);
    const fallback = ruleBasedDecision(messages, services, subservices, prev);
    return NextResponse.json({ ...fallback, source: "rules-error" });
  }
}
