// Tipi e logica condivisa per il "cervello" di Bob.
// L'API /api/bob/chat usa l'LLM (Claude Haiku) con TOOL USE: a ogni turno il
// modello chiama il tool `update_job_brief` e restituisce un Job Brief tipizzato
// (vedi Bob_Job_Brief_Spec.md). Niente più parsing di JSON dal testo.
// Se manca la chiave o l'AI fallisce, si usa un fallback a regole (matching.ts).

import { guessServiceSlug, guessSeverity } from "./matching";
import { afterDi } from "./italian";

export type Severity = "alta" | "media" | "bassa";
export type BriefUrgency =
  | "emergenza"
  | "questa_settimana"
  | "questo_mese"
  | "esplorando";
export type Confidence = "high" | "medium" | "low";
export type FieldSource = "user_text" | "photo" | "inferred" | "option_click";

export interface FieldMeta {
  confidence: Confidence;
  source: FieldSource;
}

// Foto caricata dal cliente e interpretata dall'AI.
export interface BriefPhoto {
  storagePath: string;
  aiCaption: string | null;
}

// Messaggio nella conversazione, formato neutro condiviso client/server.
export interface BobMessage {
  role: "bob" | "user";
  content: string;
  // Foto allegata dall'utente a questo messaggio (base64 senza prefisso data:,
  // convertita in blocco immagine per l'LLM lato server).
  imageBase64?: string;
  imageMediaType?: string;
}

// Il Job Brief: ciò che Bob ha capito, in forma strutturata.
// Ogni campo è nullable: null = non ancora noto, e non contribuisce al ranking.
export interface JobBrief {
  serviceSlug: string | null;
  subtaskSlug: string | null;
  severity: Severity | null;
  urgency: BriefUrgency | null;
  summary: string | null; // sintesi in prima persona del cliente
  propertyType:
    | "appartamento"
    | "casa_indipendente"
    | "ufficio_commerciale"
    | "esterno"
    | "altro"
    | null;
  accessNotes: string | null;
  timingAvailability: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetFlexible: boolean | null;
  citySlug: string | null;
  zone: string | null;
  // Chiavi di scope specifiche del servizio (mq, piano, ascensore, ecc.)
  scope: Record<string, string | number | boolean>;
  redFlags: string[];
  photos: BriefPhoto[];
  // Meta per campo (confidence + source), chiave = nome campo.
  fieldMeta: Record<string, FieldMeta>;
}

export const EMPTY_BRIEF: JobBrief = {
  serviceSlug: null,
  subtaskSlug: null,
  severity: null,
  urgency: null,
  summary: null,
  propertyType: null,
  accessNotes: null,
  timingAvailability: null,
  budgetMin: null,
  budgetMax: null,
  budgetFlexible: null,
  citySlug: null,
  zone: null,
  scope: {},
  redFlags: [],
  photos: [],
  fieldMeta: {},
};

// Decisione di Bob a ogni turno.
export interface BobDecision {
  reply: string;
  brief: JobBrief;
  // "ask" = Bob fa un'altra domanda; "city" = passa al wizard città.
  next: "ask" | "city";
  shortlistReason?: string | null;
  suggestedMessage?: string | null;
  // Opzioni di sotto-servizio per la recap card (solo quando next="city").
  subtaskOptions?: { slug: string; name: string }[];
}

// Riferimenti catalogo passati all'LLM per ancorare le sue scelte.
export interface ServiceRef {
  slug: string;
  name: string;
  // Concordanza grammaticale dal catalogo (migration 035): serve per costruire
  // "delle pulizie" invece di "un pulizie". Opzionali per retrocompatibilità.
  gender?: string | null;
  is_plural?: boolean | null;
  takes_article?: boolean | null;
}
export interface SubserviceRef {
  serviceSlug: string;
  slug: string;
  name: string;
}

