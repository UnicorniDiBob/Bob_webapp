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

/** Etichette mostrate agli utenti. Unico punto in cui vivono i nomi commerciali. */
export const VERIFICATION_LABEL: Record<VerificationLevel, string> = {
  none: "Iscritto",
  vat_verified: "Pro",
  documents_verified: "Pro+",
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
export type VatReviewState = "pending" | "docs_requested" | "rejected";

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
  staffStatus: "unverified" | "pending" | "verified"
): VerificationLevel {
  if (level === "documents_verified" && staffStatus !== "verified") {
    return "vat_verified";
  }
  return level;
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
