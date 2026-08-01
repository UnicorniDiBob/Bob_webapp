import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getServices, getAllSubservices } from "@/lib/data";
import {
  buildSystemPrompt,
  buildBriefTool,
  mergeBrief,
  ruleBasedDecision,
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
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
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
  if (!apiKey) {
    const decision = ruleBasedDecision(messages, services, subservices, prev);
    return NextResponse.json({ ...decision, source: "rules" });
  }

  try {
    const client = new Anthropic({ apiKey });
    const tool = buildBriefTool(services, subservices);
    const completion = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 1000,
      temperature: 0.4,
      system: buildSystemPrompt(services, subservices),
      tools: [tool as Anthropic.Tool],
      tool_choice: { type: "tool", name: "update_job_brief" },
      messages: toAnthropicMessages(messages),
    });

    const toolBlock = completion.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolBlock) {
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

    const next: BobDecision["next"] = input.next === "city" ? "city" : "ask";
    const reply =
      typeof input.reply === "string" && input.reply.trim()
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
              .map((x) => ({ slug: x.slug, name: x.name }))
          : undefined,
    };

    return NextResponse.json({ ...decision, source: "ai" });
  } catch {
    // Errore API (chiave non valida, rate limit, ecc.): fallback a regole.
    const fallback = ruleBasedDecision(messages, services, subservices, prev);
    return NextResponse.json({ ...fallback, source: "rules-error" });
  }
}
