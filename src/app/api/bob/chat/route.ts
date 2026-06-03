import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServices } from "@/lib/data";
import {
  buildSystemPrompt,
  ruleBasedDecision,
  type BobDecision,
  type BobMessage,
  type BobUnderstanding,
  type ServiceRef,
  type Severity,
} from "@/lib/bob";

export const runtime = "nodejs";

interface ChatBody {
  messages: BobMessage[];
  understanding?: BobUnderstanding;
}

const EMPTY_UNDERSTANDING: BobUnderstanding = {
  serviceSlug: null,
  severity: null,
  summary: null,
};

// Estrae il primo blocco JSON valido dalla risposta dell'LLM.
function parseDecision(
  raw: string,
  services: ServiceRef[],
  prev: BobUnderstanding
): BobDecision | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    const slug: string | null =
      typeof obj.serviceSlug === "string" &&
      services.some((s) => s.slug === obj.serviceSlug)
        ? obj.serviceSlug
        : prev.serviceSlug;
    const severity: Severity | null = ["alta", "media", "bassa"].includes(
      obj.severity
    )
      ? obj.severity
      : prev.severity;
    const next: BobDecision["next"] =
      obj.next === "city" ? "city" : "ask";
    const reply =
      typeof obj.reply === "string" && obj.reply.trim()
        ? obj.reply.trim()
        : "Raccontami un po' meglio cosa ti serve.";
    return {
      reply,
      understanding: {
        serviceSlug: slug,
        severity,
        summary:
          typeof obj.summary === "string" && obj.summary.trim()
            ? obj.summary.trim()
            : prev.summary,
      },
      next,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const prev = body.understanding ?? EMPTY_UNDERSTANDING;

  // Servizi reali dal DB per ancorare le scelte di Bob.
  const services: ServiceRef[] = (await getServices()).map((s) => ({
    slug: s.slug,
    name: s.name,
  }));

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Nessuna chiave configurata: fallback a regole (l'app funziona comunque).
  if (!apiKey) {
    const decision = ruleBasedDecision(messages, services, prev);
    return NextResponse.json({ ...decision, source: "rules" });
  }

  try {
    const client = new Anthropic({ apiKey });
    const completion = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 400,
      temperature: 0.4,
      system: buildSystemPrompt(services),
      messages: messages.map((m) => ({
        role: m.role === "bob" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
    });

    const raw = completion.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    const decision = parseDecision(raw, services, prev);
    if (decision) {
      return NextResponse.json({ ...decision, source: "ai" });
    }
    // Parsing fallito: fallback a regole.
    const fallback = ruleBasedDecision(messages, services, prev);
    return NextResponse.json({ ...fallback, source: "rules-fallback" });
  } catch {
    // Errore API (chiave non valida, rate limit, ecc.): fallback a regole.
    const fallback = ruleBasedDecision(messages, services, prev);
    return NextResponse.json({ ...fallback, source: "rules-error" });
  }
}
