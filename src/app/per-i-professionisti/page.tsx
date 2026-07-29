import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Bot, Euro, HandCoins, type LucideIcon } from "lucide-react";
import { Faq } from "@/components/Faq";

export const metadata: Metadata = {
  title: "Per i professionisti",
  description:
    "Su BOB non paghi per i contatti: la fee si applica solo a lavoro concluso. Profilo verificato, prezzi in chiaro e clienti che ti scelgono davvero.",
};

const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: HandCoins,
    title: "Niente lead a pagamento",
    text: "Non vendiamo contatti. Paghi una fee solo quando un lavoro si chiude davvero: zero costi a vuoto.",
  },
  {
    icon: BadgeCheck,
    title: "Profilo verificato",
    text: "Il badge di verifica racconta ai clienti che possono fidarsi. Più trasparenza, più richieste di qualità.",
  },
  {
    icon: Euro,
    title: "Prezzi in chiaro",
    text: "Mostri le tue tariffe in modo onesto. I clienti arrivano già informati, le trattative sono più semplici.",
  },
  {
    icon: Bot,
    title: "Bob lavora per te",
    text: "Nel tuo spazio di lavoro trovi già calendario appuntamenti, riassunti AI delle richieste e portfolio foto. In arrivo: contabilità.",
  },
];

const PRO_FAQ = [
  {
    q: "Quanto mi costa essere su BOB?",
    a: "Iscriverti, ricevere richieste e messaggiare con i clienti è gratis, oggi e sempre. Durante il pilota non paghi nulla. A regime, l'unica fee sarà l'8% sui lavori in cui scegli tu di attivare la Garanzia Bob (pagamento protetto, recensioni verificate, mediazione in caso di problemi): mai obbligatoria, mai sui semplici contatti.",
  },
  {
    q: "Come ottengo il badge verificato?",
    a: "Dopo la registrazione il nostro team ti contatta per i controlli di base (identità e attività). Una volta superati, il profilo diventa verificato e più visibile.",
  },
  {
    q: "Devo mostrare per forza i prezzi?",
    a: "Ti consigliamo di farlo: i clienti su BOB cercano chiarezza. Puoi indicare una tariffa oraria, una forbice di prezzo o una nota esplicativa.",
  },
  {
    q: "In quali città posso lavorare?",
    a: "Il pilota è a Milano. Stiamo aprendo Roma e Torino: registrandoti ora entri tra i primi professionisti quando arriviamo nella tua città.",
  },
];

export default function PerIProfessionistiPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-bob-indigo text-white">
        <div className="container-bob py-16 text-center sm:py-20">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            Per i professionisti
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Più lavoro vero, zero contatti comprati
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-white/80">
            BOB ti porta clienti che cercano davvero il tuo servizio. Paghi solo
            quando concludi un lavoro — non per ricevere un numero di telefono.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link
              href="/login?mode=signup&role=professional"
              className="rounded-xl bg-bob-yellow px-6 py-3 text-sm font-semibold text-bob-ink hover:brightness-95"
              data-testid="cta-registrati-pro"
            >
              Registrati come professionista
            </Link>
            <Link
              href="/come-funziona"
              className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Come funziona
            </Link>
          </div>
        </div>
      </section>

      {/* Benefici */}
      <section className="container-bob py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.title} className="card flex gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bob-indigo-50 text-bob-indigo">
                <b.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold text-bob-ink">{b.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-bob-ink/65">
                  {b.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Costi in chiaro: la stessa trasparenza che chiediamo ai professionisti */}
      <section className="container-bob pb-12">
        <div className="rounded-2xl border border-black/5 bg-white p-7">
          <h2 className="text-lg font-semibold text-bob-ink">
            Quanto costa, in chiaro
          </h2>
          <p className="mt-1 text-sm text-bob-ink/60">
            Chiediamo ai professionisti prezzi trasparenti: ecco i nostri.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-black/5 p-4">
              <p className="text-sm font-semibold text-bob-ink">
                Iscrizione e contatti
              </p>
              <p className="mt-1 text-2xl font-bold text-bob-ink">Gratis</p>
              <p className="mt-1 text-xs leading-relaxed text-bob-ink/60">
                Profilo, richieste e messaggi con i clienti: gratuiti oggi e
                sempre. Niente lead a pagamento.
              </p>
            </div>
            <div className="rounded-xl border border-black/5 p-4">
              <p className="text-sm font-semibold text-bob-ink">
                Fee sul lavoro concluso
              </p>
              <p className="mt-1 text-2xl font-bold text-bob-ink">
                8%
                <span className="ml-1 text-sm font-medium text-bob-ink/50">
                  solo con Garanzia Bob
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-bob-ink/60">
                Si applica solo se attivi la Garanzia Bob sul lavoro: pagamento
                protetto, recensioni verificate, mediazione. Mai obbligatoria.
              </p>
            </div>
            <div className="rounded-xl border border-black/5 p-4">
              <p className="text-sm font-semibold text-bob-ink">
                Strumenti in più
              </p>
              <p className="mt-1 text-2xl font-bold text-bob-ink">
                Da €19<span className="text-sm font-medium text-bob-ink/50">/mese</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-bob-ink/60">
                Abbonamenti opzionali Pro e Business per portfolio esteso e più
                visibilità. Durante il pilota sono inclusi gratuitamente.
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-bob-ink/45">
            Durante il pilota a Milano non paghi nulla: tutte le funzioni sono
            gratuite mentre costruiamo la piattaforma insieme ai primi
            professionisti.
          </p>
        </div>
      </section>

      {/* Come funziona lato pro */}
      <section className="container-bob pb-12">
        <div className="rounded-2xl border border-black/5 bg-white p-7">
          <h2 className="text-lg font-semibold text-bob-ink">In 3 passi</h2>
          <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <li className="flex flex-col gap-1">
              <span className="text-sm font-bold text-bob-indigo">1.</span>
              <span className="font-medium text-bob-ink">Crea il profilo</span>
              <span className="text-sm text-bob-ink/60">
                Registrati, racconta cosa offri e a che prezzo.
              </span>
            </li>
            <li className="flex flex-col gap-1">
              <span className="text-sm font-bold text-bob-indigo">2.</span>
              <span className="font-medium text-bob-ink">Ricevi richieste</span>
              <span className="text-sm text-bob-ink/60">
                I clienti adatti ti contattano tramite Bob.
              </span>
            </li>
            <li className="flex flex-col gap-1">
              <span className="text-sm font-bold text-bob-indigo">3.</span>
              <span className="font-medium text-bob-ink">Concludi e paghi la fee</span>
              <span className="text-sm text-bob-ink/60">
                Solo a lavoro chiuso, niente costi a vuoto.
              </span>
            </li>
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-bob pb-16">
        <h2 className="mb-5 text-center text-xl font-bold text-bob-ink">
          Domande frequenti
        </h2>
        <Faq items={PRO_FAQ} />
      </section>
    </div>
  );
}
