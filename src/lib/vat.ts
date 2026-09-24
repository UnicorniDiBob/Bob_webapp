// Validazione e normalizzazione della partita IVA italiana.
//
// Primo filtro della verifica (blocco 10): gratuito, istantaneo, offline.
// Scarta refusi e numeri inventati PRIMA di spendere una chiamata a pagamento
// verso il fornitore dati. Non dice nulla sull'esistenza o sull'attività della
// partita IVA: per quello serve il riscontro sulla banca dati ufficiale.
//
// Algoritmo: 11 cifre, di cui l'ultima è il carattere di controllo calcolato
// secondo lo schema ministeriale (somma delle cifre di posizione dispari +
// somma dei doppi delle cifre di posizione pari, con riduzione dei valori > 9;
// il controllo è il complemento a 10 dell'ultima cifra della somma).

/** Livelli di verifica: valori tecnici del DB (migration 029). */
export type VerificationLevel = "none" | "vat_verified" | "documents_verified";

/**
 * SLA DICHIARATO DELLA CODA DI VERIFICA: 5 giorni lavorativi (12/09, Lucio).
 * Sta qui perche' la stessa cifra va detta al professionista mentre aspetta,
 * nei ToS pro («SLA di esame») e in assistenza: tre copie divergono, una no.
 * Oggi e' una promessa NON misurata - la coda non ha un timestamp di ingresso
 * e nessuno confronta il dichiarato col fatto.
 */
export const SLA_VERIFICA_GIORNI_LAVORATIVI = 5;

// ---------------------------------------------------------------------------
// La scadenza della verifica (12/09, Lucio — chiude 10.4)
// ---------------------------------------------------------------------------
// UN ANNO. Il costo del ricontrollo non e' il controllo, e' l'esame umano: il
// VIES risponde solo per la minoranza iscritta agli scambi intra-UE, e per
// tutti gli altri un esito negativo non e' un segnale, e' la normalita'.
// Ripassarlo piu' spesso produce rumore, non controlli.
//
// LA DATA NON DECLASSA NESSUNO DA SOLA: alla scadenza la riga va in
// «Ricontrollo» e decide una persona (art. 22 GDPR). Il preavviso esiste anche
// per il Regolamento P2B art. 4, che per ogni restrizione del servizio vuole
// motivazione e preavviso — e perdere l'etichetta lo e'.

/** Quanto vale una verifica prima del ricontrollo. */
export const VALIDITA_VERIFICA_MESI = 12;

/**
 * LA FINESTRA DEL RICONTROLLO: 7 giorni dall'apertura del caso, cioe' i 5
 * giorni lavorativi gia' dichiarati (13/09, Lucio). Un numero solo per due
 * strade: la scadenza annuale apre il ricontrollo 7 giorni prima, quindi la
 * finestra coincide con la data; una cessazione lo apre subito, e da li' il
 * professionista ha la stessa finestra per rispondere. Se risponde, la palla e'
 * nostra e il badge tiene; se non risponde, cade.
 */
export const FINESTRA_RICONTROLLO_GIORNI = 7;

/**
 * IL TETTO SUI CASI DI CESSAZIONE: 14 giorni dall'apertura del caso (20/09,
 * Lucio — mig 094). La regola 3 della 080 dice che il badge tiene finche' il
 * caso aspetta NOI, e su una scadenza annuale e' giusta: chi ha risposto non
 * paga la nostra lentezza. Su una cessazione no: li' il registro dice gia' che
 * la partita IVA non risulta attiva, e senza un limite l'etichetta
 * «Verificato» resterebbe accesa ai clienti per tutto il tempo che ci mettiamo
 * a guardare il caso. Non e' un numero nuovo: sono la finestra del
 * professionista (7) piu' i 5 giorni lavorativi del nostro esame, che in
 * giorni solari sono 7. Oltre quel giorno lo sforamento lo paghiamo noi in
 * visibilita' promessa, non il cliente in informazione falsa.
 *
 * Il LIVELLO non si tocca: lo toglie una persona, con motivazione scritta.
 * Questa e' una regola di lettura, reversibile come tutte le altre.
 */
export const TETTO_CESSAZIONE_GIORNI = 14;

/** Da quanti giorni prima lo diciamo nella campanella. */
export const PREAVVISO_SCADENZA_GIORNI = 30;

