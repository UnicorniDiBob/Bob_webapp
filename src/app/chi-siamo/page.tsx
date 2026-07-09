import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Chi siamo",
  description:
    "Chi c'è dietro Bob e perché abbiamo scelto un modello senza lead a pagamento: la commissione esiste solo quando un lavoro si chiude davvero.",
  alternates: { canonical: "/chi-siamo" },
};

// ⚠️ [FOTO/NOME FONDATORE]: aggiungere 2-3 righe personali prima del lancio —
// chi sei, perché hai costruito Bob. L'identità è il segnale di fiducia più
// economico che esista.
export default function ChiSiamoPage() {
  return (
    <LegalPage eyebrow="Chi siamo" title="Chi c'è dietro Bob">
      <LegalSection title="Una frustrazione semplice">
        <p>
          Trovare un idraulico non dovrebbe essere una lotteria. Le piattaforme
          esistenti vendono i tuoi dati come &quot;lead&quot; a più
          professionisti, che pagano per contattarti anche quando il lavoro non
          si fa. Il risultato: telefonate a raffica per te, costi a vuoto per
          loro.
        </p>
      </LegalSection>

      <LegalSection title="Un modello diverso">
        <p>
          Nessun lead a pagamento: i professionisti non pagano mai per un
          contatto. La commissione esiste solo quando un lavoro si chiude
          davvero — così il nostro incentivo è lo stesso tuo: che il lavoro si
          faccia, e si faccia bene.
        </p>
      </LegalSection>

      <LegalSection title="Siamo all'inizio, e lo diciamo">
        <p>
          Il pilota è attivo a Milano con i primi professionisti selezionati e
          verificati uno a uno. Mostriamo numeri reali, non promesse gonfiate.
          Roma e Torino arrivano appena avremo professionisti all&apos;altezza.
        </p>
      </LegalSection>

      <LegalSection title="Parliamone">
        <p>
          Hai un dubbio, un&apos;idea o vuoi segnalarci qualcosa? Scrivici a{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-bob-indigo underline"
          >
            {COMPANY.contactEmail}
          </a>{" "}
          oppure{" "}
          <Link href="/" className="text-bob-indigo underline">
            racconta il tuo problema a Bob
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
