// Tipi e logica condivisa per il "cervello" di Bob.
// L'API /api/bob/chat usa l'LLM (Claude Haiku) con TOOL USE: a ogni turno il
// modello chiama il tool `update_job_brief` e restituisce un Job Brief tipizzato
// (vedi Bob_Job_Brief_Spec.md). Niente più parsing di JSON dal testo.
// Se manca la chiave o l'AI fallisce, si usa un fallback a regole (matching.ts).

import { guessServiceSlug, guessSeverity } from "./matching";
import { afterDi } from "./italian";
import type { QuoteField } from "./supabase/types";

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
  // quoteFields viaggia con ogni opzione apposta: quando il cliente corregge
  // il sotto-servizio dalla recap card, la scheda lavoro deve potersi
  // ricalcolare senza un secondo giro di rete (Fase 4, correctSubtask).
  subtaskOptions?: { slug: string; name: string; quoteFields: QuoteField[] }[];
  // Le quote_fields del subtaskSlug risolto in questo turno (Fase 4, spec
  // §5): la scheda lavoro le usa per sapere cosa mostrare. Assente/vuoto se
  // il sotto-servizio non è ancora noto — ruleBasedDecision non lo imposta
  // mai, quindi il fallback a regole non offre mai una scheda vuota.
  quoteFields?: QuoteField[];
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
  // Le chiavi di scope valide per questo sotto-servizio (spec §3, migration
  // 082/083). Assente/vuoto per i catalog ref che non lo portano ancora
  // (retrocompatibilità con chiamate esistenti che non hanno bisogno di
  // validare scope, es. ruleBasedDecision).
  quoteFields?: QuoteField[];
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

// Le chiavi di scope valide per un sotto-servizio (spec §3). Torna [] se il
// sotto-servizio non è ancora noto o non ha un elenco: scope resta vuoto
// invece di accettare qualunque chiave — è il motivo per cui questa
// funzione esiste, non un dettaglio implementativo.
export function fieldsForSubtask(
  subtaskSlug: string | null,
  subservices: SubserviceRef[]
): QuoteField[] {
  if (!subtaskSlug) return [];
  return subservices.find((x) => x.slug === subtaskSlug)?.quoteFields ?? [];
}

// Le quote_fields di TUTTI i sotto-servizi di un servizio, quando il
// sotto-servizio esatto non è ancora noto ma il servizio sì (o si può
// indovinare dal testo). Serve solo come riferimento nel prompt — mai come
// schema stretto del tool, perché la stessa chiave (es. "intervento") ha
// opzioni diverse da un sotto-servizio all'altro e non si può unificare in
// un'unica proprietà. Il modello legge questo elenco per capire quali nomi
// di chiave esistono nella famiglia, sceglie quelle del sotto-servizio che
// sta per assegnare, e validateScope scarta lato server tutto il resto —
// vedi buildSystemPrompt, scopeGuidance.
export function fieldsForService(
  serviceSlug: string | null,
  subservices: SubserviceRef[]
): { slug: string; name: string; quoteFields: QuoteField[] }[] {
  if (!serviceSlug) return [];
  return subservices
    .filter(
      (x) => x.serviceSlug === serviceSlug && (x.quoteFields?.length ?? 0) > 0
    )
    .map((x) => ({ slug: x.slug, name: x.name, quoteFields: x.quoteFields ?? [] }));
}

// Limite generico in assenza di un min/max per campo nel catalogo (la spec
// §3.1 lo dà come esempio — "mq_approx tra 5 e 2000" — non come vincolo
// salvato per ogni campo). Fino a quando quote_fields non porta i suoi
// limiti, un valore fuori da questo range diventa un'assenza, non un dato
// scartato silenziosamente accettato: mai negativo, mai assurdamente grande.
const GENERIC_NUMERIC_MAX = 100_000;

function looksLikeEmail(v: string): boolean {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(v);
}

// Conta le cifre vere, ignorando separatori: un modello di caldaia come
// "ecoTEC 24" non ha 8 cifre consecutive, un numero di telefono italiano sì.
function looksLikePhone(v: string): boolean {
  return (v.match(/\d/g)?.length ?? 0) >= 8;
}

// Richiede ENTRAMBI un termine di via ed una cifra: "vicolo cieco" da solo
// non basta, "via Roma 12" sì. Euristica, non un parser di indirizzi —
// coerente con lo scopo (spec §3.1, non un bypass della 044), non con la
// precisione di un servizio di geocoding.
function looksLikeAddress(v: string): boolean {
  return (
    /\b(via|viale|piazza|piazzale|corso|vicolo|largo|strada)\b/i.test(v) &&
    /\d/.test(v)
  );
}

