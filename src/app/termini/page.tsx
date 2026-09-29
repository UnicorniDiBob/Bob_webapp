import type { Metadata } from "next";
import { PaginaTerminiCorrenti } from "@/components/termini/PaginaTermini";

export const metadata: Metadata = {
  title: "Termini del servizio (clienti)",
  description:
    "Le condizioni d'uso di BOB per i clienti: cosa facciamo, cosa non facciamo, costi, account, verifica dei professionisti, assistente AI e recensioni.",
  alternates: { canonical: "/termini" },
};

// Dinamica di proposito: quale versione mostrare dipende dall'ora della
// richiesta (pubblicazione programmata, vedi components/termini/PaginaTermini).
export const dynamic = "force-dynamic";

// Il testo vive in components/termini/, una versione per file; quale mostrare
// lo decide src/lib/termini/registro.ts. I professionisti hanno un testo
// dedicato: /termini/professionisti. Le versioni precedenti: /termini/versioni.
export default function TerminiPage() {
  return <PaginaTerminiCorrenti pubblico="customer" titolo="Termini del servizio" />;
}
