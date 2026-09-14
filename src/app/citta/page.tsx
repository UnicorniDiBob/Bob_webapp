import type { Metadata } from "next";
import Link from "next/link";
import { Rivela } from "@/components/Rivela";
import { Blocco, Fascia, TestaSezione } from "@/components/sezioni";
import { getCities, getProfessionals } from "@/lib/data";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Città",
  description:
    "Le città in cui BOB è attivo. Milano è operativa, altre città arrivano presto.",
};

/**
 * QUESTA PAGINA E' CORTA PER NATURA, e va progettata sapendolo.
 *
 * Le citta' sono tre e una sola e' attiva: header piu' tre tessere, su un
 * contenitore da 1600px, e' mezza pagina vuota. Non si riempie allargando le
 * tessere — si riempie dicendo la cosa che la pagina ha da dire e che prima
 * stava schiacciata in una riga di sottotitolo: apriamo una citta' alla volta,
 * e il motivo e' che i professionisti li verifichiamo a uno a uno.
 *
 * Via il `MapPin`: era la stessa icona su ogni scheda, quindi non distingueva
 * niente. Quello che distingue e' il chip «Attiva» / «Lista d'attesa», e ora
 * ha il posto che aveva l'icona.
 */
export default async function CitiesPage() {
  const [cities, pros] = await Promise.all([getCities(), getProfessionals()]);

  const countByCity: Record<string, number> = {};
  for (const p of pros) {
    countByCity[p.city.slug] = (countByCity[p.city.slug] ?? 0) + 1;
  }

  return (
    <>
      <Fascia sfondo="bianca" spaziatura="stretta" bordo>
        <span className="section-eyebrow">Città</span>
        <h1 className="mt-3 max-w-[20ch] text-3xl font-extrabold tracking-tight text-bob-ink sm:text-4xl">
          Dove puoi trovare un professionista
        </h1>
        <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-bob-ink/70">
          Partiamo da Milano, dove i professionisti sono già verificati e
          pronti.
        </p>
      </Fascia>

      <Fascia sfondo="tenue">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => {
            const active = c.status === "active";
            const n = countByCity[c.slug] ?? 0;
            return (
              <Link
                key={c.id}
                href={`/citta/${c.slug}`}
                className="card flex flex-col p-6 hover:-translate-y-0.5 hover:shadow-card-hover"
                data-testid={`card-city-${c.slug}`}
              >
                {active ? (
                  <span className="chip self-start border-emerald-200 bg-emerald-50 text-emerald-700">
                    Attiva
                  </span>
                ) : (
                  <span className="chip self-start border-black/10 bg-black/[0.03] text-bob-ink/70">
                    Lista d&apos;attesa
                  </span>
                )}
                <h2 className="mt-5 text-xl font-bold tracking-tight text-bob-ink">
                  {c.name}
                </h2>
                <p className="mt-2 flex-1 text-base leading-relaxed text-bob-ink/70">
                  {active
                    ? `${n} professionist${n === 1 ? "a" : "i"} disponibil${
                        n === 1 ? "e" : "i"
                      }`
                    : "Iscriviti alla lista: ti avvisiamo appena apriamo."}
                </p>
                {/* Anche le città in arrivo hanno una destinazione: la waitlist
                    su /citta/[slug]. Prima erano schede mute e l'interesse
                    andava perso. */}
                <span className="mt-5 inline-flex items-center gap-1 text-base font-semibold text-bob-indigo">
                  {active ? `Esplora ${c.name}` : "Lascia il tuo interesse"}
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>
      </Fascia>

      <Fascia sfondo="forte">
        <TestaSezione
          occhiello="Perché una alla volta"
          titolo="Apriamo una città quando è pronta, non quando è annunciata"
          tinta="chiara"
          allineamento="sinistra"
          misura="stretta"
        />
        <Rivela ritardo={60}>
          <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12">
            <Blocco tinta="chiara" titolo="I professionisti li controlliamo a uno a uno">
              Partita IVA verificata e profilo controllato prima che il primo
              cliente li veda. È il motivo per cui una città alla volta.
            </Blocco>
            <Blocco
              tinta="chiara"
              titolo="La lista d’attesa non è una raccolta di email"
            >
              Ti scriviamo quando apriamo nella tua città, e per quello. Niente
              altro.
            </Blocco>
          </div>
        </Rivela>
      </Fascia>
    </>
  );
}
