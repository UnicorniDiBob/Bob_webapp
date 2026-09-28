// IL REGISTRO DELLE VERSIONI DEI TERMINI (28/09, Lucio).
//
// PERCHE' ESISTE. Fino al 28/09 la versione dei termini era una costante,
// TERMS_VERSION, e il testo un componente solo. Il 20/09 la costante e' passata
// da 2026-07-v1 a 2026-09-v2 nello stesso commit che cambiava il testo, e da
// quel momento la v2 e' stata in vigore per tutti: senza preavviso, senza che
// la v1 restasse leggibile, e per i clienti con un numero nuovo su un testo
// identico. Nessuna di queste tre cose era una svista del commit: non c'era un
// posto dove scrivere quando un testo diventa visibile e quando diventa
// efficace, ne' uno dove tenere i testi vecchi.
//
// PERCHE' NEL CODICE E NON IN UNA TABELLA. Il testo vive nel codice e deve
// restarci (si rivede in PR). Le due date sono un impegno contrattuale: qui
// ogni cambio passa da una PR e git dice chi ha spostato una data di efficacia e
// quando, mentre una riga di tabella si aggiorna con un `update` che non lascia
// traccia. Tutto quello che legge il registro — pagine, route di accettazione,
// campanella — e' TypeScript; il database conserva solo la stringa accettata.
//
// LE DUE DATE, E PERCHE' SONO DUE.
//   pubblicataIl  da quando il testo e' VISIBILE: le pagine lo mostrano e chi si
//                 iscrive accetta questo. Prima di quella data la versione per
//                 il sito non esiste — si puo' mergiare in anticipo.
//   efficaceDal   da quando vale per chi era GIA' ISCRITTO. Per i professionisti
//                 almeno 15 giorni dopo la notifica su supporto durevole (Reg.
//                 UE 2019/1150 art. 3(2), e la sezione «Modifiche» dei nostri
//                 stessi termini). `null` = non ancora fissata: fino ad allora,
//                 per chi era gia' iscritto, vale la versione precedente.
//
// COSA NON DECIDE QUESTO FILE. La data di efficacia della v2 e il testo del
// preavviso sono decisioni di Lucio e qui restano `null` / assenti. Il registro
// e' il meccanismo, non la scelta.
//
// UNA VERSIONE PUBBLICATA NON SI TOCCA PIU'. Il suo testo e' un componente
// congelato in src/components/termini/; una correzione, anche di una virgola,
// e' una versione nuova. Il 12/09 una sezione e' stata riscritta sotto lo
// stesso numero (vedi la nota della v1 professionisti): e' esattamente quello
// che questa regola impedisce.

export type PubblicoTermini = "customer" | "professional";

/** Gli id delle versioni: il tipo obbliga ogni versione ad avere il suo testo. */
export const ID_VERSIONI = ["2026-07-v1", "2026-09-v2"] as const;
export type IdVersione = (typeof ID_VERSIONI)[number];

export interface VersioneTermini {
  versione: IdVersione;
  pubblico: PubblicoTermini;
  /** ISO 8601 con fuso. Da quando il testo e' visibile e accettabile. */
  pubblicataIl: string;
  /** ISO 8601 con fuso, o null se non ancora fissata. Vedi la testata. */
  efficaceDal: string | null;
  /** L'etichetta che il testo stesso stampa («Luglio 2026»). */
  aggiornamento: string;
  /** Cosa cambia rispetto alla versione precedente, per chi legge. */
  sommario: string[];
  /** Il commit che ha messo online questo testo. */
  commit: string;
  /** Fatti da sapere su questa versione che non stanno nel testo. */
  note?: string[];
}

/** Giorni minimi fra pubblicazione ed efficacia per i professionisti. */
export const PREAVVISO_MINIMO_PRO_GIORNI = 15;

// Le date di pubblicazione della v1 e della v2 sono quelle del merge su main
// (Vercel pubblica da main): la v1 col commit 7720067 del 30/07, la v2 con la
// PR #88 del 20/09 alle 18:28. L'ora esatta del deploy non e' registrata qui.
export const REGISTRO: readonly VersioneTermini[] = [
  {
    versione: "2026-07-v1",
    pubblico: "customer",
    pubblicataIl: "2026-07-30T00:00:00+02:00",
    efficaceDal: "2026-07-30T00:00:00+02:00",
    aggiornamento: "Luglio 2026",
    sommario: ["Prima versione dei termini per i clienti."],
    commit: "9a6e122",
  },
  {
    versione: "2026-07-v1",
    pubblico: "professional",
    pubblicataIl: "2026-07-30T00:00:00+02:00",
    efficaceDal: "2026-07-30T00:00:00+02:00",
    aggiornamento: "Luglio 2026",
    sommario: ["Prima versione dei termini per i professionisti."],
    commit: "9a6e122",
    note: [
      "Il 12/09/2026 la sezione 9 («Come vengono ordinati i risultati») è stata riscritta senza cambiare numero di versione (commit 9f06bc2). Il testo qui archiviato è quello pubblicato il 30/07, cioè quello che ha accettato chi si è iscritto prima del 12/09. Il testo del 12/09 è entrato nella versione 2026-09-v2 come sezione 10.",
    ],
  },
  {
    versione: "2026-09-v2",
    pubblico: "customer",
    pubblicataIl: "2026-09-20T18:28:00+02:00",
    efficaceDal: null,
    aggiornamento: "Settembre 2026",
    sommario: [
      "Nessuna modifica al testo per i clienti: il numero di versione è cambiato insieme a quello dei termini per i professionisti.",
    ],
    commit: "991c3dc",
  },
  {
    versione: "2026-09-v2",
    pubblico: "professional",
    pubblicataIl: "2026-09-20T18:28:00+02:00",
    efficaceDal: null,
    aggiornamento: "Settembre 2026",
    sommario: [
      "Nuova sezione 9 «Verifica del profilo: livelli, tempi ed effetti»: termine di esame di 5 giorni lavorativi, durata di 12 mesi con preavviso di 30 giorni, finestra di ricontrollo di 7 giorni, tetto di 14 giorni sui casi di cessazione della partita IVA, revoca del livello riservata a una persona.",
      "La sezione sull'ordinamento dei risultati diventa la 10, con il testo del 12/09: prima il lavoro dichiarato, poi il punteggio con i parametri in ordine di peso.",
      "Le sezioni successive sono rinumerate da 11 a 15, senza modifiche al testo.",
    ],
    commit: "991c3dc",
    note: [
      "Pubblicata il 20/09/2026 senza preavviso. Nessuna persona reale era vincolata dalla versione precedente: i professionisti registrati a quella data erano account di prova (verificato il 28/09).",
    ],
  },
];