// [F2] Memoria cliente: preferenze e storico salvati nel DB.
export interface CustomerMemory {
  userId: string;
  lastServiceSlug: string | null;
  lastCitySlug: string | null;
  lastBudgetLabel: string | null;
  preferredUrgency: Severity | null;
  searchCount: number;
  updatedAt: string | null;
}

const PROPERTY_TYPES = [
  "appartamento",
  "casa_indipendente",
  "ufficio_commerciale",
  "esterno",
  "altro",
] as const;
const RED_FLAGS = [
  "danno_in_corso",
  "rischio_sicurezza",
  "senza_servizio_essenziale",
] as const;
const URGENCIES: BriefUrgency[] = [
  "emergenza",
  "questa_settimana",
  "questo_mese",
  "esplorando",
];
const SEVERITIES: Severity[] = ["alta", "media", "bassa"];

// System prompt: personalità, compito e politica delle domande.
export function buildSystemPrompt(
  services: ServiceRef[],
  subservices: SubserviceRef[]
): string {
  const catalog = services
    .map((s) => {
      const subs = subservices
        .filter((x) => x.serviceSlug === s.slug)
        .map((x) => x.slug)
        .join(", ");
      return `- ${s.slug} (${s.name}): ${subs}`;
    })
    .join("\n");

  return `Sei Bob, il concierge di un marketplace italiano che mette in contatto privati e professionisti dei servizi (idraulici, elettricisti, imbianchini, pulizie, ecc.).

Il tuo compito: capire DAVVERO il problema della persona e compilare un "job brief" strutturato, conversando in modo naturale. Parli in italiano, in prima persona ("Ciao, sono Bob"), con tono caldo, concreto e rassicurante. Frasi brevi. UNA sola domanda per turno.

Catalogo servizi e sotto-servizi (usa SOLO questi slug):
${catalog}

A OGNI turno devi chiamare il tool update_job_brief con: la tua risposta all'utente, il brief aggiornato e il prossimo passo.

Politica delle domande (massimo 2 domande di approfondimento in totale, poi procedi):
1. Se il servizio è ignoto → chiarisci con una domanda concreta, mai un elenco di categorie.
2. Se ci sono segnali di pericolo (acqua che esce, odore di bruciato, scintille) → 1 frase di sicurezza pratica + una verifica; compila redFlags e severity.
3. Se il sotto-servizio è ambiguo tra 2 candidati → una domanda secca "o questo o quello".
4. Altrimenti chiedi la SINGOLA informazione di scope più utile per quel sotto-servizio (es. mq per imbianchino; piano e ascensore per traslochi; caldaia a gas o elettrica per idraulico).
5. Tutto il resto NON chiederlo: città e budget li gestisce il wizard dopo. Non chiedere mai il budget.

Regole per il brief:
- Compila solo ciò che sai; lascia null ciò che non sai. Non inventare.
- Per ogni campo compilato indica in fieldMeta la confidence (high/medium/low) e la source (user_text/photo/inferred).
- severity: "alta" = urgente/danno in corso; "media" = concreto ma non emergenza; "bassa" = pianificabile.
- summary: 1-2 frasi in prima persona del cliente.
- scope: oggetto con chiavi brevi in snake_case (es. mq_approx, leak_active, floor_from, elevator).

Se il messaggio contiene una FOTO: descrivi brevemente cosa vedi ("Dalla foto vedo…"), usa la foto per compilare servizio, sotto-servizio, severity e scope (source="photo"), compila photoCaption, e chiedi conferma di ciò che hai dedotto invece di fare altre domande.

Quando hai serviceSlug + subtaskSlug + severity con confidence almeno media (o hai esaurito il budget di domande): usa next="city", nella reply conferma in una frase cosa hai capito e chiedi in che città serve. Compila anche shortlistReason (1-2 frasi su cosa cercherai) e suggestedMessage (messaggio pronto per il professionista, in prima persona del cliente, con i dettagli utili del brief).`;
}

