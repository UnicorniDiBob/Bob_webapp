import Link from "next/link";
import { LegalSection } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

/**
 * Versione dei termini attualmente pubblicata (vale per entrambi i testi,
 * clienti e professionisti: si versionano insieme).
 * Va incrementata a OGNI modifica sostanziale: il valore finisce in
 * profile_private.terms_version all'iscrizione, così sappiamo quale testo
 * ciascun utente ha accettato.
 */
export const TERMS_VERSION = "2026-07-v1";

/** Etichetta leggibile della data di aggiornamento. */
export const TERMS_UPDATED = "Luglio 2026";

export type TermsAudience = "customer" | "professional";

/**
 * Contenuto dei Termini del servizio, condiviso tra le pagine /termini e
 * /termini/professionisti e il modal mostrato in fase di iscrizione: un'unica
 * fonte, nessun rischio che le superfici divergano.
 *
 * Esistono due testi distinti perché i due lati del marketplace hanno diritti
 * e obblighi diversi (il cliente è consumatore, il professionista è un utente
 * business soggetto al Reg. UE 2019/1150). Le sezioni sul RUOLO di BOB sono
 * però formulate in modo identico nei due testi: una divergenza su quel punto
 * si ritorcerebbe contro di noi (art. 1370 c.c.).
 *
 * ⚠️ Bozza operativa per la fase pilota, da far rivedere a un legale prima del
 * lancio (blocco 23). Struttura completa in docs/legal/SCHELETRO_ToS_*.md.
 */