/** Da quanti giorni LAVORATIVI prima si mette davanti la finestra. */
export const PREAVVISO_FINESTRA_GIORNI_LAVORATIVI = 5;

export type FaseScadenza =
  | "valida"
  | "preavviso"
  | "ultima-settimana"
  | "scaduta";

export interface StatoScadenza {
  fase: FaseScadenza;
  scadeIl: Date;
  /** Giorni solari mancanti. Negativi se e' gia' scaduta. */
  giorni: number;
  /** Giorni lavorativi mancanti (sabato e domenica esclusi, festivi no). */
  giorniLavorativi: number;
}

const GIORNO_MS = 86_400_000;

/** Giorni lavorativi fra due date: sabato e domenica esclusi, festivi no. */
export function giorniLavorativiTra(da: Date, a: Date): number {
  if (a <= da) return 0;
  const cursore = new Date(da);
  cursore.setHours(0, 0, 0, 0);
  const fine = new Date(a);
  fine.setHours(0, 0, 0, 0);
  let n = 0;
  while (cursore < fine) {
    cursore.setDate(cursore.getDate() + 1);
    const g = cursore.getDay();
    if (g !== 0 && g !== 6) n += 1;
  }
  return n;
}

/** Somma n giorni LAVORATIVI a una data: sabato e domenica saltati, festivi no. */
export function aggiungiGiorniLavorativi(da: Date, n: number): Date {
  const d = new Date(da);
  let restanti = n;
  while (restanti > 0) {
    d.setDate(d.getDate() + 1);
    const g = d.getDay();
    if (g !== 0 && g !== 6) restanti -= 1;
  }
  return d;
}

export interface StatoCoda {
  /** Da quando il caso aspetta NOI (stato pending). */
  apertoIl: Date;
  /** Il giorno in cui sforiamo l'SLA dichiarato. */
  scadenzaSla: Date;
  /** Giorni lavorativi gia' passati in coda. */
  inCoda: number;
  /** Giorni lavorativi che mancano allo sforamento. Negativi se gia' sforato. */
  rimasti: number;
  sforata: boolean;
}

/**
 * Quanto aspetta un caso della coda P.IVA, in giorni lavorativi.
 *
 * L'SLA e' UNO SOLO per tutti (5 giorni lavorativi), quindi ordinare per
 * scadenza equivale a ordinare per ingresso: il piu' vecchio e' anche il piu'
 * vicino a sforare. Restituire comunque la data serve a scriverla, non a
 * ordinare — una cifra che il professionista puo' vedere va calcolata in un
 * posto solo.
 *
 * null quando il caso non aspetta noi: nessun orologio, niente da promettere.
 */
export function statoCoda(
  apertoIl: string | null,
  adesso: Date = new Date()
): StatoCoda | null {
  if (!apertoIl) return null;
  const aperto = new Date(apertoIl);
  if (Number.isNaN(aperto.getTime())) return null;

  const scadenzaSla = aggiungiGiorniLavorativi(
    aperto,
    SLA_VERIFICA_GIORNI_LAVORATIVI
  );
  const sforata = adesso > scadenzaSla;

  return {
    apertoIl: aperto,
    scadenzaSla,
    inCoda: giorniLavorativiTra(aperto, adesso),
    rimasti: sforata
      ? -giorniLavorativiTra(scadenzaSla, adesso)
      : giorniLavorativiTra(adesso, scadenzaSla),
    sforata,
  };
}

/**
 * A che punto e' la validita' di una verifica.
 * null quando non c'e' nessuna scadenza da seguire (nessun livello attivo).
 */
export function statoScadenza(
  scadenza: string | null,
  adesso: Date = new Date()
): StatoScadenza | null {
  if (!scadenza) return null;
  const scadeIl = new Date(scadenza);
  if (Number.isNaN(scadeIl.getTime())) return null;

  const giorni = Math.ceil((scadeIl.getTime() - adesso.getTime()) / GIORNO_MS);
  const giorniLavorativi = giorniLavorativiTra(adesso, scadeIl);

  const fase: FaseScadenza =
    giorni < 0
      ? "scaduta"
      : giorniLavorativi <= PREAVVISO_FINESTRA_GIORNI_LAVORATIVI
        ? "ultima-settimana"
        : giorni <= PREAVVISO_SCADENZA_GIORNI
          ? "preavviso"
          : "valida";

  return { fase, scadeIl, giorni, giorniLavorativi };
}