// Schema del tool update_job_brief (JSON Schema per l'API Anthropic).
export function buildBriefTool(
  services: ServiceRef[],
  subservices: SubserviceRef[]
) {
  return {
    name: "update_job_brief",
    description:
      "Aggiorna la comprensione strutturata del problema del cliente e decide il prossimo passo della conversazione.",
    input_schema: {
      type: "object" as const,
      properties: {
        reply: {
          type: "string",
          description: "Cosa dici all'utente, in italiano.",
        },
        next: { type: "string", enum: ["ask", "city"] },
        brief: {
          type: "object",
          properties: {
            serviceSlug: {
              type: ["string", "null"],
              enum: [...services.map((s) => s.slug), null],
            },
            subtaskSlug: {
              type: ["string", "null"],
              enum: [...subservices.map((x) => x.slug), null],
              description:
                "Slug del sotto-servizio dal catalogo, coerente con serviceSlug.",
            },
            severity: { type: ["string", "null"], enum: [...SEVERITIES, null] },
            urgency: { type: ["string", "null"], enum: [...URGENCIES, null] },
            summary: { type: ["string", "null"] },
            propertyType: {
              type: ["string", "null"],
              enum: [...PROPERTY_TYPES, null],
            },
            accessNotes: { type: ["string", "null"] },
            timingAvailability: { type: ["string", "null"] },
            scope: {
              type: "object",
              description:
                "Chiavi di scope specifiche del servizio (snake_case).",
            },
            redFlags: {
              type: "array",
              items: { type: "string", enum: [...RED_FLAGS] },
            },
            photoCaption: {
              type: ["string", "null"],
              description:
                "Se c'è una foto nel messaggio: 1 frase su cosa mostra.",
            },
            fieldMeta: {
              type: "object",
              description:
                'Per ogni campo compilato: {"confidence":"high|medium|low","source":"user_text|photo|inferred"}.',
            },
          },
        },
        shortlistReason: { type: ["string", "null"] },
        suggestedMessage: { type: ["string", "null"] },
      },
      required: ["reply", "next", "brief"],
    },
  };
}

// Merge validato: i campi già noti non regrediscono a null,
// gli slug/enum fuori catalogo vengono scartati.
export function mergeBrief(
  prev: JobBrief,
  incoming: Record<string, unknown> | null | undefined,
  services: ServiceRef[],
  subservices: SubserviceRef[]
): JobBrief {
  const inc = incoming ?? {};
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  const incService = str(inc["serviceSlug"]);
  const serviceSlug =
    incService && services.some((s) => s.slug === incService)
      ? incService
      : prev.serviceSlug;

  const incSubtask = str(inc["subtaskSlug"]);
  const subtaskSlug =
    incSubtask &&
    subservices.some(
      (x) => x.slug === incSubtask && x.serviceSlug === serviceSlug
    )
      ? incSubtask
      : // se il servizio è cambiato, il vecchio sottoservizio non è più valido
        prev.subtaskSlug &&
          subservices.some(
            (x) => x.slug === prev.subtaskSlug && x.serviceSlug === serviceSlug
          )
        ? prev.subtaskSlug
        : null;

  const pickEnum = <T extends string>(
    v: unknown,
    allowed: readonly T[],
    fallback: T | null
  ): T | null => (allowed.includes(v as T) ? (v as T) : fallback);

  const scopeIn =
    inc["scope"] && typeof inc["scope"] === "object"
      ? (inc["scope"] as Record<string, unknown>)
      : {};
  const scope: JobBrief["scope"] = { ...prev.scope };
  for (const [k, v] of Object.entries(scopeIn)) {
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      scope[k] = v;
    }
  }

  const redFlagsIn = Array.isArray(inc["redFlags"]) ? inc["redFlags"] : [];
  const redFlags = Array.from(
    new Set([
      ...prev.redFlags,
      ...redFlagsIn.filter((f): f is string =>
        (RED_FLAGS as readonly string[]).includes(f as string)
      ),
    ])
  );

  const metaIn =
    inc["fieldMeta"] && typeof inc["fieldMeta"] === "object"
      ? (inc["fieldMeta"] as Record<string, unknown>)
      : {};
  const fieldMeta: JobBrief["fieldMeta"] = { ...prev.fieldMeta };
  for (const [k, v] of Object.entries(metaIn)) {
    if (v && typeof v === "object") {
      const m = v as Record<string, unknown>;
      const confidence = pickEnum(
        m["confidence"],
        ["high", "medium", "low"] as const,
        "medium"
      );
      const source = pickEnum(
        m["source"],
        ["user_text", "photo", "inferred", "option_click"] as const,
        "inferred"
      );
      if (confidence && source) fieldMeta[k] = { confidence, source };
    }
  }

  return {
    ...prev,
    serviceSlug,
    subtaskSlug,
    severity: pickEnum(inc["severity"], SEVERITIES, prev.severity),
    urgency: pickEnum(inc["urgency"], URGENCIES, prev.urgency),
    summary: str(inc["summary"]) ?? prev.summary,
    propertyType: pickEnum(
      inc["propertyType"],
      PROPERTY_TYPES,
      prev.propertyType
    ),
    accessNotes: str(inc["accessNotes"]) ?? prev.accessNotes,
    timingAvailability:
      str(inc["timingAvailability"]) ?? prev.timingAvailability,
    scope,
    redFlags,
    fieldMeta,
  };
}

