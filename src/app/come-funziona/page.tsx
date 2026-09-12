import type { Metadata } from "next";
import Link from "next/link";

import { ScalaDeiMestieri } from "@/components/ScalaDeiMestieri";
import {
  Bilancia,
  ScenaConfronto,
  ScenaMessaggio,
  ScenaRichiesta,
} from "@/components/SceneBob";
import { Rivela } from "@/components/Rivela";
import { Blocco, Fascia, Passo, TestaSezione } from "@/components/sezioni";

export const metadata: Metadata = {
  title: "Come funziona",
  description:
    "BOB ti aiuta a trovare il professionista giusto in pochi passi: racconti il problema, ricevi profili adatti con prezzi e rating, e contatti chi vuoi.",
};

/**
 * I PASSI SONO TRE, COME IN HOME. Fino al 12 settembre 2026 questa pagina ne
 * elencava quattro mentre la home ne raccontava tre: i vecchi 3 e 4
 * («confronti prezzo e rating», «contatti chi preferisci») sono lo stesso
 * momento visto due volte, ed erano gia’ uniti in home sotto «Scegli tu
 * con chi parlare». Una pagina di dettaglio che contraddice la pagina da cui
 * si arriva e’ un difetto, non un approfondimento. Niente e’ stato
 * tolto: il contenuto dei due passi vive nel terzo.
 */
