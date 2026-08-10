import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Bot, Euro, HandCoins, type LucideIcon } from "lucide-react";
import { Faq } from "@/components/Faq";
import { BobDot, BobBullet } from "@/components/ui";

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
    text: "Nel tuo spazio di lavoro: agenda appuntamenti, riassunti AI delle richieste, preventivi e portfolio dei lavori. Bob prepara il materiale, tu decidi.",
  },
];

// Piani di abbonamento. Fonte di verità del listino e delle funzioni incluse:
// Business Plan §6.2 (flusso di ricavo 1). I prezzi mensili sono quelli pieni;
// la cifra annuale è lo stesso piano con fatturazione annuale.
const PLANS: {
  name: string;
  price: string;
  priceNote: string;
  pitch: string;
  features: string[];
  cta: string;
  featured?: boolean;
}[] = [
  {
    name: "Free",
    price: "€0",
    priceNote: "per sempre",
    pitch: "Esserci, ricevere richieste e parlare con i clienti.",
    features: [
      "Profilo pubblico con le tue tariffe",
      "Messaggi con i clienti, senza intermediari",
      "Richieste con un tetto mensile",
      "Nessun costo per i contatti, mai",
    ],
    cta: "Inizia gratis",
  },
  {
    name: "Pro",
    price: "€24",
    priceNote: "al mese — €19 con fatturazione annuale",
    pitch: "Gli strumenti per vincere più lavori e chiuderli prima.",
    featured: true,
    features: [
      "Badge verificato sul profilo",
      "Ranking privilegiato nei risultati",
      "Richieste illimitate",
      "Preventivi digitali",
      "Agenda appuntamenti e prenotazione diretta",
      "Assistente AI sulle richieste",
      "Portfolio lavori: 1 foto con descrizione",
    ],
    cta: "Scegli Pro",
  },
  {
    name: "Business",
    price: "€59",
    priceNote: "al mese — €49 con fatturazione annuale",
    pitch: "Tutto il Pro, più l'amministrazione e i numeri.",
    features: [
      "Tutto quello che c'è nel Pro",
      "Fatturazione elettronica integrata",
      "Pagamenti inclusi",
      "Analytics avanzate sul tuo lavoro",
      "Supporto prioritario",
      "Portfolio illimitato con galleria in evidenza",
    ],
    cta: "Scegli Business",
  },
];

const PRO_STEPS: { n: string; title: string; text: string }[] = [
  {
    n: "1",
    title: "Crea il profilo",
    text: "Racconta cosa offri, in quali zone lavori e a che prezzo. Dieci minuti, una volta.",
  },
  {
    n: "2",
    title: "Ottieni la verifica",
    text: "Comunichi la partita IVA, noi controlliamo identità e attività. Il badge verificato è il primo segnale che i clienti guardano.",
  },
  {
    n: "3",
    title: "Ricevi richieste già filtrate",
    text: "Bob raccoglie il contesto dal cliente — servizio, zona, urgenza, budget — e ti arriva una richiesta con il riassunto già scritto.",
  },
  {
    n: "4",
    title: "Chiudi il lavoro",
    text: "Concordi tu prezzo e tempi. Se attivi la Garanzia Bob, il pagamento è protetto e la recensione diventa verificata.",
  },
];

