import type { Metadata } from "next";
import Link from "next/link";
import { Bob } from "@/components/Bob";
import { Rivela } from "@/components/Rivela";
import { Attrezzo, Cerchio } from "@/components/SceneBob";
import { Fascia, TestaSezione } from "@/components/sezioni";
import { getServices, getServiceCounts } from "@/lib/data";
import { ServiceIcon } from "@/lib/serviceIcons";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Servizi",
  description:
    "Tutti i servizi disponibili su BOB: idraulico, elettricista, pulizie, imbianchino, traslochi e molto altro, con prezzi trasparenti.",
};

/**
 * LE SCHEDE QUI RESTANO SCHEDE, e non e' una dimenticanza.
 *
 * Sulle altre pagine la scheda bianca e' stata sostituita dal blocco con la
 * riga gialla, perche' li' incorniciava tre righe di testo che non facevano
 * niente. Qui invece ogni riquadro e' un link: ha un bordo perche' e' un
 * bersaglio da cliccare, e si solleva al passaggio del mouse perche' lo dice.
 * Una riga gialla non si clicca.
 *
 * Per lo stesso motivo restano anche le icone: quindici servizi si scorrono
 * con l'occhio, e un'icona diversa per ciascuno e' quello che rende la lista
 * scorribile. Su /per-i-professionisti le icone sono state tolte perche' erano
 * quattro simboli decorativi accanto a quattro titoli — un altro mestiere.
 */
export default async function ServicesPage() {
  const [services, counts] = await Promise.all([
    getServices(),
    getServiceCounts(),
  ]);

  return (
    <>
      <Fascia sfondo="bianca" spaziatura="stretta" bordo>
        <span className="section-eyebrow">Servizi</span>
        <h1 className="mt-3 max-w-[20ch] text-3xl font-extrabold tracking-tight text-bob-ink sm:text-4xl">
          Di cosa hai bisogno?
        </h1>
        <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-bob-ink/70">
          Scegli un servizio per vedere chi lo offre, con prezzi e rating in
          chiaro.
        </p>
      </Fascia>

      <Fascia sfondo="tenue">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const n = counts[s.id] ?? 0;
            return (
              <Link
                key={s.id}
                href={`/servizi/${s.slug}`}
                className="card flex items-center gap-4 p-5 hover:-translate-y-0.5 hover:shadow-card-hover"
                data-testid={`card-service-${s.slug}`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bob-indigo-50 text-bob-indigo">
                  <ServiceIcon slug={s.slug} className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-bob-ink">
                    {s.name}
                  </h2>
                  {/* Nessun "presto disponibile": una scheda senza
                      professionisti non annuncia il proprio vuoto, la riga
                      sparisce. */}
                  {n > 0 && (
                    <p className="text-sm text-bob-ink/70">
                      {n} professionist{n === 1 ? "a" : "i"}
                    </p>
                  )}
                </div>
                <svg
                  className="h-4 w-4 shrink-0 text-bob-ink/30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            );
          })}
        </div>
      </Fascia>

      {/* La fascia che prima non c'era. «Non sai da dove partire? Raccontalo a
          Bob» stava schiacciato nel sottotitolo, dove nessuno lo leggeva: e'
          la via d'uscita per chi non trova il proprio caso in quindici
          riquadri, e merita una fascia sua. */}
      <Fascia sfondo="forte">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.5fr)] lg:gap-16">
          <div>
            <TestaSezione
              occhiello="Non trovi il tuo caso?"
              titolo="Raccontalo a Bob con parole tue"
              sottotitolo="Non serve sapere quale professionista cercare: descrivi il problema e Bob capisce di che lavoro si tratta."
              tinta="chiara"
              allineamento="sinistra"
              misura="stretta"
            />
            <Rivela ritardo={60}>
              {/* Classi scritte per esteso invece di `btn-primary` piu' un `bg-`:
                  fra due utility pari vince quella che sta dopo nel CSS
                  generato, non quella scritta dopo. Qui funzionerebbe, ma
                  dipenderebbe dall'ordine dei layer di Tailwind invece che da
                  quello che c'e' scritto. */}
              <Link
                href="/#bob"
                className="mt-8 inline-block rounded-xl bg-bob-yellow px-6 py-3 text-base font-semibold text-bob-ink hover:brightness-95"
              >
                Parla con Bob
              </Link>
            </Rivela>
          </div>

          <Rivela ritardo={120} className="w-full">
            <Cerchio tinta="bg-bob-indigo-100" appoggio="bg-white/25">
              <Bob
                posa="neutro"
                gradiBraccioDestro={-28}
                attrezzoDestro={<Attrezzo tipo="chiave" />}
                fuoriBordo
                alt="Bob, pronto ad ascoltare il tuo problema"
                className="absolute bottom-[7%] left-1/2 w-[62%] -translate-x-1/2"
              />
            </Cerchio>
          </Rivela>
        </div>
      </Fascia>
    </>
  );
}