/**
 * Etichette mostrate agli utenti. Unico punto in cui vivono i nomi.
 *
 * «VERIFICATO» E BASTA (12/09, scelta di Lucio). Si chiamavano "Pro" e "Pro+",
 * cioe' come i piani a pagamento: un professionista col piano Free non poteva
 * avere il badge "Pro", e uno col piano Plus si vedeva scritto "Pro" addosso.
 * Due scale diverse con gli stessi nomi si spiegano male a noi e malissimo a
 * un cliente, che davanti a "Pro" non sa se ha comprato qualcosa o se e' stato
 * controllato. Il cliente ha bisogno di sapere UNA cosa: questo profilo e'
 * stato verificato, e quando.
 *
 * I due livelli restano distinti nel database e nel lavoro dello staff (il
 * secondo attesta anche un esame documentale): cambia solo cosa si legge
 * fuori. Cosa sia stato controllato lo dice VERIFICATION_MEANING, nel
 * dettaglio del badge.
 */
export const VERIFICATION_LABEL: Record<VerificationLevel, string> = {
  none: "Non verificato",
  vat_verified: "Verificato",
  documents_verified: "Verificato",
};

/**
 * Le stesse etichette, ma per lo STAFF. Fuori i due livelli si leggono uguali
 * — al cliente interessa una cosa sola — ma chi lavora la coda deve sapere se
 * dietro c'e' anche un esame documentale, altrimenti non puo' decidere.
 */
export const VERIFICATION_LABEL_STAFF: Record<VerificationLevel, string> = {
  none: "Nessuno",
  vat_verified: "Verificato (P.IVA)",
  documents_verified: "Verificato (documenti)",
};

/** Descrizione sintetica di cosa attesta ciascun livello (per tooltip e UI). */
export const VERIFICATION_MEANING: Record<VerificationLevel, string> = {
  none: "Profilo non verificato: le informazioni sono dichiarate dal professionista.",
  vat_verified:
    "Alla data indicata la partita IVA risultava esistente e attiva, con intestazione corrispondente al profilo.",
  documents_verified:
    "Alla data indicata sono stati esaminati anche il documento d'identità del titolare e la documentazione d'impresa richiesta per la categoria.",
};

/**
 * Cosa il livello NON attesta. Va mostrato accanto al significato, non nascosto
 * in fondo ai termini: è la parte che ci separa da una certificazione, e la
 * frase è allineata al §3.2 dei ToS professionisti.
 */
export const VERIFICATION_CAVEAT: Record<VerificationLevel, string> = {
  none: "Nessun controllo svolto da BOB su questo profilo.",
  vat_verified:
    "Non è una certificazione né una garanzia sulla qualità del lavoro, e non attesta le abilitazioni tecniche richieste per la categoria.",
  documents_verified:
    "È un esame formale dei documenti alla data indicata, non una certificazione, un'omologazione o una garanzia di BOB sul lavoro svolto.",
};

/**
 * Stato dell'esame umano sui casi che il VIES non conferma (migration 034).
 * null in DB = niente in sospeso.
 */
export type VatReviewState =
  | "pending"
  | "docs_requested"
  | "rejected"
  /** Era verificato e va riguardato: scadenza o segnale sulla P.IVA (079). */
  | "recheck";

/**
 * Perche' una verifica e' finita in ricontrollo. E' un dato e non una frase
 * perche' decide tre cose: l'ordine della coda (una cessazione non aspetta una
 * scadenza), cosa scriviamo al professionista, e la motivazione scritta che il
 * Regolamento P2B (art. 4) pretende se poi il livello cade davvero.
 */
export type MotivoRicontrollo =
  /** E' passato l'anno: il controllo va rifatto, non c'e' niente di storto. */
  | "scadenza"
  /** Il riscontro dice che la partita IVA non risulta piu' attiva. */
  | "cessazione"
  /** Liquidazione, concordato, amministrazione straordinaria nel nome. */
  | "procedura"
  /** L'intestazione non corrisponde piu' al profilo. */
  | "intestazione";

/** Come lo legge il professionista: prima riga della notifica e del riquadro. */
export const MOTIVO_RICONTROLLO_TITOLO: Record<MotivoRicontrollo, string> = {
  scadenza: "Stiamo rifacendo il controllo della tua partita IVA",
  cessazione: "La tua partita IVA non risulta piu' attiva",
  procedura: "Il registro segnala una procedura sulla tua impresa",
  intestazione: "L'intestazione della partita IVA non corrisponde al profilo",
};

