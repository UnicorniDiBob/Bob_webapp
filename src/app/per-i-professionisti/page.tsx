import type { Metadata } from "next";
import Link from "next/link";
import { Bob } from "@/components/Bob";
import { Faq } from "@/components/Faq";
import { Rivela } from "@/components/Rivela";
import { Attrezzo, Cerchio } from "@/components/SceneBob";
import { Blocco, Fascia, TestaSezione } from "@/components/sezioni";
import { BobDot, BobBullet } from "@/components/ui";

export const metadata: Metadata = {
  title: "Per i professionisti",
  description:
    "Su BOB non paghi per i contatti: la fee si applica solo a lavoro concluso. Profilo verificato, prezzi in chiaro e clienti che ti scelgono davvero.",
};

/**
 * I benefici non hanno piu' un'icona. Erano quattro quadratini arrotondati con
 * dentro un simbolo di libreria: e' esattamente il segno «costruito in fretta
 * col preset» che l'audit dell'11 settembre elencava fra le cause del look «da
 * AI». Il blocco con la riga gialla dice la stessa cosa senza dirla in
 * stock-icon.
 */
const BENEFITS: { title: string; text: string }[] = [
  {
    title: "Niente lead a pagamento",
    text: "Non vendiamo contatti. Paghi una fee solo quando un lavoro si chiude davvero: zero costi a vuoto.",
  },
  {
    title: "Profilo verificato",
    text: "Il badge di verifica racconta ai clienti che possono fidarsi. Più trasparenza, più richieste di qualità.",
  },
  {
    title: "Prezzi in chiaro",
    text: "Mostri le tue tariffe in modo onesto. I clienti arrivano già informati, le trattative sono più semplici.",
  },
  {
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
    <>
      {/* ---------- EROE ---------- */}
      <Fascia sfondo="forte">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.62fr)] lg:gap-16">
          <div>
            <span className="section-eyebrow text-bob-yellow">
              Per i professionisti
            </span>
            <h1 className="mt-3 max-w-[16ch] text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Più lavoro vero, zero contatti comprati
            </h1>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-white/75">
              BOB ti porta clienti che cercano davvero il tuo servizio. Paghi
              solo quando concludi un lavoro — non per ricevere un numero di
              telefono.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login?mode=signup&role=professional"
                className="rounded-xl bg-bob-yellow px-6 py-3 text-center text-base font-semibold text-bob-ink hover:brightness-95"
                data-testid="cta-registrati-pro"
              >
                Registrati come professionista
              </Link>
              {/* Prima puntava a /come-funziona, che è la spiegazione per il
                  CLIENTE ("Parla con Bob", "gratis per te"): mandava il
                  professionista nel funnel sbagliato. Ora resta su questa
                  pagina.
                  <a> e non <Link>: con next/link l'ancora sulla stessa pagina
                  non scrolla (il router intercetta il click e la navigazione
                  hash-only resta un no-op — verificato in produzione il 10/08,
                  l'hash cambiava senza muovere la pagina e al secondo
                  tentativo non cambiava nemmeno). L'ancora nativa scrolla, con
                  lo scroll-margin che `Fascia` mette quando le si dà un id. */}
              <a
                href="#come-funziona"
                className="rounded-xl border border-white/30 px-6 py-3 text-center text-base font-semibold text-white hover:bg-white/10"
              >
                Come funziona per te
              </a>
            </div>
          </div>

          {/* Bob col tondo chiaro dietro: la sua salopette è lo stesso indaco
              della fascia, e senza fondo si perderebbe nello sfondo. */}
          <div className="animate-fade-up [animation-delay:80ms]">
            <Cerchio tinta="bg-bob-indigo-100" appoggio="bg-white/25">
              <Bob
                posa="neutro"
                gradiBraccioDestro={-28}
                attrezzoDestro={<Attrezzo tipo="chiave" />}
                fuoriBordo
                alt="Bob, con la chiave inglese in mano"
                className="absolute bottom-[7%] left-1/2 w-[62%] -translate-x-1/2"
              />
            </Cerchio>
          </div>
        </div>
      </Fascia>

      {/* ---------- I VANTAGGI ---------- */}
      <Fascia sfondo="bianca">
        <TestaSezione
          occhiello="I vantaggi"
          titolo="Cosa cambia, per te"
          allineamento="sinistra"
          misura="stretta"
        />
        {/* items-start e non lo stiramento predefinito della griglia: se i
            blocchi si allungano tutti all'altezza del più alto, la riga gialla
            di quello col testo più corto resta con un pezzo vuoto sotto. */}
        <Rivela ritardo={60}>
          <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12">
            {BENEFITS.map((b) => (
              <Blocco key={b.title} titolo={b.title}>
                {b.text}
              </Blocco>
            ))}
          </div>
        </Rivela>
      </Fascia>

      {/* ---------- COME FUNZIONA, LATO PRO — bersaglio della CTA nell'eroe ---------- */}
      <Fascia sfondo="tenue" id="come-funziona">
        <TestaSezione
          occhiello="Come funziona per te"
          titolo="Dalla registrazione al lavoro chiuso"
          sottotitolo="Senza comprare un contatto, in quattro passaggi."
          allineamento="sinistra"
        />
        <ol className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {PRO_STEPS.map((s, i) => (
            <Rivela key={s.n} ritardo={i * 80}>
              <li>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bob-indigo text-lg font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-xl font-bold tracking-tight text-bob-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-bob-ink/70">
                  {s.text}
                </p>
              </li>
            </Rivela>
          ))}
        </ol>
      </Fascia>

      {/* ---------- QUANTO COSTA: la stessa trasparenza che chiediamo a loro ---------- */}
      <Fascia sfondo="forte">
        <TestaSezione
          occhiello="I costi"
          titolo="Quanto costa, in chiaro"
          sottotitolo="Chiediamo ai professionisti prezzi trasparenti: ecco i nostri."
          tinta="chiara"
          allineamento="sinistra"
          misura="stretta"
        />
        <Rivela ritardo={60}>
          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            <Cifra
              titolo="Iscrizione e contatti"
              cifra="Gratis"
              testo="Profilo, richieste e messaggi con i clienti: gratuiti oggi e sempre, su qualsiasi piano. Niente lead a pagamento."
            />
            <Cifra
              titolo="Fee sul lavoro concluso"
              cifra="8%"
              nota="solo con Garanzia Bob"
              testo="Si applica solo se attivi la Garanzia Bob sul lavoro: pagamento protetto, recensioni verificate, mediazione. Mai obbligatoria."
            />
          </div>
        </Rivela>
      </Fascia>

      {/* ---------- I PIANI ---------- */}
      <Fascia sfondo="bianca">
        <TestaSezione
          occhiello="Piani"
          titolo="Scegli quanto vuoi che Bob lavori per te"
          sottotitolo="Il piano riguarda gli strumenti di lavoro, non i contatti: quelli non si pagano su nessun piano."
          allineamento="sinistra"
        />
        {/* Qui la scheda resta, ed è l'unico posto della pagina dove se la
            merita: tre prodotti da confrontare voce per voce sono esattamente
            il caso per cui la scheda esiste. */}
        <div className="mt-12 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <Rivela key={p.name} ritardo={i * 80} className="h-full">
              <div
                className={`flex h-full flex-col rounded-2xl border bg-white p-7 ${
                  p.featured
                    ? "border-bob-indigo shadow-card-hover ring-1 ring-bob-indigo/20"
                    : "border-black/5"
                }`}
                data-testid={`plan-${p.name.toLowerCase()}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-bob-ink">
                    Bob {p.name}
                  </h3>
                  {p.featured && (
                    <span className="rounded-full bg-bob-yellow px-2.5 py-1 text-xs font-semibold text-bob-ink">
                      Consigliato
                    </span>
                  )}
                </div>
                <p className="mt-4 text-4xl font-extrabold tracking-tight text-bob-ink">
                  {p.price}
                </p>
                <p className="mt-1 text-sm text-bob-ink/70">{p.priceNote}</p>
                <p className="mt-4 text-base leading-relaxed text-bob-ink/70">
                  {p.pitch}
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-base text-bob-ink/75">
                  {p.features.map((f) => (
                    <BobBullet key={f}>{f}</BobBullet>
                  ))}
                </ul>
                <Link
                  href="/login?mode=signup&role=professional"
                  className={`mt-7 rounded-xl px-5 py-3 text-center text-base font-semibold ${
                    p.featured
                      ? "bg-bob-indigo text-white hover:brightness-110"
                      : "border border-black/10 text-bob-ink hover:bg-black/[0.03]"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            </Rivela>
          ))}
        </div>

        <p className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-bob-ink/70">
          <span className="inline-flex items-center gap-1.5">
            <BobDot /> Add-on Visibility Boost: 15 €/mese, sempre etichettato
            come tale
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BobDot /> Cambi o disdici quando vuoi, senza penali
          </span>
        </p>
      </Fascia>

      {/* ---------- DOMANDE FREQUENTI ---------- */}
      <Fascia sfondo="tenue">
        <TestaSezione
          occhiello="Dubbi"
          titolo="Domande frequenti"
          allineamento="sinistra"
        />
        {/* `max-w-2xl` senza `mx-auto`: la colonna di lettura parte dal bordo
            del contenitore come tutto il resto della pagina. Centrata sarebbe
            matematicamente al centro e visivamente storta rispetto ai titoli
            sopra — lo stesso errore fatto e corretto su /come-funziona. */}
        <div className="mt-10 w-full max-w-2xl">
          <Faq items={PRO_FAQ} />
        </div>
      </Fascia>
    </>
  );
}

/**
 * Una cifra in chiaro sulla fascia indaco: riga gialla, etichetta, il numero
 * grande, la spiegazione.
 *
 * Non è un `Blocco`, perché in un `Blocco` la cifra finirebbe dentro il
 * paragrafo e sparirebbe: qui il numero È il messaggio, e deve leggersi prima
 * del testo che lo spiega.
 */
function Cifra({
  titolo,
  cifra,
  nota,
  testo,
}: {
  titolo: string;
  cifra: string;
  nota?: string;
  testo: string;
}) {
  return (
    <div className="border-l-4 border-bob-yellow pl-6">
      <p className="text-base font-semibold text-white/75">{titolo}</p>
      <p className="mt-1 text-4xl font-extrabold tracking-tight">
        {cifra}
        {nota && (
          <span className="ml-2 align-middle text-base font-medium text-white/70">
            {nota}
          </span>
        )}
      </p>
      <p className="mt-3 max-w-[46ch] text-base leading-relaxed text-white/75">
        {testo}
      </p>
    </div>
  );
}
