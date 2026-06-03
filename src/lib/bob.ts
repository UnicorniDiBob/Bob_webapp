// Tipi e logica condivisa per il "cervello" di Bob.
// L'API /api/bob/chat usa l'LLM (Claude Haiku) per ragionare sul problema;
// se manca la chiave o l'AI fallisce, si usa un fallback a regole basato su matching.ts.

import { guessServiceSlug, guessSeverity } from "./matching";

export type Severity = "alta" | "media" | "bassa";

// Messaggio nella conversazione, formato neutro condiviso client/server.
export interface BobMessage {
  role: "bob" | "user";
  content: string;
}

// Ciò che Bob ha capito finora.
export interface BobUnderstanding {
  serviceSlug: string | null; // slug servizio dedotto (es. "idraulico")
  severity: Severity | null; // entità/gravità del problema
  summary: string | null; // sintesi breve del problema, in prima persona del cliente
}

// Decisione di Bob a ogni turno.
export interface BobDecision {
  // Messaggio che Bob dice all'utente.
  reply: string;
  // Cosa Bob ha capito (aggiornato).
  understanding: BobUnderstanding;
  // Prossimo passo del wizard guidato.
  // "ask" = Bob fa una domanda di approfondimento (testo libero)
  // "city" = chiediamo la città
  // "budget" = chiediamo budget (opzionale) o preventivi
  // "ready" = abbiamo abbastanza per mostrare i professionisti
  next: "ask" | "city" | "budget" | "ready";
}

// Servizi disponibili passati all'LLM (slug + nome) per ancorare le sue scelte.
export interface ServiceRef {
  slug: string;
  name: string;
}

// System prompt: definisce personalità e compito di Bob.
export function buildSystemPrompt(services: ServiceRef[]): string {
  const list = services.map((s) => `- ${s.slug}: ${s.name}`).join("\n");
  return `Sei Bob, il concierge di un marketplace italiano che mette in contatto privati e professionisti dei servizi per la casa e non solo (idraulici, elettricisti, imbianchini, pulizie, ecc.).

Il tuo compito: capire DAVVERO il problema della persona, la sua ENTITÀ/GRAVITÀ e quale servizio serve, facendo poche domande mirate e intelligenti. Parli in italiano, in prima persona ("Ciao, sono Bob"), con tono caldo, concreto e rassicurante. Frasi brevi.

Servizi disponibili (usa SOLO questi slug):
${list}

Regole di ragionamento:
- Deduci il servizio più adatto dal racconto dell'utente. Se è ambiguo, fai UNA domanda per chiarire.
- Valuta la gravità: "alta" = urgente/danno in corso (es. allagamento, corto circuito, perdita continua); "media" = problema concreto da risolvere ma non emergenza; "bassa" = lavoro pianificabile o semplice richiesta info.
- Se il problema sembra GRAVE, mostra empatia e dai un consiglio di sicurezza immediato e pratico (1 frase), poi procedi.
- Fai domande di approfondimento solo se servono a capire il servizio o la gravità (max 1-2 domande totali). Non chiedere il budget: a quello pensa il wizard dopo.
- Quando hai chiaro SERVIZIO e GRAVITÀ, passa a chiedere la città (next="city").

Devi rispondere SEMPRE e SOLO con un oggetto JSON valido, senza testo intorno, con questa forma esatta:
{
  "reply": "cosa dici all'utente, in italiano",
  "serviceSlug": "slug del servizio dedotto oppure null",
  "severity": "alta" | "media" | "bassa" | null,
  "summary": "sintesi breve del problema in prima persona del cliente, oppure null",
  "next": "ask" | "city"
}
- Usa next="ask" se ti serve un'altra risposta dell'utente per capire servizio o gravità.
- Usa next="city" quando hai capito servizio e gravità: in "reply" conferma cosa hai capito e chiedi in che città serve.`;
}

// Fallback puramente a regole: nessun LLM. Usa parole chiave + gravità.
export function ruleBasedDecision(
  messages: BobMessage[],
  services: ServiceRef[],
  prevUnderstanding: BobUnderstanding
): BobDecision {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content ?? "";

  const slug = prevUnderstanding.serviceSlug ?? guessServiceSlug(text);
  const severity = prevUnderstanding.severity ?? guessSeverity(text);
  const svc = services.find((s) => s.slug === slug);

  const understanding: BobUnderstanding = {
    serviceSlug: slug,
    severity,
    summary: prevUnderstanding.summary ?? (text ? text.slice(0, 200) : null),
  };

  if (!slug) {
    return {
      reply:
        "Per indirizzarti bene: di che tipo di intervento si tratta? Prova a dirmi cosa succede (es. \"ho una perdita d'acqua sotto il lavandino\") oppure scegli un servizio qui sotto.",
      understanding,
      next: "ask",
    };
  }

  const empat =
    severity === "alta"
      ? `Capisco, sembra una cosa seria. ${safetyTip(slug)} `
      : "";

  return {
    reply: `${empat}Ok, mi sembra un lavoro da ${svc?.name.toLowerCase() ?? "professionista"}. In che città ti serve?`,
    understanding,
    next: "city",
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