function coerceScopeValue(
  field: QuoteField,
  value: unknown
): string | number | boolean | undefined {
  switch (field.type) {
    case "number": {
      const n =
        typeof value === "number"
          ? value
          : typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())
            ? Number(value)
            : NaN;
      if (!Number.isFinite(n) || n < 0 || n > GENERIC_NUMERIC_MAX) return undefined;
      return n;
    }
    case "bool":
      return typeof value === "boolean" ? value : undefined;
    case "select":
      return typeof value === "string" && (field.options ?? []).includes(value)
        ? value
        : undefined;
    case "text": {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      // Mai un bypass della progressive disclosure (migration 044): un
      // campo testo dell'intake non deve poter portare un indirizzo, un
      // telefono o una email fuori dai canali che la 044 esiste per
      // proteggere.
      if (
        looksLikeEmail(trimmed) ||
        looksLikePhone(trimmed) ||
        looksLikeAddress(trimmed)
      ) {
        return undefined;
      }
      return trimmed;
    }
    default:
      return undefined;
  }
}

/**
 * Filtra uno scope candidato contro l'elenco di campi validi per il
 * sotto-servizio scelto. Una chiave non nell'elenco viene scartata, non
 * segnalata: lo scope diventa un oggetto vincolato per costruzione, non un
 * oggetto libero con un controllo sopra (spec §3.1).
 */
export function validateScope(
  scope: Record<string, unknown>,
  fields: QuoteField[]
): Record<string, string | number | boolean> {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(scope)) {
    const field = byKey.get(key);
    if (!field) continue;
    const validated = coerceScopeValue(field, value);
    if (validated !== undefined) out[key] = validated;
  }
  return out;
}

