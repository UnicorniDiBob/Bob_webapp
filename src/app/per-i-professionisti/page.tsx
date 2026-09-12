import type { Metadata } from "next";
import Link from "next/link";
import { BobConCariola } from "@/components/BobConCariola";
import { Faq } from "@/components/Faq";
import { Rivela } from "@/components/Rivela";
import { Blocco, Fascia, TestaSezione } from "@/components/sezioni";
import { BobDot } from "@/components/ui";
import { TabellaPiani } from "@/components/TabellaPiani";

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
    a: "Iscriverti, ricevere richieste e messaggiare con i clienti è gratis, oggi e sempre: il piano Free non scade. Se vuoi gli strumenti di lavoro ci sono Bob Plus (24 €/mese, 19 € con fatturazione annuale) e Bob Business (59 €/mese, 49 € annuale). L'unica commissione è l'8% sui lavori in cui scegli tu di attivare la Garanzia Bob: è la stessa su tutti e tre i piani, non cambia con l'abbonamento, e non si paga mai sui semplici contatti.",
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
            <div className="mt-8">
              <Link
                href="/login?mode=signup&role=professional"
                className="inline-block rounded-xl bg-bob-yellow px-6 py-3 text-center text-base font-semibold text-bob-ink hover:brightness-95"
                data-testid="cta-registrati-pro"
              >
                Registrati come professionista
              </Link>
            </div>
          </div>

          <div className="animate-fade-up [animation-delay:80ms]">
            <BobConCariola />
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
              nota="su tutti e tre i piani"
              testo="La stessa percentuale su Free, Bob Plus e Bob Business: il piano non la cambia. Si applica solo se attivi la Garanzia Bob sul lavoro — pagamento protetto, recensioni verificate, mediazione — e non è mai obbligatoria."
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
        {/* LA TABELLA, NON TRE SCHEDE (12/09). Tre elenchi puntati affiancati
            rispondono bene a «cosa c'è nel Business» e male alla domanda che
            si fa chi sceglie: «questa cosa, nel Free, ce l'ho o no?». Con tre
            elenchi l'assenza non si vede — bisogna scorrere l'altro elenco e
            accorgersi che manca. In tabella l'assenza è una casella vuota alla
            stessa altezza della spunta. Le righe stanno in src/lib/piani.ts,
            insieme ai piani: qui c'è solo il posto dove si mostrano. */}
        <Rivela ritardo={60}>
          <div className="mt-12">
            <TabellaPiani
              evidenzia="pro"
              ctaHref="/login?mode=signup&role=professional"
            />
          </div>
        </Rivela>

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
        {/* Questa fascia e' centrata TUTTA, titolo compreso, e per questo
            funziona: il difetto di /come-funziona era una colonna centrata
            sotto un titolo allineato a sinistra — due bordi diversi nella
            stessa fascia. Qui il blocco e' centrato come unita' e si legge
            come una scelta, non come uno storto. */}
        <TestaSezione occhiello="Dubbi" titolo="Domande frequenti" />
        <div className="colonna-lettura mt-10">
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
