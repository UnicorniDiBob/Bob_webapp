import type { Metadata } from "next";
import { PaginaTerminiVersione } from "@/components/termini/PaginaTermini";

// Una versione precisa dei termini per i clienti, anche precedente: chi ha
// accettato una versione deve poterla rileggere. Una versione non ancora
// pubblicata risponde 404 (vedi trovaPubblicata nel registro).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Termini del servizio (clienti) — versione",
  robots: { index: false, follow: true },
};

export default function TerminiVersionePage({
  params,
}: {
  params: { versione: string };
}) {
  return (
    <PaginaTerminiVersione
      pubblico="customer"
      versione={params.versione}
      titolo="Termini del servizio"
    />
  );
}