export function TermsContent({ audience }: { audience: TermsAudience }) {
  const isPro = audience === "professional";

  return (
    <>
      <LegalSection title="1. Cosa è BOB">
        <p>
          BOB è un servizio digitale che aiuta chi cerca un servizio locale
          (idraulico, elettricista, pulizie e altri) a descrivere il proprio
          bisogno e a entrare in contatto con professionisti indipendenti. BOB
          mette in contatto le parti e nulla più:{" "}
          <strong>
            non esegue le prestazioni, non le organizza e non è parte
          </strong>{" "}
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
          {isPro &&
            " Non garantiamo quindi un volume minimo di richieste, di contatti o di lavori."}
        </p>
      </LegalSection>

      {isPro ? (
        <LegalSection title="3. Costi per il professionista">
          <p>
            L&apos;iscrizione a BOB è gratuita e{" "}
            <strong>non paghi per ricevere contatti</strong>. Eventuali
            abbonamenti o servizi di visibilità a pagamento, con i relativi
            prezzi, ti sono descritti nel momento in cui li attivi: nulla è
            addebitato senza una tua adesione esplicita. Puoi disdire in
            qualsiasi momento dall&apos;area riservata, senza costi di disdetta
            né penali.
          </p>
          <p>
            BOB non percepisce alcuna commissione sul corrispettivo che concordi
            con il cliente, salvo per gli eventuali servizi che saranno
            espressamente qualificati come tali e accettati separatamente.
          </p>
        </LegalSection>
      ) : (
        <LegalSection title="3. Costi">
          <p>
            Per i clienti l&apos;uso di BOB è <strong>gratuito</strong>:
            pubblicare una richiesta, ricevere contatti e scrivere ai
            professionisti non comporta costi. Il compenso della prestazione lo
            concordi e lo paghi direttamente al professionista.
          </p>
        </LegalSection>
      )}

      <LegalSection title="4. Account e requisiti">
        <p>
          Per iscriversi occorre avere almeno 18 anni e fornire informazioni
          veritiere e aggiornate. Le credenziali sono personali: sei
          responsabile del loro utilizzo e devi segnalarci ogni uso non
          autorizzato. Possiamo sospendere o chiudere gli account in caso di
          abusi, dati falsi, recensioni pilotate o comportamenti fraudolenti.
        </p>
        {isPro && (
          <p>
            Ogni decisione di limitazione, sospensione o chiusura ti viene
            comunicata <strong>per iscritto e motivata</strong>, con
            l&apos;intervento di una persona: non usiamo processi interamente
            automatizzati per decisioni che ti riguardano in modo
            significativo. Puoi chiederne il riesame scrivendoci. Per la
            chiusura, salvo obblighi di legge, violazioni reiterate o casi
            urgenti, applichiamo un preavviso di almeno 30 giorni.
          </p>
        )}
      </LegalSection>

      {isPro ? (
        <LegalSection title="5. I tuoi obblighi come professionista">
          <p>
            Operi in <strong>piena autonomia</strong>: decidi se, quando e a
            quali condizioni rispondere alle richieste, e determini liberamente i
            tuoi prezzi. Non hai alcun obbligo di accettazione e puoi lavorare
            con altre piattaforme e con clientela tua. Tra BOB e te{" "}
            <strong>
              non esiste alcun rapporto di lavoro subordinato, di agenzia o di
              rappresentanza
            </strong>
            .
          </p>
          <p>
            Dichiari e garantisci di possedere i titoli, le abilitazioni e i
            requisiti richiesti dalla normativa applicabile alle attività che
            offri (ad esempio, per gli impianti, i requisiti previsti dal D.M.
            37/2008), di essere in regola con i tuoi obblighi fiscali,
            contributivi, assicurativi e in materia di sicurezza, di disporre
            delle coperture assicurative adeguate e di emettere regolare
            documento fiscale. Tali adempimenti restano di{" "}
            <strong>tua esclusiva responsabilità</strong>: BOB non li verifica
            in via continuativa e non risponde di eventuali inadempienze.
          </p>
          <p>
            Devi comunicarci senza indugio ogni variazione rilevante (cessazione
            o sospensione della partita IVA, perdita di abilitazioni, cessazione
            dell&apos;attività). È vietato riutilizzare i dati dei clienti per
            finalità di marketing proprie.
          </p>
        </LegalSection>
      ) : (
        <LegalSection title="5. Verifica dei professionisti: cosa significa">
          <p>
            Il profilo di un professionista può indicare quali controlli BOB ha
            effettuato <strong>e a quale data</strong> (ad esempio la verifica
            che la partita IVA risultasse attiva). Si tratta di{" "}
            <strong>controlli documentali riferiti a quella data</strong>.
          </p>
          <p>
            Tali indicazioni <strong>non costituiscono</strong>: una garanzia
            della qualità, correttezza, puntualità o sicurezza della prestazione;
            una garanzia di idoneità al singolo lavoro; una certificazione ai
            sensi di norme tecniche o rilasciata da organismo accreditato; una
            garanzia di onestà o solvibilità; un&apos;assicurazione o una
            garanzia di risultato. La situazione può inoltre essere cambiata
            dopo la data del controllo.
          </p>
          <p>
            Resta a tuo carico valutare il professionista e verificare, prima di
            affidare il lavoro, quanto rilevante per il tuo caso: abilitazioni
            obbligatorie, coperture assicurative, esperienza specifica e
            congruità del preventivo. Ti consigliamo di richiedere sempre un
            preventivo scritto, conservare i documenti fiscali e pretendere le
            certificazioni di conformità previste dalla legge.
          </p>
        </LegalSection>
      )}

      <LegalSection title="6. Assistente Bob e intelligenza artificiale">
        <p>
          La chat di BOB utilizza un{" "}
          <strong>sistema di intelligenza artificiale</strong>: quando la usi
          stai interagendo con un assistente automatico, non con una persona.
          Serve a raccogliere e organizzare la richiesta.
        </p>
        <p>
          L&apos;assistente <strong>non fornisce consulenza tecnica</strong>,
          non formula diagnosi né preventivi vincolanti, può contenere errori e
          non sostituisce la valutazione di un professionista o un sopralluogo.
          {isPro
            ? " Il riepilogo che ricevi è una sintesi di quanto dichiarato dal cliente: verificalo sempre prima di formulare un'offerta."
            : " Ti invitiamo a controllare il riepilogo della richiesta prima di inviarlo."}
        </p>
      </LegalSection>

      <LegalSection title="7. Dati e riservatezza">
        {isPro ? (
          <>
            <p>
              I dati dei clienti che ricevi ti sono comunicati{" "}
              <strong>esclusivamente</strong> per formulare la tua offerta ed
              eseguire l&apos;eventuale prestazione. Rispetto a tali dati agisci
              come titolare autonomo del trattamento e sei responsabile del
              rispetto della normativa applicabile.
            </p>
            <p>
              Prendi atto che BOB può essere tenuta per legge a raccogliere,
              verificare e comunicare all&apos;Amministrazione finanziaria i
              dati identificativi e fiscali dei professionisti che operano
              tramite la piattaforma, e ti impegni a fornire i dati necessari a
              tal fine. Il trattamento dei tuoi dati è descritto nell&apos;
              <Link href="/privacy" className="text-bob-indigo underline">
                informativa privacy
              </Link>
              .
            </p>
          </>
        ) : (
          <p>
            Il trattamento dei dati è descritto nell&apos;
            <Link href="/privacy" className="text-bob-indigo underline">
              informativa privacy
            </Link>
            . Ai professionisti comunichiamo inizialmente la sola richiesta; i
            tuoi dati di contatto completi vengono trasmessi soltanto dopo che
            hai accettato di essere contattato.
          </p>
        )}
      </LegalSection>

      <LegalSection title="8. Recensioni">
        <p>
          Sono ammesse solo recensioni relative a richieste gestite tramite BOB e
          basate su esperienze reali e dirette. Sono vietate recensioni false, a
          pagamento, ottenute con pressioni o pubblicate da soggetti collegati al
          professionista o a suoi concorrenti. Le recensioni esprimono
          l&apos;opinione di chi le scrive e{" "}
          <strong>non sono una valutazione di BOB</strong>.
        </p>
        {isPro ? (
          <p>
            Hai <strong>diritto di replica</strong> pubblica e puoi segnalarci
            una recensione che ritieni falsa o offensiva: la esamineremo.
            Precisiamo però che{" "}
            <strong>
              non rimuoviamo recensioni negative legittime, né a pagamento né su
              semplice richiesta
            </strong>
            , e che non sospendiamo account per il solo fatto di averne
            ricevute.
          </p>
        ) : (
          <p>
            Possiamo rimuovere contenuti falsi, offensivi o illeciti; il
            professionista ha diritto di replica. Se cancelli il tuo account, le
            recensioni pubblicate restano visibili in forma anonima.
          </p>
        )}
      </LegalSection>

      {isPro && (
        <LegalSection title="9. Come vengono ordinati i risultati">
          <p>
            L&apos;ordine con cui i profili sono presentati ai clienti dipende
            principalmente da: compatibilità con la richiesta (categoria e
            zona), disponibilità dichiarata, livello di verifica raggiunto,
            reattività nelle risposte, completamento dei lavori sulla
            piattaforma, valutazioni ricevute e completezza del profilo.
          </p>
          <p>
            Eventuali strumenti di visibilità a pagamento possono incidere sul
            posizionamento: in tal caso l&apos;incidenza è dichiarata e il
            posizionamento a pagamento è chiaramente identificato come tale ai
            clienti. <strong>Il pagamento non sostituisce</strong> i requisiti di
            verifica né i requisiti minimi previsti per la categoria.
          </p>
        </LegalSection>
      )}

      <LegalSection title={isPro ? "10. Responsabilità" : "9. Responsabilità"}>
        <p>
          BOB fornisce la piattaforma con la diligenza dovuta, senza garantire
          che il servizio sia ininterrotto o privo di errori né la veridicità
          delle informazioni pubblicate dagli utenti.
        </p>
        <p>
          Nei limiti consentiti dalla legge, BOB non risponde:
          dell&apos;esecuzione o mancata esecuzione del lavoro, dei vizi, dei
          ritardi e dei danni derivanti dalla prestazione; della condotta, delle
          dichiarazioni e degli inadempimenti
          {isPro ? " dei clienti" : " dei professionisti"}; dei rapporti
          economici tra le parti; dei servizi di terzi integrati nella
          piattaforma.
          {isPro &&
            " Non risponde inoltre del mancato guadagno, della perdita di opportunità commerciali o del danno reputazionale."}
        </p>
        <p>
          {isPro
            ? "Ti impegni a tenere indenne BOB da pretese di clienti, terzi o autorità derivanti da violazioni dei presenti termini o di legge, dall'inesattezza delle informazioni fornite, dall'assenza dei requisiti dichiarati o dall'esecuzione della prestazione."
            : "Nulla in questi termini esclude o limita la responsabilità nei casi in cui ciò non sia consentito da norme inderogabili, né i diritti riconosciuti ai consumatori dalla legge."}
        </p>
      </LegalSection>

      <LegalSection title={isPro ? "11. Segnalazioni e reclami" : "10. Segnalazioni"}>
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
          segnalazione e ti comunicheremo l&apos;esito motivato. Per le
          violazioni di legge resta ferma la competenza delle autorità.
        </p>
        {isPro && (
          <p>
            Allo stesso indirizzo puoi presentare un reclamo sul funzionamento
            del servizio, sulle misure che ti riguardano o
            sull&apos;ordinamento dei risultati: riceverai riscontro in tempi
            ragionevoli. Se il reclamo non si risolve, le parti possono
            rivolgersi a un organismo di mediazione, ferma restando la
            possibilità di adire il giudice.
          </p>
        )}
      </LegalSection>

      <LegalSection title={isPro ? "12. Recesso e cancellazione" : "11. Recesso e cancellazione"}>
        <p>
          Puoi chiudere il tuo account in ogni momento dalle impostazioni o
          scrivendo a{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-bob-indigo underline"
          >
            {COMPANY.contactEmail}
          </a>
          . La chiusura non estingue gli obblighi già assunti verso
          {isPro ? " un cliente" : " un professionista"}.
        </p>
      </LegalSection>

      <LegalSection title={isPro ? "13. Modifiche" : "12. Modifiche"}>
        <p>
          Potremo aggiornare questi termini per motivi normativi, tecnici o di
          servizio.
          {isPro
            ? " Te lo comunicheremo con un preavviso di almeno 15 giorni (termine più lungo se le modifiche richiedono adeguamenti tecnici), fatti salvi gli obblighi di legge o di sicurezza. Le modifiche non hanno effetto retroattivo. Se non le accetti puoi cessare l'utilizzo e chiudere l'account prima che diventino efficaci, senza costi."
            : " Le modifiche saranno comunicate agli utenti registrati con congruo preavviso. Se non le accetti puoi chiudere il tuo account senza costi."}
        </p>
      </LegalSection>

      <LegalSection title={isPro ? "14. Legge applicabile e foro" : "13. Legge applicabile e foro"}>
        <p>
          Si applica la <strong>legge italiana</strong>.{" "}
          {isPro
            ? `Per le controversie è competente il foro di ${COMPANY.courtCity}. Prima di rivolgersi al giudice le parti si impegnano a cercare una soluzione amichevole.`
            : "Per i consumatori è competente il foro del luogo di residenza o domicilio. Prima di rivolgersi al giudice le parti si impegnano a cercare una soluzione amichevole."}
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
          Termini per {isPro ? "i professionisti" : "i clienti"} · versione{" "}
          {TERMS_VERSION} · ultimo aggiornamento: {TERMS_UPDATED}.
        </p>
      </LegalSection>
    </>
  );
}