// System prompt: personalità, compito e politica delle domande.
export function buildSystemPrompt(
  services: ServiceRef[],
  subservices: SubserviceRef[],
  candidateFields: QuoteField[] = [],
  // Le quote_fields di tutti i sotto-servizi del servizio già noto (o
  // indovinato dal testo), quando il sotto-servizio esatto non lo è ancora.
  // Senza questo, il turno in cui il modello assegna il sotto-servizio per
  // la prima volta non ha alcun riferimento sulle sue chiavi e non può
  // compilare scope da quel che il cliente ha appena scritto — la scheda
  // arriva vuota anche quando la risposta era già nel messaggio di apertura
  // (regressione del 22 settembre, vedi fieldsForService).
  serviceFieldsHint: { slug: string; name: string; quoteFields: QuoteField[] }[] = []
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

  // Prima causa di scope vuoto (spec, verificato in produzione: 0/8
  // job_briefs con scope popolato): questa regola chiedeva "la singola
  // informazione più utile" senza mai dire QUALI chiavi esistono, cosi'
  // il modello ne inventava una a caso o non compilava scope per niente.
  // Ora la lista arriva qui, chiave per chiave, per il sotto-servizio già
  // scelto — se non c'è ancora un candidato, l'istruzione lo dice
  // esplicitamente invece di indovinare.
  const scopeGuidance =
    candidateFields.length > 0
      ? `Per questo sotto-servizio le uniche chiavi di scope valide sono:\n${candidateFields
          .map(
            (f) =>
              `  - ${f.key}${
                f.type === "select" ? ` (una di: ${(f.options ?? []).join(", ")})` : ` (${f.type})`
              }`
          )
          .join(
            "\n"
          )}\nNON fare NESSUNA domanda su queste chiavi, nemmeno una — la scheda lavoro le chiede subito dopo, con un tap ciascuna, ed è quello il posto giusto: chiederle anche in chat significa farle chiedere due volte. Se la risposta è già dentro un messaggio del cliente (anche il primo), compilala nel campo scope con la source giusta (user_text/photo/inferred); se non c'è, lasciala null e vai avanti comunque — resterà scoperta finché non la conferma la scheda. Non usare NESSUN'ALTRA chiave.`
      : serviceFieldsHint.length > 0
        ? `Il sotto-servizio esatto non è ancora assegnato, ma è quasi certamente uno di questi (stesso servizio) — le loro chiavi di scope, per riferimento:
${serviceFieldsHint
  .map(
    (s) =>
      `  - ${s.slug}: ${s.quoteFields
        .map(
          (f) =>
            `${f.key}${
              f.type === "select"
                ? ` (una di: ${(f.options ?? []).join(", ")})`
                : ` (${f.type})`
            }`
        )
        .join(", ")}`
  )
  .join(
    "\n"
  )}\nSe in QUESTO turno assegni tu stesso il sotto-servizio (punto 3) e il messaggio del cliente contiene già la risposta a una delle chiavi DI QUEL sotto-servizio specifico (non di un altro elencato qui sopra), compilala subito in scope — non aspettare il turno successivo, è esattamente il caso per cui questo elenco esiste. Non inventare un valore che il cliente non ha detto. NON fare NESSUNA domanda su queste chiavi, in nessun caso: restano da confermare nella scheda lavoro, mai in chat.`
        : `Il sotto-servizio non è ancora chiaro (vedi le regole sul servizio e sul sotto-servizio qui sopra): chiariscilo prima. Finché serviceSlug + subtaskSlug non sono noti, lascia scope vuoto — non riceverai un elenco di chiavi valide finché non lo sono.

ATTENZIONE se stai per assegnare tu stesso il sotto-servizio in QUESTO turno (punto 3): non hai ancora davanti l'elenco delle sue chiavi di scope, quindi non puoi sapere se la domanda che stai per fare ne duplica una. Non improvvisarla: in questo turno chiedi solo quello che le regole 1, 2 e 4 ti autorizzano esplicitamente (servizio ignoto, pericolo, ambiguità fra 2 sotto-servizi). Se hai già servizio + sotto-servizio + severity, non fare NESSUN'ALTRA domanda anche se non hai ancora scope: passa direttamente a next="city".`;

  return `Sei Bob, il concierge di un marketplace italiano che mette in contatto privati e professionisti dei servizi (idraulici, elettricisti, imbianchini, pulizie, ecc.).

Il tuo compito: capire DAVVERO il problema della persona e compilare un "job brief" strutturato, conversando in modo naturale. Parli in italiano, in prima persona ("Ciao, sono Bob"), con tono caldo, concreto e rassicurante. Frasi brevi. UNA sola domanda per turno.

Catalogo servizi e sotto-servizi (usa SOLO questi slug):
${catalog}

A OGNI turno devi chiamare il tool update_job_brief con: la tua risposta all'utente, il brief aggiornato e il prossimo passo.

Politica delle domande (massimo 2 domande di approfondimento in totale, poi procedi):
1. Se il servizio è ignoto → chiarisci con una domanda concreta, mai un elenco di categorie.
2. Se ci sono segnali di pericolo (acqua che esce, odore di bruciato, scintille) → 1 frase di sicurezza pratica + una verifica; compila redFlags e severity. La verifica è un'azione di sicurezza immediata ("hai staccato la corrente?"), non una domanda che duplica una chiave di scope (punto 6) — quella non va mai chiesta qui, nemmeno in questa forma.
3. Sotto-servizio: appena UN candidato del catalogo descrive plausibilmente quello che il cliente ha già detto, scegli quello e vai avanti — non chiedere conferma, non aspettare altri dettagli prima di impegnarti. "Mi perde il rubinetto del lavandino in cucina" è già perdita-rubinetto-sifone al primo turno: la parola "rubinetto" è già la risposta, non serve chiedere altro per saperlo. Consuma al massimo UNA delle 2 domande totali per arrivare a un sotto-servizio, non tutte e due.
4. Se e solo se restano davvero 2 candidati concreti e nessuno dei due è più probabile dell'altro → quella è la tua unica domanda di chiarimento sul sotto-servizio, secca, "o questo o quello". Dopo la risposta (o se il cliente non sa scegliere) prendi il più probabile e vai avanti comunque: non tornare a chiedere ancora.
5. Un sotto-servizio "-altro" è l'ultima risorsa, per quando il problema descritto non somiglia a NESSUNO dei sotto-servizi del catalogo — mai una via d'uscita perché la conversazione si sta allungando o perché non hai ancora fatto abbastanza domande. Se un candidato specifico è plausibile anche solo per buona parte, scegli quello, non "-altro".
6. Per lo scope: ${scopeGuidance}
7. Tutto il resto NON chiederlo: città e budget li gestisce il wizard dopo. Non chiedere mai il budget.

Il budget di 2 domande vale per identificare servizio + sotto-servizio (punti 1 e 4). Una volta noti servizio, sotto-servizio e severity, non hai più nessuna domanda da fare: passa a next="city" nello stesso turno, anche se lo scope è ancora vuoto.

Regole per il brief:
- Compila solo ciò che sai; lascia null ciò che non sai. Non inventare.
- Per ogni campo compilato indica in fieldMeta la confidence (high/medium/low) e la source (user_text/photo/inferred).
- severity: "alta" = urgente/danno in corso; "media" = concreto ma non emergenza; "bassa" = pianificabile. Deducila SEMPRE da quello che il cliente ha già scritto (confidence "low" se è una stima) — non è mai oggetto di una domanda, nemmeno riformulata ("è una goccia o un flusso costante?" è la stessa domanda di leak_active vestita da domanda sulla severity, vietata allo stesso modo). Se resta davvero ambigua, usa "media": il cliente la corregge con un tap nella recap card, costa meno che chiederla.
- summary: 1-2 frasi in prima persona del cliente.
- scope: usa SOLO le chiavi elencate al punto 6 per il sotto-servizio corrente, e SOLO per compilare risposte già presenti nei messaggi del cliente — mai per farne oggetto di una domanda. Mai un'altra chiave, mai un indirizzo, un telefono o una email dentro scope — quelli si chiedono altrove.

Se il messaggio contiene una FOTO: descrivi brevemente cosa vedi ("Dalla foto vedo…"), usa la foto per compilare servizio, sotto-servizio, severity e scope (source="photo"), compila photoCaption, e chiedi conferma di ciò che hai dedotto invece di fare altre domande.

Quando hai serviceSlug + subtaskSlug + severity con confidence almeno media (o hai esaurito il budget di domande): usa next="city", nella reply conferma in una frase cosa hai capito — NON chiedere ancora la città e NON chiedere altri dettagli del lavoro: se c'è una scheda lavoro da confermare viene subito dopo, chiede lei lo scope con un tap e la città alla fine. Compila anche shortlistReason (1-2 frasi su cosa cercherai) e suggestedMessage (messaggio pronto per il professionista, in prima persona del cliente, con i dettagli utili del brief).`;
}

