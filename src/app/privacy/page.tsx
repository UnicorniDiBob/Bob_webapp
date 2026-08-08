import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Informativa sulla privacy",
  description:
    "Come BOB tratta i tuoi dati personali: quali dati raccogliamo, perché, per quanto tempo e quali sono i tuoi diritti.",
  alternates: { canonical: "/privacy" },
};

// ⚠️ Bozza operativa per il pilota: da far rivedere a un legale prima del
// lancio pubblico. I dati societari arrivano da src/lib/company.ts.
export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legale"
      title="Informativa sulla privacy"
      updated="Luglio 2026"
    >
      <LegalSection title="Titolare del trattamento">
        <p>
          {COMPANY.legalName}, {COMPANY.address}, P.IVA {COMPANY.vat}.
          Per qualsiasi richiesta sulla privacy puoi scriverci a{" "}
          <a
            href={`mailto:${COMPANY.privacyEmail}`}
            className="text-bob-indigo underline"
          >
            {COMPANY.privacyEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Quali dati trattiamo">
        <p>
          <strong>Dati di account:</strong> email e password (conservata in
          forma cifrata) quando ti registri.
        </p>
        <p>
          <strong>Contenuti che ci fornisci:</strong> la descrizione del
          problema che racconti a Bob (incluse eventuali foto), i messaggi
          scambiati con i professionisti e le recensioni che pubblichi.
        </p>
        <p>
          <strong>Dove serve l&apos;intervento:</strong> la zona o il CAP che
          indichi quando descrivi il problema, e l&apos;indirizzo completo
          (via e civico, più eventuali note per entrare) quando fissi un
          appuntamento.
        </p>
        <p>
          <strong>Dati dei professionisti:</strong> nome dell&apos;attività,
          categoria, città, tariffe e stato di verifica.
        </p>
        <p>
          <strong>Dati tecnici:</strong> log di accesso e cookie tecnici
          necessari al funzionamento del sito (vedi la{" "}
          <Link href="/cookie-policy" className="text-bob-indigo underline">
            cookie policy
          </Link>
          ).
        </p>
        <p>
          <strong>Liste d&apos;attesa:</strong> l&apos;email che lasci
          volontariamente per essere avvisato quando BOB arriva nella tua
          città.
        </p>
      </LegalSection>

      <LegalSection title="Perché li trattiamo (base giuridica)">
        <p>
          <strong>Esecuzione del servizio</strong> (art. 6.1.b GDPR): creare e
          gestire l&apos;account, mettere in contatto clienti e professionisti,
          gestire messaggi, richieste e recensioni.
        </p>
        <p>
          <strong>Legittimo interesse</strong> (art. 6.1.f GDPR): sicurezza
          della piattaforma, prevenzione di abusi e frodi, statistiche in forma
          aggregata.
        </p>
        <p>
          <strong>Consenso</strong> (art. 6.1.a GDPR): liste d&apos;attesa per
          le nuove città e future comunicazioni promozionali. Puoi revocare il
          consenso in ogni momento scrivendoci.
        </p>
      </LegalSection>

      <LegalSection title="Chi vede il tuo indirizzo, e quando">
        <p>
          I professionisti che invitiamo a farti un preventivo{" "}
          <strong>non vedono il tuo indirizzo</strong>. Vedono soltanto la zona
          o il CAP che hai indicato — quanto basta per capire se la trasferta è
          fattibile e a che distanza sei — oppure la sola città, se preferisci
          non dire altro: la zona è facoltativa.
        </p>
        <p>
          Via, civico e note di accesso arrivano a{" "}
          <strong>un solo professionista</strong>, e solo dopo che hai
          confermato l&apos;appuntamento con lui. Chi non viene scelto non li
          riceve mai.
        </p>
        <p>
          Il professionista che riceve i tuoi dati diventa titolare autonomo
          del trattamento per l&apos;uso che ne fa, e i nostri termini gli
          vietano di riutilizzare i tuoi contatti per farsi pubblicità.
        </p>
      </LegalSection>

      <LegalSection title="Dove sono i dati">
        <p>
          I dati sono ospitati su infrastruttura cloud (Vercel e Supabase) con
          server nell&apos;Unione Europea o con garanzie di trasferimento
          adeguate ai sensi del GDPR (clausole contrattuali standard).
        </p>
      </LegalSection>

      <LegalSection title="Per quanto li conserviamo">
        <p>
          Dati di account: finché l&apos;account è attivo e fino a 12 mesi
          dalla cancellazione. Messaggi e recensioni: per la durata del
          servizio. Email nelle liste d&apos;attesa: fino al lancio nella città
          interessata o alla revoca del consenso.
        </p>
      </LegalSection>

      <LegalSection title="I tuoi diritti">
        <p>
          Hai diritto di accesso, rettifica, cancellazione, limitazione,
          portabilità e opposizione (artt. 15–22 GDPR). Per esercitarli scrivi
          a{" "}
          <a
            href={`mailto:${COMPANY.privacyEmail}`}
            className="text-bob-indigo underline"
          >
            {COMPANY.privacyEmail}
          </a>
          . Hai inoltre diritto di proporre reclamo al Garante per la
          protezione dei dati personali (
          <a
            href="https://www.garanteprivacy.it"
            className="text-bob-indigo underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            garanteprivacy.it
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection title="Minori">
        <p>Il servizio è riservato a persone maggiorenni.</p>
      </LegalSection>
    </LegalPage>
  );
}
