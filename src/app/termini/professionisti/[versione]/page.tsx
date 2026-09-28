import type { Metadata } from "next";
import { PaginaTerminiVersione } from "@/components/termini/PaginaTermini";

// Una versione precisa dei termini per i professionisti, anche precedente:
// vedi src/app/termini/[versione]/page.tsx.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Termini del servizio (professionisti) — versione",
  robots: { index: false, follow: true },
};

export default function TerminiProfessionistiVersionePage({
  params,
}: {
  params: { versione: string };
}) {
  return (
    <PaginaTerminiVersione
      pubblico="professional"
      versione={params.versione}
      titolo="Termini del servizio — professionisti"
    />
  );
}
