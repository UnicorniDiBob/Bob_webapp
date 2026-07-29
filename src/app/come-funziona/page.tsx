import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, Search, Star, type LucideIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Come funziona",
  description:
    "BOB ti aiuta a trovare il professionista giusto in pochi passi: racconti il problema, ricevi profili adatti con prezzi e rating, e contatti chi vuoi.",
};

const STEPS: { n: string; icon: LucideIcon; title: string; text: string }[] = [
  {
    n: "1",
    icon: MessageCircle,
    title: "Racconta a Bob cosa ti serve",
    text: "Descrivi il problema con parole tue. Bob ti fa qualche domanda su servizio, città, urgenza e budget — niente moduli complicati.",
  },
  {
    n: "2",
    icon: Search,
    title: "Bob filtra i professionisti adatti",
    text: "In base a quello che gli dici, Bob seleziona i professionisti più rilevanti. Usa il prezzo per ordinarli, ma il dettaglio lo trovi sempre nella scheda.",
  },
  {
    n: "3",
    icon: Star,
    title: "Confronti prezzo, rating e disponibilità",
    text: "Vedi subito chi è verificato, quanto costa e cosa dicono gli altri clienti. La scelta resta sempre tua.",
  },
  {
    n: "4",
    icon: Mail,
    title: "Contatti chi preferisci",
    text: "Bob prepara il primo messaggio, tu lo personalizzi e lo invii. Puoi contattare uno o più professionisti e seguire tutto dalla tua area personale.",
  },
];

export default function ComeFunzionaPage() {
  return (
    <div className="container-bob py-12">
      <header className="mx-auto max-w-2xl text-center">
        <span className="section-eyebrow">Come funziona</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-bob-ink sm:text-4xl">
          Trovare un professionista, senza il solito caos
        </h1>
        <p className="mt-3 text-base text-bob-ink/65">
          Raccontami il problema e ti aiuto a capire chi contattare, con più
          chiarezza su prezzo, disponibilità e qualità.
        </p>
      </header>

      <div className="mx-auto mt-10 grid grid-cols-1 max-w-4xl gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.n} className="card flex gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bob-indigo-50 text-bob-indigo">
              <s.icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-bob-indigo">
                  PASSO {s.n}
                </span>
              </div>
              <h2 className="mt-0.5 font-semibold text-bob-ink">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-bob-ink/65">
                {s.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Modello: niente lead a pagamento */}
      <section className="mx-auto mt-10 max-w-3xl rounded-2xl bg-bob-indigo-50 p-7 text-center">
        <h2 className="text-lg font-semibold text-bob-ink">
          Gratis per te, equo per i professionisti
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-bob-ink/65">
          Per chi cerca un servizio, BOB è gratis. Non vendiamo contatti: i
          professionisti pagano una fee solo a lavoro concluso. Così tutti hanno
          interesse a far andare bene le cose.
        </p>
      </section>

      <div className="mt-10 flex flex-col items-center gap-3">
        <Link href="/" className="btn-primary px-6 py-3" data-testid="cta-parla-con-bob">
          Parla con Bob
        </Link>
        <Link
          href="/professionisti"
          className="text-sm font-medium text-bob-indigo hover:underline"
        >
          oppure sfoglia i professionisti
        </Link>
      </div>
    </div>
  );
}