function ms(iso: string): number {
  return new Date(iso).getTime();
}

/** Le versioni di un pubblico gia' visibili a `adesso`, dalla piu' vecchia. */
export function versioniPubblicate(
  pubblico: PubblicoTermini,
  adesso: Date = new Date()
): VersioneTermini[] {
  return REGISTRO.filter(
    (v) => v.pubblico === pubblico && ms(v.pubblicataIl) <= adesso.getTime()
  ).sort((a, b) => ms(a.pubblicataIl) - ms(b.pubblicataIl));
}

/**
 * La versione che il sito mostra e che accetta chi si iscrive adesso.
 * Lancia se non ce n'e' nessuna: senza termini pubblicati non ci si iscrive.
 */
export function ultimaPubblicata(
  pubblico: PubblicoTermini,
  adesso: Date = new Date()
): VersioneTermini {
  const elenco = versioniPubblicate(pubblico, adesso);
  const ultima = elenco[elenco.length - 1];
  if (!ultima) throw new Error(`Nessuna versione dei termini pubblicata per ${pubblico}`);
  return ultima;
}

/**
 * La versione che vale per chi era gia' iscritto: l'ultima con una data di
 * efficacia passata. Diversa da ultimaPubblicata() durante un preavviso, e
 * finche' la data di efficacia non e' fissata.
 */
export function inVigorePerGliIscritti(
  pubblico: PubblicoTermini,
  adesso: Date = new Date()
): VersioneTermini | null {
  const efficaci = versioniPubblicate(pubblico, adesso).filter(
    (v) => v.efficaceDal !== null && ms(v.efficaceDal) <= adesso.getTime()
  );
  return efficaci[efficaci.length - 1] ?? null;
}

/** Una versione per id, solo se gia' pubblicata: l'archivio non anticipa. */
export function trovaPubblicata(
  pubblico: PubblicoTermini,
  versione: string,
  adesso: Date = new Date()
): VersioneTermini | null {
  return versioniPubblicate(pubblico, adesso).find((v) => v.versione === versione) ?? null;
}

/** Il pubblico dei termini per un ruolo. Lo staff non accetta termini da qui. */
export function pubblicoPerRuolo(ruolo: string | null | undefined): PubblicoTermini | null {
  if (ruolo === "professional") return "professional";
  if (ruolo === "customer") return "customer";
  return null;
}

/** Data leggibile in italiano, fuso di Roma. */
export function dataTermini(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Le regole che il registro deve rispettare, come elenco di violazioni.
 * Le verifica il test: una data di efficacia troppo vicina alla pubblicazione
 * fa fallire la CI invece di arrivare in produzione.
 */
export function violazioniRegistro(registro: readonly VersioneTermini[] = REGISTRO): string[] {
  const errori: string[] = [];
  const viste = new Set<string>();
  for (const v of registro) {
    const chiave = `${v.pubblico}/${v.versione}`;
    if (viste.has(chiave)) errori.push(`${chiave}: doppione`);
    viste.add(chiave);
    if (!/^\d{4}-\d{2}-v\d+$/.test(v.versione)) errori.push(`${chiave}: formato del numero`);
    if (Number.isNaN(ms(v.pubblicataIl))) errori.push(`${chiave}: pubblicataIl non e' una data`);
    if (v.efficaceDal !== null) {
      if (Number.isNaN(ms(v.efficaceDal))) errori.push(`${chiave}: efficaceDal non e' una data`);
      else if (ms(v.efficaceDal) < ms(v.pubblicataIl))
        errori.push(`${chiave}: efficace prima di essere pubblicata`);
    }
    if (v.sommario.length === 0) errori.push(`${chiave}: sommario vuoto`);
  }
  for (const pubblico of ["customer", "professional"] as const) {
    const elenco = registro
      .filter((v) => v.pubblico === pubblico)
      .sort((a, b) => ms(a.pubblicataIl) - ms(b.pubblicataIl));
    elenco.forEach((v, i) => {
      if (i === 0) return;
      const prima = elenco[i - 1];
      if (ms(v.pubblicataIl) === ms(prima.pubblicataIl))
        errori.push(`${pubblico}/${v.versione}: stessa data di pubblicazione della precedente`);
      if (
        pubblico === "professional" &&
        v.efficaceDal !== null &&
        ms(v.efficaceDal) - ms(v.pubblicataIl) <
          PREAVVISO_MINIMO_PRO_GIORNI * 24 * 60 * 60 * 1000
      ) {
        errori.push(
          `professional/${v.versione}: efficace meno di ${PREAVVISO_MINIMO_PRO_GIORNI} giorni dopo la pubblicazione (art. 3(2) P2B)`
        );
      }
    });
  }
  return errori;
}