export default function ComeFunzionaPage() {
  return (
    <>
      <Fascia sfondo="bianca" spaziatura="stretta" bordo>
        <header className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Come funziona</span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-bob-ink sm:text-4xl">
            Trovare un professionista, senza il solito caos
          </h1>
          <p className="mt-4 text-base leading-relaxed text-bob-ink/70">
            Raccontami il problema e ti aiuto a capire chi contattare, con più
            chiarezza su prezzo, disponibilità e qualità.
          </p>
        </header>
      </Fascia>

      <Fascia sfondo="tenue">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          <Passo
            ritardo={0}
            numero="Passo 1"
            titolo="Racconta a Bob cosa ti serve"
            testo="Con parole tue, anche se non sai quale professionista cercare. Bob ti fa qualche domanda su servizio, città, urgenza e budget: niente moduli."
          >
            <ScenaRichiesta />
          </Passo>
          <Passo
            ritardo={90}
            numero="Passo 2"
            titolo="Bob filtra i professionisti adatti"
            testo="Restano quelli che quel lavoro lo fanno davvero. L’ordine non è casuale e non è a pagamento: qui sotto c’è scritto come si compone."
          >
            <ScenaConfronto />
          </Passo>
          <Passo
            ritardo={180}
            numero="Passo 3"
            titolo="Scegli tu con chi parlare"
            testo="Vedi chi è verificato, quanto costa e cosa dicono gli altri clienti. Il primo messaggio lo scrive Bob: tu lo mandi a uno o più professionisti."
          >
            <ScenaMessaggio />
          </Passo>
        </div>
      </Fascia>

      <Fascia sfondo="forte">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)] lg:gap-16">
          <div>
            <TestaSezione
              occhiello="Il modello"
              titolo="Gratis per te, equo per i professionisti"
              tinta="chiara"
              allineamento="sinistra"
              misura="stretta"
            />
            {/* Impilati e non affiancati. Affiancati, le due righe gialle si
                allungano fino alla piu' alta della riga di griglia e quella
                col testo piu' corto resta con un pezzo di riga vuoto sotto:
                uguali in altezza, diverse a vedersi. In colonna il problema
                non esiste, ed e' la forma che la home usa gia'. */}
            <Rivela ritardo={60}>
              <div className="mt-10 flex flex-col gap-8">
                <Blocco tinta="chiara" titolo="Per chi cerca, Bob è gratis">
                  Non paghi niente per descrivere il problema, vedere i profili
                  e scrivere a un professionista.
                </Blocco>
                <Blocco
                  tinta="chiara"
                  titolo="I professionisti pagano a lavoro concluso"
                >
                  Non vendiamo contatti: la fee si applica solo quando un
                  lavoro si chiude davvero. Così tutti hanno interesse a far
                  andare bene le cose.
                </Blocco>
              </div>
            </Rivela>
          </div>

          <Rivela ritardo={120} className="w-full">
            <Bilancia />
          </Rivela>
        </div>
      </Fascia>

      {/* I PARAMETRI DI POSIZIONAMENTO — la sezione che i link
          «Come ordiniamo i risultati» raggiungono da ogni elenco.
          È la «sezione specifica dell'interfaccia, direttamente e facilmente
          accessibile dalla pagina in cui sono presentati i risultati» che
          chiede l'art. 22 comma 4-bis del Codice del Consumo.

          DEVE DESCRIVERE COME ORDINA IL CODICE OGGI, non come vorremmo che
          ordinasse: i criteri qui sotto sono quelli di getProfessionals() in
          src/lib/data.ts, nell'ordine in cui li applica. Quando il ranking
          passa in SQL coi pesi di docs/RICERCA.md §4, questa sezione si
          aggiorna NELLO STESSO commit — una pagina rimasta indietro qui
          dichiara il falso.

          L'ultima riga è vera oggi. Il giorno del primo slot sponsorizzato va
          sostituita, non tolta, e la scheda sponsorizzata va etichettata:
          l'allegato I punto 11-bis della 2005/29 vuole quella dichiarazione
          dentro i risultati, dove un link non arriva. */}
      <Fascia sfondo="bianca" id="ordine">
        {/* Niente `Rivela` su questa testata. La comparsa allo scorrimento
            dipende da IntersectionObserver, cioe' dal JavaScript: una
            comunicazione che l'art. 22 co. 4-bis vuole «facilmente
            accessibile» non puo' dipendere da uno script che gira. Qui il
            titolo c'e' e basta. */}
        {/* UN SOLO BORDO SINISTRO. Prima il testo stava in `colonna-lettura`,
            che e' centrata: matematicamente al centro della pagina, ma 416px
            piu' a destra del bordo di tutte le altre fasce. L'occhio non
            allinea al centro della finestra, allinea a quello che ha sopra —
            due margini diversi si leggono come uno storto. Ora la colonna
            parte dal bordo del contenitore come tutto il resto, e la larghezza
            resta una misura di lettura. */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.4fr)] lg:gap-16">
          <div>
            <span className="section-eyebrow">Trasparenza</span>
            <h2 className="mt-3 max-w-[20ch] text-3xl font-extrabold tracking-tight text-bob-ink sm:text-4xl">
              Come ordiniamo i risultati
            </h2>

            <div className="mt-10 max-w-[70ch]">

          <p className="mt-2 text-base text-bob-ink/65">
            Quando vedi un elenco di professionisti, l&apos;ordine non è casuale e
            non è alfabetico. Funziona in due tempi: <strong>prima una cosa
            sola</strong>, e poi un punteggio.
          </p>
          <p className="mt-4 text-base text-bob-ink/70">
            <strong className="text-bob-ink">
              Primo: chi fa proprio il lavoro che hai cercato.
            </strong>{" "}
            Se hai scritto «rubinetto che perde», chi ha dichiarato quell&apos;
            intervento viene prima di tutti gli altri, e nessun punteggio lo
            scavalca. Gli altri idraulici restano in elenco, sotto: la loro scheda
            dice che quel lavoro non l&apos;hanno dichiarato, così puoi
            chiederglielo lo stesso invece di non vederli affatto.
          </p>
          <p className="mt-3 text-base text-bob-ink/70">
            <strong className="text-bob-ink">
              Poi, dentro il gruppo, ordina il punteggio.
            </strong>{" "}
            Sono sette elementi e non pesano uguale. Qui sotto stanno{" "}
            <strong className="text-bob-ink">in ordine di peso</strong>: la
            valutazione è quella che conta di più, la scheda compilata quella che
            conta di meno. La zona e il tempo di risposta pesano uguale fra loro.
          </p>
          {/* L'ORDINE DI QUESTE VOCI E' UNA DICHIARAZIONE, NON UN'IMPAGINAZIONE.
              Il cappello qui sopra dice che stanno in ordine di peso: se un
              giorno i pesi in `supabase/migrations/072_punteggio_ordinamento.sql`
              cambiano, cambia anche l'ordine in cui vanno scritte, nello stesso
              commit. Oggi l'ordine dei pesi e' valutazione, poi zona e tempo di
              risposta a pari merito, poi prezzo, disponibilita', verifica,
              completezza.

              I numeri esatti non ci sono, e non e' una dimenticanza: l'art. 22
              c. 4-bis chiede «i parametri principali» e «l'importanza relativa
              di tali parametri», non i pesi ne' la formula. L'ordine dichiarato
              e' l'importanza relativa. Un elenco senza quest'ordine invece non
              basterebbe: mancherebbe meta' della norma. */}
          <ul className="mt-4 space-y-3 text-base text-bob-ink/70">
            <li>
              <strong className="text-bob-ink">La valutazione.</strong>{" "}
              Quella che pesa di più. La media dei voti, pesata sul numero di
              recensioni: cinque stelle su due giudizi contano meno di quattro e
              mezzo su venti. Poche recensioni avvicinano alla media della
              piattaforma, non a zero. Sotto le tre stelle la valutazione smette
              di dare punti.
            </li>
            <li>
              <strong className="text-bob-ink">Chi lavora dove servi tu.</strong>{" "}
              Prima chi ha dichiarato proprio la tua zona, poi chi copre la città,
              poi chi arriva da più lontano. Chi lavora in tutta Italia compare
              comunque, ma parte quasi da zero su questa voce.
            </li>
            <li>
              <strong className="text-bob-ink">
                Quanto ci mette a risponderti.
              </strong>{" "}
              Pesa esattamente quanto la zona. Misurato, non dichiarato: il tempo
              che passa fra il tuo primo messaggio e la sua prima risposta, negli
              ultimi tre mesi. Chi risponde entro mezz&apos;ora prende tutto, chi
              ci mette più di tre giorni non prende niente.
            </li>
            <li>
              <strong className="text-bob-ink">Se il prezzo è scritto.</strong>{" "}
              I punti vanno a chi <em>dichiara</em> un prezzo, non a chi costa
              meno: un preventivo che non c&apos;è non ti aiuta a decidere, e
              premiare il numero più basso su prezzi che nessuno verifica
              premierebbe chi scrive meno, non chi lavora meglio. Vale in
              qualunque forma sia scritto — una fascia «da tanto a tanto» oppure
              una tariffa nell&apos;unità di misura del mestiere, per esempio a
              ora.
            </li>
            <li>
              <strong className="text-bob-ink">Se puoi prenotare davvero.</strong>{" "}
              Orari veri sul calendario, e la prenotazione immediata dove c&apos;è.
            </li>
            <li>
              <strong className="text-bob-ink">Chi è verificato.</strong>{" "}
              Un profilo con la partita IVA controllata viene prima di uno ancora
              da controllare.
            </li>
            <li>
              <strong className="text-bob-ink">La scheda compilata.</strong>{" "}
              Quella che pesa di meno. Una presentazione, il nome
              dell&apos;attività, almeno un lavoro dichiarato.
            </li>
          </ul>
          <p className="mt-4 text-base text-bob-ink/65">
            <strong className="text-bob-ink">
              Quello che non sappiamo non toglie punti.
            </strong>{" "}
            Se di un professionista non abbiamo ancora misurato il tempo di
            risposta, o non ci ha ancora dato i suoi orari, quella voce vale il
            centro della scala: chi è appena arrivato non parte ultimo per il solo
            fatto di essere appena arrivato. E a parità di punti si sorteggia, con
            un sorteggio che cambia una volta al giorno — così l&apos;elenco è
            stabile se ricarichi la pagina, ma non è sempre lo stesso nome a stare
            davanti.
          </p>
          <p className="mt-3 text-base text-bob-ink/65">
            Non contano, e non conteranno finché non è scritto qui: che cosa hai
            cercato in passato, chi sei, e qualunque pagamento.
          </p>
          <p className="mt-4 text-base font-medium text-bob-ink">
            Nessuna posizione è a pagamento.
          </p>
          <p className="mt-1 text-base text-bob-ink/65">
            Nessun professionista può pagare per stare più in alto. Se un giorno
            introdurremo spazi a pagamento, li troverai marcati
            «Sponsorizzato» sulla scheda e questa pagina lo dirà: non cambieranno
            l&apos;ordine degli altri.
          </p>
      
            </div>
          </div>

          {/* Sotto i 1024px la scala non c'e': sarebbe una colonna decorativa
              infilata dentro un testo lungo, su uno schermo che di spazio non
              ne ha. E' decorazione, e la decorazione e' la prima a cedere. */}
          <div className="hidden lg:block">
            <ScalaDeiMestieri />
          </div>
        </div>
      </Fascia>

      <Fascia sfondo="tenue" spaziatura="stretta">
        <div className="flex flex-col items-center gap-3">
          <Link
            href="/#bob"
            className="btn-primary px-6 py-3"
            data-testid="cta-parla-con-bob"
          >
            Parla con Bob
          </Link>
          <Link
            href="/professionisti"
            className="text-base font-medium text-bob-indigo hover:underline"
          >
            oppure sfoglia i professionisti
          </Link>
        </div>
      </Fascia>
    </>
  );
}
