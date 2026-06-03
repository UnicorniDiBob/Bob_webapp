// Emoji semplici per dare ritmo visivo alle categorie (nessuna dipendenza esterna).
const ICONS: Record<string, string> = {
  idraulico: "🔧",
  elettricista: "💡",
  pulizie: "🧽",
  imbianchino: "🎨",
  traslochi: "📦",
  tuttofare: "🛠️",
  "personal-trainer": "🏋️",
  dj: "🎧",
  fotografo: "📷",
  ripetizioni: "📚",
  "supporto-excel": "📊",
  giardiniere: "🌿",
  serramentista: "🪟",
  "grafica-logo": "✏️",
  "sviluppo-web": "💻",
};

export function serviceIcon(slug: string): string {
  return ICONS[slug] ?? "📍";
}
