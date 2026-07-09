import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie policy",
  description:
    "BOB utilizza solo cookie tecnici necessari al funzionamento del sito. Nessun cookie di profilazione o pubblicitario.",
  alternates: { canonical: "/cookie-policy" },
};

// ⚠️ Se in futuro verranno introdotti analytics o marketing basati su cookie
// non tecnici, questa pagina va aggiornata e serve un banner di consenso
// conforme alle Linee guida cookie del Garante.
export default function CookiePolicyPage() {
  return (
    <LegalPage eyebrow="Legale" title="Cookie policy" updated="Luglio 2026">
      <LegalSection title="Quali cookie usiamo">
        <p>
          BOB utilizza <strong>solo cookie tecnici</strong>, necessari al
          funzionamento del sito: la gestione della sessione di accesso e le
          preferenze essenziali. Non utilizziamo cookie di profilazione né
          cookie pubblicitari di terze parti. Per questo motivo non è
          richiesto un banner di consenso.
        </p>
        <p>
          Cookie utilizzati: cookie di sessione e autenticazione (necessari;
          durata legata alla sessione o fino al logout).
        </p>
      </LegalSection>

      <LegalSection title="Se qualcosa cambierà">
        <p>
          Se in futuro introdurremo strumenti di analisi o di marketing che
          usano cookie non tecnici, aggiorneremo questa pagina e ti chiederemo
          il consenso prima di attivarli.
        </p>
      </LegalSection>

      <LegalSection title="Come gestirli">
        <p>
          Puoi eliminare i cookie dalle impostazioni del tuo browser in
          qualsiasi momento; l&apos;eliminazione dei cookie tecnici può
          richiedere un nuovo accesso al tuo account.
        </p>
        <p>
          Per maggiori informazioni su come trattiamo i tuoi dati, leggi
          l&apos;
          <Link href="/privacy" className="text-bob-indigo underline">
            informativa sulla privacy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