const PRO_FAQ = [
  {
    q: "Quanto mi costa essere su BOB?",
    a: "Iscriverti, ricevere richieste e messaggiare con i clienti è gratis, oggi e sempre: il piano Free non scade. Se vuoi gli strumenti di lavoro ci sono Bob Pro (24 €/mese, 19 € con fatturazione annuale) e Bob Business (59 €/mese, 49 € annuale). L'unica commissione è l'8% sui lavori in cui scegli tu di attivare la Garanzia Bob: mai obbligatoria, mai sui semplici contatti.",
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
    a: "Oggi lavoriamo a Milano e stiamo aprendo Roma e Torino. Registrandoti ora il tuo profilo è pronto dal primo giorno nella tua città.",
  },
  {
    q: "Posso cambiare o disdire il piano?",
    a: "Sì, in qualsiasi momento dall'area riservata: nessun costo di disdetta, nessuna penale, nessun vincolo di durata.",
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
            {/* Prima puntava a /come-funziona, che è la spiegazione per il
                CLIENTE ("Parla con Bob", "gratis per te"): mandava il
                professionista nel funnel sbagliato. Ora resta su questa pagina.
                <a> e non <Link>: con next/link l'ancora sulla stessa pagina non
                scrolla (il router intercetta il click e la navigazione hash-only
                resta un no-op — verificato in produzione il 10/08, l'hash
                cambiava senza muovere la pagina e al secondo tentativo non
                cambiava nemmeno). L'ancora nativa scrolla, con scroll-mt-24
                sulla sezione che compensa l'header fisso. */}
            <a
              href="#come-funziona"
              className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Come funziona per te
            </a>
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

      {/* Come funziona lato pro — bersaglio della CTA nell'hero */}
      <section id="come-funziona" className="container-bob scroll-mt-24 pb-12">
        <div className="rounded-2xl border border-black/5 bg-white p-7">
          <h2 className="text-lg font-semibold text-bob-ink">
            Come funziona per te
          </h2>
          <p className="mt-1 text-sm text-bob-ink/60">
            Dalla registrazione al lavoro chiuso, senza comprare un contatto.
          </p>
          <ol className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PRO_STEPS.map((s) => (
              <li key={s.n} className="flex flex-col gap-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-bob-indigo text-sm font-bold text-white">
                  {s.n}
                </span>
                <span className="mt-1 font-medium text-bob-ink">{s.title}</span>
                <span className="text-sm leading-relaxed text-bob-ink/60">
                  {s.text}
                </span>
              </li>
            ))}
          </ol>
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

          {/* Le due voci che non dipendono dal piano */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-black/5 p-4">
              <p className="text-sm font-semibold text-bob-ink">
                Iscrizione e contatti
              </p>
              <p className="mt-1 text-2xl font-bold text-bob-ink">Gratis</p>
              <p className="mt-1 text-xs leading-relaxed text-bob-ink/60">
                Profilo, richieste e messaggi con i clienti: gratuiti oggi e
                sempre, su qualsiasi piano. Niente lead a pagamento.
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
          </div>
        </div>
      </section>

      {/* Piani */}
      <section className="container-bob pb-12">
        <div className="text-center">
          <span className="section-eyebrow">Piani</span>
          <h2 className="mt-1 text-xl font-bold text-bob-ink">
            Scegli quanto vuoi che Bob lavori per te
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-bob-ink/60">
            Il piano riguarda gli strumenti di lavoro, non i contatti: quelli
            non si pagano su nessun piano.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded-2xl border bg-white p-6 ${
                p.featured
                  ? "border-bob-indigo shadow-card-hover ring-1 ring-bob-indigo/20"
                  : "border-black/5"
              }`}
              data-testid={`plan-${p.name.toLowerCase()}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-bob-ink">
                  Bob {p.name}
                </h3>
                {p.featured && (
                  <span className="rounded-full bg-bob-yellow px-2.5 py-1 text-xs font-semibold text-bob-ink">
                    Consigliato
                  </span>
                )}
              </div>
              <p className="mt-3 text-3xl font-extrabold text-bob-ink">
                {p.price}
              </p>
              <p className="mt-1 text-xs text-bob-ink/55">{p.priceNote}</p>
              <p className="mt-3 text-sm leading-relaxed text-bob-ink/65">
                {p.pitch}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-bob-ink/75">
                {p.features.map((f) => (
                  <BobBullet key={f}>{f}</BobBullet>
                ))}
              </ul>
              <Link
                href="/login?mode=signup&role=professional"
                className={`mt-6 rounded-xl px-5 py-3 text-center text-sm font-semibold ${
                  p.featured
                    ? "bg-bob-indigo text-white hover:brightness-110"
                    : "border border-black/10 text-bob-ink hover:bg-black/[0.03]"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-bob-ink/55">
          <span className="inline-flex items-center gap-1.5">
            <BobDot /> Add-on Visibility Boost: 15 €/mese, sempre etichettato
            come tale
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BobDot /> Cambi o disdici quando vuoi, senza penali
          </span>
        </p>
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