/**
 * Cosa succede adesso, detto al professionista senza girarci intorno.
 *
 * NIENTE PROMESSE CHE LA REGOLA NON MANTIENE (14/09, Lucio). Tre di queste
 * quattro righe dicevano che il badge non si tocca finche' non lo guarda una
 * persona. Dal 13/09 non e' piu' vero: `verification_badge_until` (mig 080)
 * spegne l'etichetta alla fine della finestra del ricontrollo anche se nessuno
 * di noi ha aperto il caso. Resta vero — ed e' quello che va detto — che il
 * LIVELLO non lo toglie nessun automatismo: quella e' una decisione di una
 * persona, motivata (art. 22 GDPR), e l'etichetta torna da sola appena il
 * controllo passa. Il giorno in cui si spegne lo scrive fraseEtichettaFinoAl(),
 * perche' una data che il professionista puo' vedere si calcola in un posto
 * solo (Reg. P2B art. 4: una restrizione si preavvisa e si motiva).
 */
export const MOTIVO_RICONTROLLO_TESTO: Record<MotivoRicontrollo, string> = {
  scadenza:
    "La verifica vale un anno ed è arrivata a scadenza. Il ricontrollo lo facciamo noi: nella maggior parte dei casi non ti chiediamo niente. Se ti chiediamo un documento e ce lo mandi, l'etichetta resta accesa finché non decidiamo noi.",
  cessazione:
    "Il controllo dice che la partita IVA con cui sei verificato non risulta più attiva. Può essere un dato del registro non aggiornato, o un numero cambiato: il livello non te lo toglie nessun automatismo, lo decide una persona. Se hai cambiato partita IVA inseriscila qui: appena il controllo passa torna tutto da solo.",
  procedura:
    "Nella denominazione risulta una procedura in corso (per esempio una liquidazione). Non è un rifiuto e il livello non lo tocca nessun automatismo: lo guarda una persona, e se il dato è vecchio si chiude lì.",
  intestazione:
    "Il nome a cui risulta intestata la partita IVA non corrisponde più a quello del profilo. Lo guarda una persona: se hai cambiato ragione sociale, aggiornala nel profilo.",
};

/**
 * La riga che dice fino a quando l'etichetta si vede, in un posto solo.
 *
 * La data arriva gia' formattata da chi chiama: ogni schermata ha il suo
 * formato, la frase no. `inRicontrollo` cambia la seconda meta' perche'
 * cambia la posta in gioco — un rinnovo annuale non e' un caso aperto.
 */
export function fraseEtichettaFinoAl(
  dataFormattata: string,
  inRicontrollo: boolean = false
): string {
  const base = `L'etichetta resta visibile ai clienti fino al ${dataFormattata}.`;
  return inRicontrollo
    ? `${base} Se il caso non si chiude prima, dopo quel giorno il profilo torna «Iscritto»: il livello non si perde e l'etichetta riappare da sola appena il controllo passa.`
    : `${base} Poi la rinnoviamo noi: se ci serve un documento te lo chiediamo qui.`;
}

/** Come lo legge lo staff nella coda. */
export const MOTIVO_RICONTROLLO_STAFF: Record<MotivoRicontrollo, string> = {
  scadenza: "Scadenza annuale",
  cessazione: "P.IVA non piu' attiva",
  procedura: "Procedura nella denominazione",
  intestazione: "Intestazione non corrispondente",
};

/** Peso per ordinare o confrontare i livelli (più alto = più verificato). */
export function verificationLevelWeight(level: VerificationLevel): number {
  if (level === "documents_verified") return 2;
  if (level === "vat_verified") return 1;
  return 0;
}

/**
 * Livello da mostrare al pubblico.
 *
 * "Pro+" attesta un esame documentale umano: lo mostriamo solo se anche lo
 * staff ha approvato il profilo (professionals.verification_status), come
 * previsto dalla 029. Se il livello dice documents_verified ma l'approvazione
 * non c'è, mostriamo "Pro": meglio dire meno del vero che di più.
 */