// Fallback puramente a regole: nessun LLM. Usa parole chiave + gravità.
export function ruleBasedDecision(
  messages: BobMessage[],
  services: ServiceRef[],
  subservices: SubserviceRef[],
  prev: JobBrief
): BobDecision {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content ?? "";

  const slug = prev.serviceSlug ?? guessServiceSlug(text);
  const severity = prev.severity ?? guessSeverity(text);
  const svc = services.find((s) => s.slug === slug);

  const brief: JobBrief = {
    ...prev,
    serviceSlug: slug,
    severity,
    summary: prev.summary ?? (text ? text.slice(0, 200) : null),
  };

  if (!slug) {
    return {
      reply:
        "Per indirizzarti bene: di che tipo di intervento si tratta? Prova a dirmi cosa succede (es. \"ho una perdita d'acqua sotto il lavandino\") oppure scegli un servizio qui sotto.",
      brief,
      next: "ask",
    };
  }

  const empat =
    severity === "alta"
      ? `Capisco, sembra una cosa seria. ${safetyTip(slug)} `
      : "";

  const svcName = svc?.name.toLowerCase() ?? "professionista";
  // Retto da "di": "di un idraulico", "di pulizie", "di grafica e logo".
  const svcNeed = svc ? afterDi(svc) : "di un professionista";

  return {
    reply: `${empat}Ok, mi sembra un lavoro da ${svcName}. In che città ti serve?`,
    brief,
    next: "city",
    // Il nome del servizio non si può mettere al plurale senza un'altra colonna
    // ("elettricista" → "elettricisti"), quindi la frase parla di professionisti.
    shortlistReason: `Cerco professionisti disponibili e verificati per questo tipo di intervento.`,
    suggestedMessage: `Ciao, ho bisogno ${svcNeed}. ${brief.summary ?? text}. Sei disponibile?`,
    subtaskOptions: subservices
      .filter((x) => x.serviceSlug === slug)
      .map((x) => ({ slug: x.slug, name: x.name })),
  };
}

// Consiglio di sicurezza rapido per i casi gravi (fallback).
function safetyTip(slug: string): string {
  switch (slug) {
    case "idraulico":
      return "Se l'acqua continua a uscire, chiudi il rubinetto generale per limitare i danni.";
    case "elettricista":
      return "Se senti odore di bruciato o vedi scintille, stacca subito l'interruttore generale.";
    default:
      return "Mettiti al sicuro e non rischiare.";
  }
}