// Lo schema JSON di "scope" per il tool: se il sotto-servizio candidato è
// noto, elenca esattamente le sue chiavi (additionalProperties:false —
// il modello non può nemmeno provare a inventarne una); altrimenti resta
// un oggetto libero ma la descrizione dice di lasciarlo vuoto (il
// controllo che conta comunque, in mergeBrief, non è questo: è
// validateScope, che scarta ogni chiave fuori catalogo indipendentemente
// da cosa il modello ha provato a mandare).
function buildScopeSchema(candidateFields: QuoteField[]) {
  if (candidateFields.length === 0) {
    return {
      type: "object" as const,
      description:
        "Il sotto-servizio non ha ancora un elenco di chiavi validato in questo turno. Se lo stai assegnando proprio ora (vedi le istruzioni sopra) e il messaggio del cliente contiene già la risposta a uno dei suoi campi tipici, puoi comunque scriverla qui con la chiave che ti sembra più corretta: il server scarta ogni chiave che non appartiene davvero al sotto-servizio risolto. Altrimenti lascia l'oggetto vuoto.",
    };
  }
  const properties: Record<string, Record<string, unknown>> = {};
  for (const f of candidateFields) {
    properties[f.key] =
      f.type === "select"
        ? { type: "string", enum: f.options ?? [] }
        : f.type === "number"
          ? { type: "number" }
          : f.type === "bool"
            ? { type: "boolean" }
            : { type: "string" };
  }
  return {
    type: "object" as const,
    description:
      "Compila SOLO queste chiavi, se e quando le conosci. Nessun'altra chiave è ammessa.",
    properties,
    additionalProperties: false,
  };
}

// Schema del tool update_job_brief (JSON Schema per l'API Anthropic).
export function buildBriefTool(
  services: ServiceRef[],
  subservices: SubserviceRef[],
  candidateFields: QuoteField[] = []
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
            scope: buildScopeSchema(candidateFields),
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

  // Validato contro le chiavi del sotto-servizio ORA risolto (sopra), non
  // quello di prev: se il modello ha appena scelto subtaskSlug in questa
  // stessa chiamata, scope va controllato contro le sue chiavi, non contro
  // quelle del turno precedente. Una chiave fuori catalogo viene scartata,
  // non tenuta "per ora" — è il punto della Fase 3.
  const scopeIn =
    inc["scope"] && typeof inc["scope"] === "object"
      ? (inc["scope"] as Record<string, unknown>)
      : {};
  const validatedIncoming = validateScope(
    scopeIn,
    fieldsForSubtask(subtaskSlug, subservices)
  );
  // Merge-with-previous: una chiave già valorizzata non regredisce a null
  // solo perché questo turno non l'ha ripetuta.
  const scope: JobBrief["scope"] = { ...prev.scope, ...validatedIncoming };

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
      .map((x) => ({ slug: x.slug, name: x.name, quoteFields: x.quoteFields ?? [] })),
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
