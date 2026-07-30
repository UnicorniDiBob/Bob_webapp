import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { TermsContent, TERMS_UPDATED } from "@/components/TermsContent";

export const metadata: Metadata = {
  title: "Termini del servizio (professionisti)",
  description:
    "Le condizioni d'uso di BOB per i professionisti: autonomia, requisiti, costi, ordinamento dei risultati, recensioni, reclami e responsabilità.",
  alternates: { canonical: "/termini/professionisti" },
};

// Testo dedicato al lato business del marketplace: i professionisti sono utenti
// business (Reg. UE 2019/1150), con diritti e obblighi diversi dai consumatori.
// Le sezioni sul ruolo di BOB restano identiche a quelle dei termini clienti.
export default function TerminiProfessionistiPage() {
  return (
    <LegalPage
      eyebrow="Legale"
      title="Termini del servizio — professionisti"
      updated={TERMS_UPDATED}
    >
      <div className="rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-bob-ink/70">
        Questa è la versione per i <strong>professionisti</strong>. Se cerchi un
        servizio come cliente, leggi i{" "}
        <Link href="/termini" className="font-medium text-bob-indigo underline">
          termini per i clienti
        </Link>
        .
      </div>
      <TermsContent audience="professional" />
    </LegalPage>
  );
}
