import type { Metadata } from "next";
import { PaginaTerminiCorrenti } from "@/components/termini/PaginaTermini";

export const metadata: Metadata = {
  title: "Termini del servizio (professionisti)",
  description:
    "Le condizioni d'uso di BOB per i professionisti: autonomia, requisiti, costi, ordinamento dei risultati, recensioni, reclami e responsabilità.",
  alternates: { canonical: "/termini/professionisti" },
};

// Dinamica di proposito: vedi src/app/termini/page.tsx.
export const dynamic = "force-dynamic";

// Testo dedicato al lato business del marketplace: i professionisti sono utenti
// business (Reg. UE 2019/1150), con diritti e obblighi diversi dai consumatori.
// Le sezioni sul ruolo di BOB restano identiche a quelle dei termini clienti.
export default function TerminiProfessionistiPage() {
  return (
    <PaginaTerminiCorrenti
      pubblico="professional"
      titolo="Termini del servizio — professionisti"
    />
  );
}
