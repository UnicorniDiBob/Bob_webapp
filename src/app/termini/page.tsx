import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Termini del servizio",
  description:
    "Le condizioni d'uso di BOB: cosa facciamo, cosa non facciamo, costi, account, verifica dei professionisti e recensioni.",
  alternates: { canonical: "/termini" },
};

// ⚠️ Bozza operativa per il pilota: da far rivedere a un legale prima del
// lancio pubblico. I dati societari arrivano da src/lib/company.ts.
export default function TerminiPage() {
  return (
    <LegalPage
      eyebrow="Legale"
      title="Termini del servizio"
      updated="Luglio 2026"
    >
      <LegalSection title="1. Cosa è BOB">
        <p>
          BOB è un servizio digitale che aiuta chi cerca un servizio locale
          (idraulico, elettricista, pulizie e altri) a capire il proprio
          bisogno e a entrare in contatto con professionisti indipendenti. BOB{" "}
          <strong>non è parte del contratto</strong> tra cliente e
          professionista: il lavoro, il prezzo finale e l&apos;esecuzione sono
          concordati direttamente tra le parti.
        </p>
      </LegalSection>

      <LegalSection title="2. Costi">
        <p>
          Per i clienti l&apos;uso di BOB è gratuito. I professionisti non
          pagano per ricevere contatti: una commissione si applica solo quando
          un lavoro si conclude, secondo le condizioni comunicate al
          professionista in fase di adesione.
        </p>
      </LegalSection>

      <LegalSection title="3. Account">
        <p>
          Devi fornire informazioni veritiere e mantenere riservate le tue
          credenziali. Possiamo sospendere gli account in caso di abusi,
          recensioni false o comportamenti fraudolenti.
        </p>
      </LegalSection>

      <LegalSection title="4. Verifica dei professionisti">
        <p>
          Il badge &quot;Verificato&quot; indica i controlli descritti nelle{" "}
          <Link href="/faq" className="text-bob-indigo underline">
            FAQ
          </Link>{" "}
          (identità e requisiti dichiarati). Non costituisce una garanzia
          sull&apos;esito del lavoro.
        </p>
      </LegalSection>

      <LegalSection title="5. Recensioni">
        <p>
          Sono ammesse solo recensioni basate su esperienze reali. Ci
          riserviamo di rimuovere contenuti falsi, offensivi o illegali.
        </p>
      </LegalSection>

      <LegalSection title="6. Responsabilità">
        <p>
          BOB fornisce la piattaforma &quot;così com&apos;è&quot; durante la
          fase pilota. Nei limiti consentiti dalla legge, BOB non risponde dei
          danni derivanti dal rapporto tra cliente e professionista. Nulla in
          questi termini esclude la responsabilità nei casi previsti da norme
          inderogabili.
        </p>
      </LegalSection>

      <LegalSection title="7. Recesso e cancellazione">
        <p>
          Puoi chiudere il tuo account in ogni momento dalle impostazioni o
          scrivendo a{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-bob-indigo underline"
          >
            {COMPANY.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Legge applicabile e foro">
        <p>
          Si applica la legge italiana. Per i consumatori è competente il foro
          del luogo di residenza; negli altri casi, il foro di{" "}
          {COMPANY.courtCity}.
        </p>
      </LegalSection>

      <LegalSection title="9. Modifiche">
        <p>
          Potremo aggiornare questi termini; le modifiche sostanziali saranno
          comunicate agli utenti registrati.
        </p>
      </LegalSection>

      <LegalSection title="Gestore del servizio">
        <p>
          {COMPANY.legalName} — P.IVA {COMPANY.vat} — {COMPANY.address} —{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-bob-indigo underline"
          >
            {COMPANY.contactEmail}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
