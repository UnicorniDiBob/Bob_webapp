import Link from "next/link";
import { LegalSection } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

/**
 * Versione dei termini attualmente pubblicata.
 * Va incrementata a OGNI modifica sostanziale del testo: il valore viene
 * registrato in profile_private.terms_version al momento dell'iscrizione, così
 * sappiamo quale testo ciascun utente ha effettivamente accettato.
 */
export const TERMS_VERSION = "2026-07-v1";

/** Etichetta leggibile della data di aggiornamento, mostrata in pagina e nel modal. */
export const TERMS_UPDATED = "Luglio 2026";

/**
 * Contenuto dei Termini del servizio, condiviso tra la pagina /termini e il
 * modal mostrato in fase di iscrizione: un'unica fonte, nessun rischio che le
 * due superfici divergano.
 *
 * ⚠️ Bozza operativa per la fase pilota, da far rivedere a un legale prima del
 * lancio pubblico (blocco 23 della roadmap). La versione definitiva prevede due
 * documenti separati per clienti e professionisti: vedi
 * docs/legal/SCHELETRO_ToS_Clienti.md e SCHELETRO_ToS_Professionisti.md.
 * I dati societari arrivano da src/lib/company.ts (placeholder fino alla
 * costituzione della società).
 */
export function TermsContent() {
  return (
    <>
      <LegalSection title="1. Cosa è BOB">
        <p>
          BOB è un servizio digitale che aiuta chi cerca un servizio locale
          (idraulico, elettricista, pulizie e altri) a descrivere il proprio
          bisogno e a entrare in contatto con professionisti indipendenti. BOB
          mette in contatto le parti e nulla più:{" "}
          <strong>non esegue le prestazioni, non le organizza e non è parte</strong>{" "}
          del contratto tra cliente e professionista. Il lavoro, il prezzo e
          l&apos;esecuzione sono concordati direttamente tra le parti.
        </p>
        <p>
          BOB non è un&apos;agenzia per il lavoro, un appaltatore né un ente di
          certificazione.
        </p>
      </LegalSection>

      <LegalSection title="2. La scelta del professionista è del cliente">
        <p>
          BOB può presentare uno o più professionisti compatibili con la
          richiesta, anche tramite strumenti automatici, ma{" "}
          <strong>la scelta è sempre e soltanto del cliente</strong>. BOB non
          assegna professionisti, non indica una scelta come la migliore e non
          garantisce alcun esito.
        </p>
      </LegalSection>

      <LegalSection title="3. Costi">
        <p>
          Per i clienti l&apos;uso di BOB è gratuito: pubblicare una richiesta,
          ricevere contatti e scrivere ai professionisti non comporta costi. I
          professionisti non pagano per ricevere contatti; eventuali abbonamenti
          o servizi a pagamento sono descritti al momento dell&apos;adesione.
        </p>
      </LegalSection>

      <LegalSection title="4. Account e requisiti">
        <p>
          Per iscriversi occorre avere almeno 18 anni e fornire informazioni
          veritiere e aggiornate. Le credenziali sono personali: sei
          responsabile del loro utilizzo e devi segnalarci ogni uso non
          autorizzato. Possiamo sospendere o chiudere gli account in caso di
          abusi, dati falsi, recensioni pilotate o comportamenti fraudolenti,
          dandone comunicazione motivata.
        </p>
      </LegalSection>

      <LegalSection title="5. Verifica dei professionisti: cosa significa">
        <p>
          Il profilo di un professionista può indicare quali controlli BOB ha
          effettuato <strong>e a quale data</strong> (ad esempio la verifica che
          la partita IVA risultasse attiva). Si tratta di{" "}
          <strong>controlli documentali riferiti a quella data</strong>.
        </p>
        <p>
          Tali indicazioni <strong>non costituiscono</strong>: una garanzia
          della qualità, correttezza, puntualità o sicurezza della prestazione;
          una garanzia di idoneità al singolo lavoro; una certificazione ai
          sensi di norme tecniche o rilasciata da organismo accreditato; una
          garanzia di onestà o solvibilità; un&apos;assicurazione o una garanzia
          di risultato. La situazione può inoltre essere cambiata dopo la data
          del controllo.
        </p>
        <p>
          Resta a carico del cliente valutare il professionista e verificare,
          prima di affidare il lavoro, quanto rilevante per il proprio caso:
          abilitazioni obbligatorie, coperture assicurative, esperienza
          specifica e congruità del preventivo. Consigliamo di richiedere sempre
          un preventivo scritto, conservare i documenti fiscali e pretendere le
          certificazioni di conformità previste dalla legge.
        </p>
      </LegalSection>

      <LegalSection title="6. Assistente Bob e intelligenza artificiale">
        <p>
          La chat di BOB utilizza un{" "}
          <strong>sistema di intelligenza artificiale</strong>: quando la usi
          stai interagendo con un assistente automatico, non con una persona.
          Serve a raccogliere e organizzare la tua richiesta.
        </p>
        <p>
          L&apos;assistente <strong>non fornisce consulenza tecnica</strong>,
          non formula diagnosi né preventivi vincolanti, può contenere errori e
          non sostituisce la valutazione di un professionista o un sopralluogo.
          Ti invitiamo a controllare il riepilogo della richiesta prima di
          inviarlo.
        </p>
      </LegalSection>

      <LegalSection title="7. Obblighi dei professionisti">
        <p>
          Il professionista opera in <strong>piena autonomia</strong>: decide se,
          quando e a quali condizioni rispondere alle richieste, e determina
          liberamente i propri prezzi. Tra BOB e il professionista non esiste
          alcun rapporto di lavoro subordinato, di agenzia o di
          rappresentanza.
        </p>
        <p>
          Il professionista dichiara e garantisce di possedere i titoli, le
          abilitazioni e i requisiti richiesti dalla normativa applicabile alle
          attività che offre, di essere in regola con i propri obblighi fiscali,
          contributivi, assicurativi e di sicurezza, e di emettere regolare
          documento fiscale. Tali adempimenti restano di sua esclusiva
          responsabilità. È vietato riutilizzare i dati dei clienti per finalità
          di marketing proprie.
        </p>
      </LegalSection>

      <LegalSection title="8. Recensioni">
        <p>
          Sono ammesse solo recensioni relative a richieste gestite tramite BOB e
          basate su esperienze reali e dirette. Sono vietate recensioni false, a
          pagamento, ottenute con pressioni o pubblicate da soggetti collegati al
          professionista o a suoi concorrenti. Le recensioni esprimono
          l&apos;opinione di chi le scrive e{" "}
          <strong>non sono una valutazione di BOB</strong>. Possiamo rimuovere
          contenuti falsi, offensivi o illeciti; il professionista ha diritto di
          replica.
        </p>
      </LegalSection>

      <LegalSection title="9. Responsabilità">
        <p>
          BOB fornisce la piattaforma con la diligenza dovuta, senza garantire
          che il servizio sia ininterrotto o privo di errori né la veridicità
          delle informazioni pubblicate dagli utenti.
        </p>
        <p>
          Nei limiti consentiti dalla legge, BOB non risponde:
          dell&apos;esecuzione o mancata esecuzione del lavoro, dei vizi, dei
          ritardi e dei danni derivanti dalla prestazione; della condotta, delle
          dichiarazioni e degli inadempimenti dei professionisti o dei clienti;
          dei rapporti economici tra le parti; dei servizi di terzi integrati
          nella piattaforma.
        </p>
        <p>
          Nulla in questi termini esclude o limita la responsabilità nei casi in
          cui ciò non sia consentito da norme inderogabili, né i diritti
          riconosciuti ai consumatori dalla legge.
        </p>
      </LegalSection>

      <LegalSection title="10. Segnalazioni">
        <p>
          Se ritieni che un contenuto o un profilo violi la legge o questi
          termini, scrivi a{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-bob-indigo underline"
          >
            {COMPANY.contactEmail}
          </a>{" "}
          indicando l&apos;elemento contestato e il motivo: esamineremo la
          segnalazione e ti comunicheremo l&apos;esito. Per le violazioni di
          legge resta ferma la competenza delle autorità.
        </p>
      </LegalSection>

      <LegalSection title="11. Dati personali">
        <p>
          Il trattamento dei dati è descritto nell&apos;
          <Link href="/privacy" className="text-bob-indigo underline">
            informativa privacy
          </Link>
          . Ai professionisti comunichiamo inizialmente la sola richiesta; i
          tuoi dati di contatto completi vengono trasmessi soltanto dopo che hai
          accettato di essere contattato.
        </p>
      </LegalSection>

      <LegalSection title="12. Recesso e cancellazione">
        <p>
          Puoi chiudere il tuo account in ogni momento dalle impostazioni o
          scrivendo a{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-bob-indigo underline"
          >
            {COMPANY.contactEmail}
          </a>
          . La chiusura non estingue gli obblighi già assunti verso un
          professionista o un cliente.
        </p>
      </LegalSection>

      <LegalSection title="13. Modifiche">
        <p>
          Potremo aggiornare questi termini per motivi normativi, tecnici o di
          servizio, dandone comunicazione agli utenti registrati con congruo
          preavviso. Se non accetti le modifiche puoi chiudere il tuo account
          senza costi.
        </p>
      </LegalSection>

      <LegalSection title="14. Legge applicabile e foro">
        <p>
          Si applica la <strong>legge italiana</strong>. Per i consumatori è
          competente il foro del luogo di residenza o domicilio; negli altri casi
          il foro di {COMPANY.courtCity}. Prima di rivolgersi al giudice le parti
          si impegnano a cercare una soluzione amichevole.
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
        <p className="text-xs text-bob-ink/45">
          Versione {TERMS_VERSION} — ultimo aggiornamento: {TERMS_UPDATED}.
        </p>
      </LegalSection>
    </>
  );
}
