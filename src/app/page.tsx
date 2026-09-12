import Link from "next/link";
import { getCities, getServices } from "@/lib/data";
import { BobChat } from "@/components/BobChat";
import { RicercaBox } from "@/components/RicercaBox";
import { BobCheSaluta } from "@/components/BobCheSaluta";
import { BobConElenco } from "@/components/BobConElenco";
import { Rivela } from "@/components/Rivela";
import {
  ScenaRichiesta,
  ScenaConfronto,
  ScenaMessaggio,
} from "@/components/SceneBob";

export const revalidate = 120;

/**
 * La home.
 *
 * PERCHE' E' FATTA A FASCE. Prima era tutta su un unico fondo quasi bianco, e
 * su un monitor grande sembrava vuota. Il problema non era la larghezza — quella
 * l'abbiamo gia' portata a 1600 e non e' bastato: era che non c'era niente da
 * guardare. Le fasce si alternano (indaco chiaro, bianco, grigio, indaco pieno,
 * bianco, grigio, bianco, piede scuro) e arrivano da bordo a bordo, mentre il
 * testo resta dentro `container-bob`. E' lo spazio che si riempie, non la riga
 * che si allunga.
 *
 * L'EROE NON HA TESTO. Solo Bob e la chat, come nello schizzo di André del
 * 12 settembre. L'H1 della pagina vive sopra la barra di ricerca: una pagina
 * senza H1 e' un problema per la ricerca, ma non serve un titolone per averlo.
 */
export default async function HomePage() {
  // `services` serve ancora: BobChat lo usa per far scegliere il servizio a
  // chi preferisce non descrivere il problema a parole.
  const [cities, services] = await Promise.all([getCities(), getServices()]);

  return (
    <>
      {/* ---------- EROE: Bob e la chat, niente altro ---------- */}
      <section
        id="bob"
        className="scroll-mt-20 border-b border-black/5 bg-gradient-to-b from-bob-indigo-50 to-transparent"
      >
        <div className="container-bob grid grid-cols-1 items-end gap-8 py-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-14 lg:py-16">
          <div className="animate-fade-up justify-self-center lg:justify-self-stretch">
            <BobCheSaluta className="mx-auto w-40 sm:w-52 lg:w-full lg:max-w-[380px]" />
          </div>
          <div className="animate-fade-up [animation-delay:80ms]">
            <BobChat cities={cities} services={services} />
          </div>
        </div>
      </section>

      {/* ---------- RICERCA: qui vive l'H1 ---------- */}
      <section className="border-b border-black/5 bg-white">
        <div className="container-bob py-10 sm:py-12">
          <h1 className="max-w-[22ch] text-2xl font-extrabold tracking-tight text-bob-ink sm:text-3xl lg:text-4xl">
            Cosa cerchi?
          </h1>
          <div className="mt-6">
            <RicercaBox />
          </div>
        </div>
      </section>

      {/* ---------- COME FUNZIONA: tre passi illustrati ---------- */}
      <section className="bg-bob-indigo-50/40 py-16 sm:py-20">
        <div className="container-bob">
          <Rivela className="text-center">
            <span className="section-eyebrow">Come funziona</span>
            <h2 className="mx-auto mt-3 max-w-[24ch] text-3xl font-extrabold tracking-tight text-bob-ink sm:text-4xl">
              Trovare il professionista giusto, senza telefonate a vuoto
            </h2>
          </Rivela>

          <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            <Passo
              ritardo={0}
              numero="Passo 1"
              titolo="Racconta il problema"
              testo="Con parole tue, anche se non sai quale professionista cercare. A Bob puoi scrivere «gocciola da stanotte»."
            >
              <ScenaRichiesta />
            </Passo>
            <Passo
              ritardo={90}
              numero="Passo 2"
              titolo="Bob filtra per te"
              testo="Zona, urgenza, budget. Restano i professionisti che quel lavoro lo fanno davvero, ordinati con criteri pubblici."
            >
              <ScenaConfronto />
            </Passo>
            <Passo
              ritardo={180}
              numero="Passo 3"
              titolo="Scegli tu con chi parlare"
              testo="Tempi di risposta misurati, valutazioni vere, prezzo quando è dichiarato. Il primo messaggio lo scrive Bob."
            >
              <ScenaMessaggio />
            </Passo>
          </div>

          <Rivela className="mt-10 text-center">
            <Link href="/come-funziona" className="btn-secondary">
              Vedi tutti i dettagli →
            </Link>
          </Rivela>
        </div>
      </section>

      
      {/* ---------- FIDUCIA: la fascia piena ----------
          E' il pezzo che riempie davvero lo schermo. Le tre affermazioni sono
          verificabili e gia' pubblicate altrove sul sito: se una smette di
          essere vera, va cambiata QUI e su /come-funziona#ordine insieme. */}
      <section className="bg-bob-indigo py-16 text-white sm:py-20">
        <div className="container-bob grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
          <Rivela>
            <span className="section-eyebrow text-bob-yellow">Perché fidarsi</span>
            <h2 className="mt-3 max-w-[18ch] text-3xl font-extrabold tracking-tight sm:text-4xl">
              Ecco perché Bob è una scelta sicura
            </h2>
            <div className="mt-10 flex flex-col gap-8">
              <Motivo titolo="Nessuna posizione è a pagamento">
                L&apos;ordine dell&apos;elenco lo decide un punteggio pubblico:
                zona, valutazioni, tempi di risposta misurati, prezzo
                dichiarato. Nessuno lo scavalca pagando.
              </Motivo>
              <Motivo titolo="Per chi cerca, Bob è gratis">
                Nessun lead a pagamento. La fee si applica al professionista, e
                solo quando un lavoro si chiude davvero.
              </Motivo>
              <Motivo titolo="Il primo messaggio lo scrive Bob">
                Non devi spiegare lo stesso problema cinque volte: Bob prepara
                il testo e tu lo mandi a uno o più professionisti.
              </Motivo>
            </div>
          </Rivela>

          <Rivela ritardo={100} className="w-full">
            <BobConElenco />
          </Rivela>
        </div>
      </section>

      
      
          </>
  );
}

function Passo({
  numero,
  titolo,
  testo,
  ritardo,
  children,
}: {
  numero: string;
  titolo: string;
  testo: string;
  ritardo: number;
  children: React.ReactNode;
}) {
  return (
    <Rivela ritardo={ritardo} className="text-center">
      <div className="mb-7">{children}</div>
      <span className="section-eyebrow">{numero}</span>
      <h3 className="mt-2 text-xl font-bold tracking-tight text-bob-ink sm:text-2xl">
        {titolo}
      </h3>
      <p className="mx-auto mt-3 max-w-[34ch] text-base leading-relaxed text-bob-ink/70">
        {testo}
      </p>
    </Rivela>
  );
}

function Motivo({
  titolo,
  children,
}: {
  titolo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l-4 border-bob-yellow pl-6">
      <h3 className="text-xl font-bold tracking-tight sm:text-2xl">{titolo}</h3>
      <p className="mt-2 max-w-[46ch] leading-relaxed text-white/75">{children}</p>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="section-eyebrow">{eyebrow}</span>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-bob-ink sm:text-3xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 max-w-xl text-base text-bob-ink/70">{subtitle}</p>
        )}
      </div>
      {action && (
        <Link href={action.href} className="btn-secondary shrink-0 py-2 text-sm">
          {action.label}
        </Link>
      )}
    </div>
  );
}
