import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { TermsContent, TERMS_UPDATED } from "@/components/TermsContent";

export const metadata: Metadata = {
  title: "Termini del servizio (clienti)",
  description:
    "Le condizioni d'uso di BOB per i clienti: cosa facciamo, cosa non facciamo, costi, account, verifica dei professionisti, assistente AI e recensioni.",
  alternates: { canonical: "/termini" },
};

// Il testo vive in components/TermsContent.tsx, condiviso con il modal
// mostrato in fase di iscrizione: un'unica fonte per tutte le superfici.
// I professionisti hanno un testo dedicato: /termini/professionisti.
export default function TerminiPage() {
  return (
    <LegalPage
      eyebrow="Legale"
      title="Termini del servizio"
      updated={TERMS_UPDATED}
    >
      <div className="rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-bob-ink/70">
        Questa è la versione per i <strong>clienti</strong>. Se offri servizi su
        BOB, leggi i{" "}
        <Link
          href="/termini/professionisti"
          className="font-medium text-bob-indigo underline"
        >
          termini per i professionisti
        </Link>
        .
      </div>
      <TermsContent audience="customer" />
    </LegalPage>
  );
}
