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

/**
 * Confronto tollerante tra la denominazione restituita dalla banca dati e il
 * nome sul profilo: serve a segnalare le discordanze evidenti senza bocciare
 * differenze innocue (forma societaria, punteggiatura, ordine nome/cognome).
 * Non decide da solo: alimenta il controllo umano (regola "human in the loop").
 */
export function nameLooksConsistent(
  profileName: string,
  registryName: string
): boolean {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      // via le forme societarie e le abbreviazioni più comuni
      .replace(/\b(s\.?r\.?l\.?s?|s\.?p\.?a|s\.?n\.?c|s\.?a\.?s|ditta|impresa|individuale|di)\b/g, " ")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const profileWords = clean(profileName);
  const registryWords = new Set(clean(registryName));
  if (profileWords.length === 0 || registryWords.size === 0) return false;

  // Basta che una parola significativa combaci: nomi commerciali e ragioni
  // sociali raramente coincidono parola per parola.
  return profileWords.some((w) => registryWords.has(w));
}
