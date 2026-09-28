import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { percorsoVersione } from "@/components/termini/PaginaTermini";
import {
  dataTermini,
  ultimaPubblicata,
  versioniPubblicate,
  type PubblicoTermini,
} from "@/lib/termini/registro";

export const metadata: Metadata = {
  title: "Versioni dei termini del servizio",
  description: "Tutte le versioni pubblicate dei termini di BOB, per clienti e professionisti.",
  alternates: { canonical: "/termini/versioni" },
};

// Dinamica di proposito: l'elenco dipende dall'ora della richiesta, come le
// pagine dei termini (vedi components/termini/PaginaTermini).
export const dynamic = "force-dynamic";

// L'ARCHIVIO. Ogni versione pubblicata resta leggibile al suo indirizzo, con il
// testo esatto di allora. La data di efficacia compare solo quando e' fissata:
// finche' non lo e', dire qualcosa su quando una versione vale sarebbe una
// dichiarazione verso gli iscritti, e quella e' parte del preavviso.

const TITOLO: Record<PubblicoTermini, string> = {
  customer: "Termini per i clienti",
  professional: "Termini per i professionisti",
};

function Elenco({ pubblico }: { pubblico: PubblicoTermini }) {
  const corrente = ultimaPubblicata(pubblico).versione;
  const elenco = versioniPubblicate(pubblico).slice().reverse();
  return (
    <section data-testid={`termini-versioni-${pubblico}`}>
      <h2 className="mb-3 text-lg font-semibold text-bob-ink">{TITOLO[pubblico]}</h2>
      <ol className="space-y-4">
        {elenco.map((v) => (
          <li key={v.versione} className="rounded-xl border border-black/10 px-4 py-3">
            <p className="font-medium text-bob-ink">
              <Link href={percorsoVersione(v)} className="text-bob-indigo underline">
                Versione {v.versione}
              </Link>
              {v.versione === corrente && (
                <span className="ml-2 rounded-full bg-bob-indigo/10 px-2 py-0.5 text-xs font-semibold text-bob-indigo">
                  pubblicata oggi
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-bob-ink/70">
              Pubblicata il {dataTermini(v.pubblicataIl)}
              {v.efficaceDal ? ` · efficace dal ${dataTermini(v.efficaceDal)}` : ""}.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-bob-ink/80">
              {v.sommario.map((riga) => (
                <li key={riga}>{riga}</li>
              ))}
            </ul>
            {v.note?.map((nota) => (
              <p key={nota} className="mt-2 text-xs text-bob-ink/65">
                {nota}
              </p>
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function VersioniTerminiPage() {
  return (
    <LegalPage eyebrow="Legale" title="Versioni dei termini">
      <p className="text-sm text-bob-ink/70">
        Ogni versione dei termini resta consultabile qui, con il testo esatto
        che è stato pubblicato.
      </p>
      <Elenco pubblico="professional" />
      <Elenco pubblico="customer" />
    </LegalPage>
  );
}
