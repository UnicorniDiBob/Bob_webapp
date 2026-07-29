// Icone di categoria: set unico e coerente (lucide-react), monocromatiche e
// colorabili con currentColor. Sostituiscono le emoji, che rendevano in modo
// diverso su ogni piattaforma (e per alcune categorie non rendevano affatto
// su Android/Windows meno recenti).
import {
  Blinds,
  BookOpen,
  Camera,
  Code,
  Dumbbell,
  Hammer,
  Laptop,
  Music,
  PaintRoller,
  PenTool,
  SprayCan,
  Sprout,
  Tag,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  idraulico: Wrench,
  elettricista: Zap,
  pulizie: SprayCan,
  imbianchino: PaintRoller,
  traslochi: Truck,
  tuttofare: Hammer,
  "personal-trainer": Dumbbell,
  "musica-intrattenimento": Music,
  fotografo: Camera,
  ripetizioni: BookOpen,
  "supporto-informatico": Laptop,
  giardiniere: Sprout,
  serramentista: Blinds,
  "grafica-logo": PenTool,
  "sviluppo-web": Code,
};

/** Componente icona per uno slug di servizio. Decorativa: aria-hidden. */
export function ServiceIcon({
  slug,
  className = "h-5 w-5",
}: {
  slug: string;
  className?: string;
}) {
  const Icon = ICONS[slug] ?? Tag;
  return <Icon className={className} aria-hidden="true" />;
}
