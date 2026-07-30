import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { TermsContent, TERMS_UPDATED } from "@/components/TermsContent";

export const metadata: Metadata = {
  title: "Termini del servizio",
  description:
    "Le condizioni d'uso di BOB: cosa facciamo, cosa non facciamo, costi, account, verifica dei professionisti, assistente AI e recensioni.",
  alternates: { canonical: "/termini" },
};

// Il testo vive in components/TermsContent.tsx, condiviso con il modal
// mostrato in fase di iscrizione: un'unica fonte per le due superfici.
export default function TerminiPage() {
  return (
    <LegalPage eyebrow="Legale" title="Termini del servizio" updated={TERMS_UPDATED}>
      <TermsContent />
    </LegalPage>
  );
}
