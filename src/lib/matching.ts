// Logica di matching e classificazione per la chat di Bob.
// L'intelligenza "vera" è gestita lato server dall'LLM (vedi /api/bob/chat).
// Qui restano: dizionari di parole chiave (fallback senza AI), regole di gravità/urgenza
// e le opzioni mostrate nella chat. Le chiavi sono gli slug reali dei servizi nel DB.

export const SERVICE_KEYWORDS: Record<string, string[]> = {
  idraulico: ["idraulic", "rubinett", "perdit", "tubo", "tubi", "scarico", "bagno", "water", "caldaia", "wc", "lavandino", "doccia", "allagament", "gocciol", "infiltraz", "boiler", "sifone", "sanitari"],
  elettricista: ["elettric", "presa", "prese", "interrutt", "corto", "impianto elettr", "luce", "luci", "lampad", "quadro elettr", "messa a norma", "salvavita", "contatore", "cablag", "scintill"],
  pulizie: ["puliz", "pulire", "casa sporca", "ufficio", "sanific", "stir", "domestic", "rasset", "igienizz", "deep clean"],
  imbianchino: ["imbianc", "tinteggi", "pittur", "verniciare", "pareti", "muro", "stanza da pitturare", "muffa", "cartongess"],
  traslochi: ["trasloc", "trasportare", "scatole", "furgone", "spostare mobili", "trasport", "imballagg"],
  tuttofare: ["tuttofare", "montaggio", "montare", "mensol", "tend", "ikea", "mobile", "riparazion", "appendere", "piccoli lavori", "fissare", "assemblar"],
  "personal-trainer": ["personal trainer", "allenament", "palestra", "fitness", "dimagrire", "preparatore", "massa muscolare"],
  "musica-intrattenimento": ["dj", "musica", "musicist", "band", "cantante", "festa", "evento", "matrimonio musica", "serata", "compleanno", "animazion", "animator", "karaoke", "mago", "intratten", "spettacol"],
  fotografo: ["fotograf", "foto", "ritratt", "shooting", "reportage", "book", "servizio fotografico"],
  ripetizioni: ["ripetizion", "lezioni", "studiare", "matematica", "inglese", "tutor", "doposcuola", "esame", "compiti"],
  "supporto-informatico": ["excel", "foglio di calcolo", "spreadsheet", "macro", "tabella pivot", "report excel", "formule", "computer", "pc ", "mac ", "stampante", "wifi", "wi-fi", "virus", "lento", "backup", "recupero dati", "installare", "spid", "word", "powerpoint"],
  giardiniere: ["giardin", "potatur", "siepe", "prato", "verde", "terrazz", "piante", "aiuola", "irrigaz"],
  serramentista: ["serrament", "finestr", "porta blindata", "infiss", "zanzarier", "tapparell", "persian", "basculante"],
  "grafica-logo": ["logo", "grafica", "brand", "volantino", "biglietto da visita", "locandina", "menu grafic"],
  "sviluppo-web": ["sito web", "sito internet", "web app", "ecommerce", "landing", "sviluppo web", "programmatore", "applicazione"],
};

// Restituisce lo slug del servizio più probabile dal testo libero, o null. Usato come fallback.
export function guessServiceSlug(text: string): string | null {
  const t = text.toLowerCase();
  let best: { slug: string; score: number } | null = null;
  for (const [slug, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (t.includes(kw)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { slug, score };
    }
  }
  return best?.slug ?? null;
}

// Parole che segnalano un problema GRAVE / urgente (fallback senza AI).
const SEVERITY_HIGH = [
  "allag", "perdita continua", "perde acqua", "non si ferma", "corto circuito", "scintill",
  "fumo", "brucia", "scossa", "esce acqua", "soffitto", "infiltraz", "non ho", "senza luce",
  "senza acqua", "urgent", "subito", "emergenz", "rotto del tutto", "non funziona più",
  "blocco", "bloccat", "esonda", "scoppi",
];
const SEVERITY_LOW = [
  "gocciol", "ogni tanto", "a volte", "leggera", "piccol", "estetic", "quando ho tempo",
  "vorrei migliorare", "manutenzion", "preventivo", "informazion", "valutare", "in futuro",
];

// Classifica grossolanamente la gravità dal testo (fallback senza AI).
export function guessSeverity(text: string): "alta" | "media" | "bassa" {
  const t = text.toLowerCase();
  if (SEVERITY_HIGH.some((k) => t.includes(k))) return "alta";
  if (SEVERITY_LOW.some((k) => t.includes(k))) return "bassa";
  return "media";
}

export const URGENCY_OPTIONS = [
  { label: "È un'emergenza, subito", value: "alta" as const, brief: "emergenza" as const },
  { label: "Questa settimana", value: "alta" as const, brief: "questa_settimana" as const },
  { label: "Questo mese", value: "media" as const, brief: "questo_mese" as const },
  { label: "Sto solo esplorando", value: "bassa" as const, brief: "esplorando" as const },
];

// Il budget ora è OPZIONALE: l'utente può indicarlo o chiedere preventivi.
export const BUDGET_OPTIONS = [
  { label: "Sotto 100€", maxPrice: 100, min: 0, max: 100 },
  { label: "100–500€", maxPrice: 500, min: 100, max: 500 },
  { label: "500–2000€", maxPrice: 2000, min: 500, max: 2000 },
  { label: "Oltre 2000€", maxPrice: undefined, min: 2000, max: null },
] as const;

// Etichette gravità per la UI.
export const SEVERITY_LABELS: Record<"alta" | "media" | "bassa", string> = {
  alta: "Problema serio / urgente",
  media: "Problema da risolvere",
  bassa: "Lavoro pianificabile",
};
