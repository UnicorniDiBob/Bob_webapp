import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage";
import { TermsContent } from "@/components/TermsContent";
import {
  dataTermini,
  trovaPubblicata,
  ultimaPubblicata,
  type PubblicoTermini,
  type VersioneTermini,
} from "@/lib/termini/registro";

// Le pagine dei termini, correnti e d'archivio, in un posto solo.
//
// LA DATA SI LEGGE A OGNI RICHIESTA. Le rotte che usano questo componente
// dichiarano `dynamic = "force-dynamic"`: se Next le prerenderizzasse in
// statico al momento della build, una versione con `pubblicataIl` nel futuro
// resterebbe invisibile fino al deploy successivo (o, al contrario, una pagina
// generata dopo quella data la mostrerebbe per sempre). La pubblicazione
// programmata vale solo se la pagina guarda l'orologio quando qualcuno la apre.

const PERCORSO: Record<PubblicoTermini, string> = {
  customer: "/termini",
  professional: "/termini/professionisti",
};

const ALTRO: Record<PubblicoTermini, { href: string; testo: string; per: string; invito: string }> = {
  customer: {
    href: "/termini/professionisti",
    testo: "termini per i professionisti",
    per: "clienti",
    invito: "Se offri servizi su BOB, leggi i",
  },
  professional: {
    href: "/termini",
    testo: "termini per i clienti",
    per: "professionisti",
    invito: "Se cerchi un servizio come cliente, leggi i",
  },
};

export function percorsoVersione(v: Pick<VersioneTermini, "pubblico" | "versione">): string {
  return `${PERCORSO[v.pubblico]}/${v.versione}`;
}

function Riquadro({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-bob-ink/70">
      {children}
    </div>
  );
}

function RigaVersione({ v }: { v: VersioneTermini }) {
  return (
    <p className="mt-1" data-testid="termini-versione">
      Versione <strong>{v.versione}</strong>, pubblicata il {dataTermini(v.pubblicataIl)}.{" "}
      <Link href="/termini/versioni" className="font-medium text-bob-indigo underline">
        Tutte le versioni
      </Link>
    </p>
  );
}

/** La pagina con la versione pubblicata oggi. */
export function PaginaTerminiCorrenti({
  pubblico,
  titolo,
}: {
  pubblico: PubblicoTermini;
  titolo: string;
}) {
  const v = ultimaPubblicata(pubblico);
  const altro = ALTRO[pubblico];
  return (
    <LegalPage eyebrow="Legale" title={titolo} updated={v.aggiornamento}>
      <Riquadro>
        Questa è la versione per i <strong>{altro.per}</strong>. {altro.invito}{" "}
        <Link href={altro.href} className="font-medium text-bob-indigo underline">
          {altro.testo}
        </Link>
        .
        <RigaVersione v={v} />
      </Riquadro>
      <TermsContent audience={pubblico} versione={v.versione} />
    </LegalPage>
  );
}

/** La pagina di una versione precisa, anche vecchia. Una futura non esiste. */
export function PaginaTerminiVersione({
  pubblico,
  versione,
  titolo,
}: {
  pubblico: PubblicoTermini;
  versione: string;
  titolo: string;
}) {
  const v = trovaPubblicata(pubblico, versione);
  if (!v) notFound();
  const ultima = ultimaPubblicata(pubblico);
  const archiviata = v.versione !== ultima.versione;
  return (
    <LegalPage eyebrow="Legale" title={titolo} updated={v.aggiornamento}>
      <Riquadro>
        {archiviata ? (
          <p data-testid="termini-archiviata">
            Questa è una <strong>versione precedente</strong> dei termini per i{" "}
            {ALTRO[pubblico].per}, conservata perché resti consultabile. La
            versione pubblicata oggi è la{" "}
            <Link href={PERCORSO[pubblico]} className="font-medium text-bob-indigo underline">
              {ultima.versione}
            </Link>
            .
          </p>
        ) : (
          <p>
            Questa è la versione pubblicata oggi dei termini per i {ALTRO[pubblico].per}.
          </p>
        )}
        <RigaVersione v={v} />
      </Riquadro>
      <TermsContent audience={pubblico} versione={v.versione} />
    </LegalPage>
  );
}