export function publicVerificationLevel(
  level: VerificationLevel,
  staffStatus: "unverified" | "pending" | "verified",
  scadenza: string | null = null,
  inEsame: boolean = false,
  tetto: string | null = null
): VerificationLevel {
  // SCADUTA = NON VERIFICATA, per chi guarda. Il livello nel database resta
  // dov'e': lo toglie una persona dalla coda Ricontrollo, con motivazione
  // scritta (art. 22 GDPR). Qui cambia solo cosa si legge, ed e' reversibile —
  // al rinnovo il badge torna da solo. Il preavviso a 30 giorni della 078 e' il
  // preavviso di questa perdita (Reg. P2B art. 4). La stessa regola vale per i
  // punti dell'ordinamento, nella migrazione 081: se divergono, la scheda dice
  // una cosa e l'ordine ne fa un'altra.
  const vivo = livelloVisibile(level, scadenza, inEsame, tetto);
  if (vivo === "none") return "none";
  if (level === "documents_verified" && staffStatus !== "verified") {
    return "vat_verified";
  }
  return level;
}

/**
 * Quando si spegne il badge: la prima fra la scadenza annuale e la fine della
 * finestra del ricontrollo. Senza la seconda, una cessazione lascerebbe
 * l'etichetta accesa per tutti i mesi che mancano alla scadenza, cioe' proprio
 * nel caso in cui il registro dice gia' che e' falsa.
 */
export function scadenzaBadge(
  scadenza: string | null,
  ricontrolloApertoIl: string | null
): string | null {
  const date = [scadenza, ricontrolloApertoIl ? addGiorni(ricontrolloApertoIl, FINESTRA_RICONTROLLO_GIORNI) : null]
    .filter((d): d is string => !!d)
    .sort();
  return date[0] ?? null;
}

function addGiorni(iso: string, n: number): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

/**
 * Il giorno in cui l'etichetta si spegne ANCHE se il caso aspetta noi.
 *
 * Solo per i casi aperti per cessazione: negli altri tre motivi il registro non
 * dice che la partita IVA e' spenta, dice che va riguardata, e la regola della
 * 080 basta. null quando il tetto non si applica — e null significa «nessun
 * tetto», non «gia' scaduto».
 *
 * Regola gemella in SQL: professionals.verification_badge_max_until, tenuta dal
 * trigger sync_verification_level (mig 094). Se una delle due cambia senza
 * l'altra, la scheda pubblica e l'ordinamento dicono cose diverse sullo stesso
 * profilo.
 */
export function tettoRicontrollo(
  ricontrolloApertoIl: string | null,
  motivo: MotivoRicontrollo | string | null
): string | null {
  if (!ricontrolloApertoIl || motivo !== "cessazione") return null;
  return addGiorni(ricontrolloApertoIl, TETTO_CESSAZIONE_GIORNI);
}

/**
 * Il livello da MOSTRARE, scadenza compresa e senza il gate dello staff.
 *
 * Lo usano le pagine del professionista, dove il commento dice da sempre «qui
 * il pro deve vedere la stessa etichetta che vedono i clienti»: se la scadenza
 * la applicasse solo la scheda pubblica, quella frase diventerebbe falsa e il
 * professionista si vedrebbe verificato mentre i clienti non lo vedono piu'.
 */
export function livelloVisibile(
  level: VerificationLevel,
  scadenza: string | null,
  inEsame: boolean = false,
  tetto: string | null = null
): VerificationLevel {
  // IL TETTO VIENE PRIMA DI TUTTO (094). Su un caso di cessazione «la palla e'
  // nostra» non e' piu' una ragione sufficiente per tenere accesa l'etichetta:
  // oltre il tetto si spegne comunque. Vedi tettoRicontrollo().
  if (tetto && verificaScaduta(tetto)) return "none";
  // LA SCADENZA NON MORDE MENTRE LA PALLA E' DA NOI (13/09, Lucio). Chi carica
  // i documenti l'ultimo giorno utile non puo' perdere l'etichetta per il tempo
  // che ci mettiamo NOI a guardarli: quella verifica non e' scaduta per colpa
  // sua, sta aspettando una nostra decisione. Alla conferma riparte l'anno; al
  // rifiuto il badge cade, ed e' una decisione presa da una persona.
  if (inEsame) return level;
  return level !== "none" && verificaScaduta(scadenza) ? "none" : level;
}

/** Vero quando la verifica ha una data ed e' passata. */
export function verificaScaduta(
  scadenza: string | null,
  adesso: Date = new Date()
): boolean {
  if (!scadenza) return false;
  const d = new Date(scadenza);
  return !Number.isNaN(d.getTime()) && d <= adesso;
}

