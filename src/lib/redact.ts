// Minimizzazione del testo libero prima che esca verso terzi (41.2).
//
// PERCHÉ ESISTE
// Dalla migrazione 044 l'indirizzo del cliente non finisce più dentro
// requests.problem_description: viaggia strutturato in request_addresses e lo
// legge solo il professionista con un appuntamento confermato. Restano però due
// buchi che nessuno schema può chiudere:
//   1. le righe scritte prima della 044, che la bonifica non ha potuto estrarre
//      quando l'indirizzo era in mezzo a una frase;
//   2. il cliente, che può sempre scrivere "vengo in Via Tal dei Tali 12" dentro
//      la descrizione del problema, e ne ha tutto il diritto.
// Quindi il punto dove serve la cintura di sicurezza non è il database: è il
// confine verso il fornitore LLM (DATA_COMPLIANCE §2, minimizzazione).
//
// COSA TOGLIE E COSA NO
// Toglie l'etichetta esplicita e il toponimo col numero civico, e lascia il
// toponimo nudo: "in Via Solferino" non identifica una casa, "Via Solferino 28"
// sì. Non prova a indovinare altro — una regex più avida rovinerebbe la
// descrizione ("60 mq", "3 mensole", "budget 500") e un riassunto sbagliato è
// un danno vero per il professionista che lo legge.
//
// NON è una garanzia crittografica: è una riduzione del rischio nel punto in cui
// il dato lascia il nostro perimetro. La garanzia sta nella RLS della 044.

const STREET_WORDS =
  "via|viale|v\\.le|corso|c\\.so|piazza|p\\.zza|piazzale|largo|vicolo|strada|lungomare|circonvallazione";

const HOUSE_NUMBER = new RegExp(
  `\\b(${STREET_WORDS})\\b([^,.;\\n]*?)\\s+\\d+[a-z]?\\b`,
  "gi"
);

/** Toglie via e numero civico da un testo libero, lasciando il resto intatto. */
export function stripAddresses(text: string): string {
  return text
    .replace(/(?:^|[\s—-])\s*indirizzo\s*:\s*[^—\n.]+/gi, " ")
    .replace(/\s*l'indirizzo\s+è\s+[^.\n]+\.?/gi, " ")
    .replace(HOUSE_NUMBER, "$1$2")
    .replace(/\s{2,}/g, " ")
    .trim();
}
