// Matching keyword -> servizio, lato client (nessun LLM, come da specifica).
// Le chiavi sono gli slug reali dei servizi nel database.

export const SERVICE_KEYWORDS: Record<string, string[]> = {
  idraulico: ["idraulic", "rubinett", "perdit", "tubo", "tubi", "scarico", "bagno", "water", "caldaia", "wc", "lavandino", "doccia", "allagament"],
  elettricista: ["elettric", "presa", "prese", "interrutt", "corto", "impianto elettr", "luce", "lampad", "quadro elettr", "messa a norma"],
  pulizie: ["puliz", "pulire", "casa sporca", "ufficio", "sanific", "stir", "domestic"],
  imbianchino: ["imbianc", "tinteggi", "pittur", "verniciare", "pareti", "muro", "stanza da pitturare"],
  traslochi: ["trasloc", "trasportare", "scatole", "furgone", "spostare mobili", "trasport"],
  tuttofare: ["tuttofare", "montaggio", "montare", "mensol", "tend", "ikea", "mobile", "riparazion", "appendere", "piccoli lavori"],
  "personal-trainer": ["personal trainer", "allenament", "palestra", "fitness", "dimagrire", "preparatore"],
  dj: ["dj", "musica", "festa", "evento", "matrimonio musica", "serata"],
  fotografo: ["fotograf", "foto", "ritratt", "shooting", "reportage", "book"],
  ripetizioni: ["ripetizion", "lezioni", "studiare", "matematica", "inglese", "tutor", "doposcuola", "esame"],
  "supporto-excel": ["excel", "foglio di calcolo", "spreadsheet", "macro", "tabella pivot", "report excel"],
  giardiniere: ["giardin", "potatur", "siepe", "prato", "verde", "terrazz", "piante"],
  serramentista: ["serrament", "finestr", "porta blindata", "infiss", "zanzarier", "tapparell"],
  "grafica-logo": ["logo", "grafica", "brand", "volantino", "biglietto da visita", "locandina"],
  "sviluppo-web": ["sito web", "sito internet", "web app", "ecommerce", "landing", "sviluppo web", "programmatore"],
};

// Restituisce lo slug del servizio più probabile dal testo libero, o null.
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

export const BUDGET_OPTIONS = [
  { label: "Sotto 100€", maxPrice: 100, min: 0, max: 100 },
  { label: "100–500€", maxPrice: 500, min: 100, max: 500 },
  { label: "500–2000€", maxPrice: 2000, min: 500, max: 2000 },
  { label: "Oltre 2000€", maxPrice: undefined, min: 2000, max: null },
  { label: "Non lo so ancora", maxPrice: undefined, min: null, max: null },
] as const;

export const URGENCY_OPTIONS = [
  { label: "Subito", value: "alta" as const },
  { label: "Questa settimana", value: "alta" as const },
  { label: "Questo mese", value: "media" as const },
  { label: "Sto esplorando", value: "bassa" as const },
];