/**
 * Rimuove spazi, punti e il prefisso IT, e porta in maiuscolo.
 * Accetta quindi "IT 12345678901", "12.345.678.901" ecc.
 */
export function normalizeVat(input: string): string {
  return input.trim().toUpperCase().replace(/[\s.\-/]/g, "").replace(/^IT/, "");
}

/**
 * Verifica formato (11 cifre) e carattere di controllo.
 * Non contatta nessun servizio esterno.
 */
export function isValidItalianVat(input: string): boolean {
  const vat = normalizeVat(input);
  if (!/^\d{11}$/.test(vat)) return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = Number(vat[i]);
    if (i % 2 === 0) {
      // Posizioni dispari (1ª, 3ª, …): si sommano così come sono.
      sum += digit;
    } else {
      // Posizioni pari: si raddoppia e, se il risultato supera 9, si sottrae 9
      // (equivale a sommare le cifre del doppio).
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }

  const expectedCheck = (10 - (sum % 10)) % 10;
  return Number(vat[10]) === expectedCheck;
}

/**
 * Messaggio d'errore pronto per la UI, oppure null se il valore è formalmente
 * valido. Distinguere i casi aiuta l'utente a correggersi da solo.
 */
export function vatValidationError(input: string): string | null {
  const raw = input.trim();
  if (!raw) return "Inserisci la partita IVA.";

  const vat = normalizeVat(raw);
  if (/[^0-9]/.test(vat)) {
    return "La partita IVA deve contenere solo cifre (puoi omettere il prefisso IT).";
  }
  if (vat.length !== 11) {
    return `La partita IVA italiana ha 11 cifre: ne hai inserite ${vat.length}.`;
  }
  if (!isValidItalianVat(vat)) {
    return "Il numero non supera il controllo di validità: ricontrolla le cifre.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Confronto fra la denominazione del registro e i nomi che conosciamo del
// professionista.
//
// Questo confronto non è più un semplice avviso: da quando la concessione
// automatica dipende da lui, decide se un profilo diventa "Pro". Quindi la
// vecchia regola — bastava UNA parola in comune di tre lettere — non va più
// bene: faceva combaciare "Studio Milano" con "Milano Servizi", cioè due
// aziende diverse della stessa città.
//
// La regola nuova, in parole povere: devono combaciare almeno due parole
// significative e coprire la maggior parte del nome più corto. Con un nome di
// una sola parola si accetta la corrispondenza piena, ma solo se quella parola
// è specifica: "Milano" da sola non identifica nessuno.
// ---------------------------------------------------------------------------

/** Forme societarie e parole di servizio: non distinguono un'azienda da un'altra. */
const FORME_SOCIETARIE =
  /\b(s\.?r\.?l\.?s?|s\.?p\.?a\.?|s\.?n\.?c\.?|s\.?a\.?s\.?|s\.?a\.?p\.?a\.?|s\.?s\.?|societa|soc|cooperativa|coop|ditta|impresa|individuale|unipersonale|di|del|della|dei|delle|and)\b/g;

/**
 * Parole troppo comuni per identificare qualcuno da sole: città, mestieri,
 * aggettivi da insegna. Contano nel confronto, ma non bastano da sole.
 */
const PAROLE_GENERICHE = new Set([
  "milano", "roma", "torino", "napoli", "firenze", "bologna", "genova",
  "italia", "italiana", "italiane", "italiano", "nord", "sud", "centro",
  "servizi", "service", "impianti", "impianto", "costruzioni", "edile",
  "edilizia", "studio", "group", "groupe", "holding", "consulting", "lavori",
  "casa", "house", "home", "tecnica", "tecnico", "tecnologie", "sistemi",
  "express", "professional", "professionale", "green", "eco", "new", "top",
]);

/** Riduce un nome alle sue parole significative, in forma confrontabile. */
function paroleSignificative(nome: string): string[] {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(FORME_SOCIETARIE, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * I due nomi indicano plausibilmente lo stesso soggetto?
 *
 * Vero quando: due o più parole significative in comune che coprono almeno il
 * 60% del nome più corto; oppure il nome più corto è una sola parola specifica
 * (almeno 5 lettere, non generica) e quella parola c'è anche nell'altro.
 */
export function namesMatch(nomeA: string, nomeB: string): boolean {
  const a = paroleSignificative(nomeA);
  const b = paroleSignificative(nomeB);
  if (a.length === 0 || b.length === 0) return false;

  const setB = new Set(b);
  const comuni = [...new Set(a)].filter((w) => setB.has(w));
  if (comuni.length === 0) return false;

  const minParole = Math.min(new Set(a).size, setB.size);
  const copertura = comuni.length / minParole;

  if (comuni.length >= 2 && copertura >= 0.6) return true;

  if (
    minParole === 1 &&
    comuni.length === 1 &&
    comuni[0].length >= 5 &&
    !PAROLE_GENERICHE.has(comuni[0])
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Procedure concorsuali nella denominazione (blocco 10, task 10.12)
//
// Scoperta il 01/08 provando partite IVA di aziende defunte: una società in
// liquidazione, in amministrazione straordinaria o in LCA **mantiene la partita
// IVA attiva**, e il VIES la conferma. Verificato su Alitalia (in A.S. dal
// 2017), Alitalia Linee Aeree (dal 2008), Banca Popolare di Vicenza e Veneto
// Banca (LCA dal 2017): tutte `isValid: true`.
//
// Quindi il riscontro fiscale, da solo, direbbe "Pro" a un'azienda ferma da
// otto anni. Il segnale però è scritto nella denominazione stessa, ed è quello
// che intercettiamo qui.
//
// Cosa NON fa: non rifiuta. Un'impresa in concordato in continuità lavora
// ancora, e non sta a un'espressione regolare decidere se può stare sul
// marketplace. Sospende la concessione automatica e passa la palla a una
// persona — la stessa regola di tutto il resto del blocco.
// ---------------------------------------------------------------------------

/** Espressioni che indicano una procedura in corso, come le scrive il registro. */
const SEGNALI_PROCEDURA: { pattern: RegExp; etichetta: string }[] = [
  { pattern: /\bin\s+liquidazione\s+coatta(\s+amministrativa)?\b/i, etichetta: "liquidazione coatta amministrativa" },
  { pattern: /\bl\.?\s?c\.?\s?a\.?\b/i, etichetta: "liquidazione coatta amministrativa (LCA)" },
  { pattern: /\bin\s+liquidazione\b/i, etichetta: "in liquidazione" },
  { pattern: /\bamministrazione\s+straordinaria\b/i, etichetta: "amministrazione straordinaria" },
  { pattern: /\bin\s+a\.?\s?s\.?\b/i, etichetta: "amministrazione straordinaria (A.S.)" },
  { pattern: /\bconcordato\s+preventivo\b/i, etichetta: "concordato preventivo" },
  { pattern: /\bin\s+concordato\b/i, etichetta: "concordato" },
  { pattern: /\bfallimento\b|\bfallit[ao]\b/i, etichetta: "fallimento" },
  { pattern: /\bin\s+scioglimento\b/i, etichetta: "scioglimento" },
  { pattern: /\bcessat[ao]\b/i, etichetta: "cessata" },
];

/**
 * La denominazione restituita dal registro segnala una procedura in corso?
 * Restituisce l'etichetta leggibile da mettere nella nota, o null.
 */
export function procedureFlagInName(registryName: string | null): string | null {
  if (!registryName) return null;
  for (const { pattern, etichetta } of SEGNALI_PROCEDURA) {
    if (pattern.test(registryName)) return etichetta;
  }
  return null;
}

/** Da dove è arrivata la corrispondenza: serve nel registro e nella telemetria. */
export type NameMatchSource = "profile_name" | "declared_name";

/**
 * Confronta la denominazione del registro con TUTTI i nomi che già abbiamo del
 * professionista, senza chiedergli niente in più: prima il nome pubblico del
 * profilo, poi la ragione sociale che ha dichiarato.
 *
 * Restituisce quale dei due ha combaciato, perché non sono equivalenti: il
 * nome del profilo è quello che i clienti vedranno accanto al badge, mentre la
 * ragione sociale è un testo che ha scritto lui. Chi legge il registro deve
 * poter distinguere.
 */
export function matchRegistryName(
  registryName: string | null,
  nomi: { profileName?: string | null; declaredName?: string | null }
): NameMatchSource | null {
  if (!registryName) return null;
  if (nomi.profileName && namesMatch(nomi.profileName, registryName)) {
    return "profile_name";
  }
  if (nomi.declaredName && namesMatch(nomi.declaredName, registryName)) {
    return "declared_name";
  }
  return null;
}
