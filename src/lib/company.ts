// Dati societari di BOB, usati in footer e pagine legali.
// ⚠️ PRIMA DEL DEPLOY: sostituire i placeholder con i dati reali.
// Un unico punto di modifica: aggiornando qui, si aggiornano footer,
// privacy, cookie policy, termini e chi-siamo.

export const COMPANY = {
  /** Ragione sociale o nome del titolare (es. "Bob S.r.l." o "Mario Rossi") */
  legalName: "[RAGIONE SOCIALE]",
  /** Partita IVA — obbligatoria sul sito ex art. 35 DPR 633/1972 */
  vat: "[P.IVA]",
  /** Sede legale */
  address: "[INDIRIZZO SEDE LEGALE]",
  /** Email di contatto generale (mostrata nel footer e in chi-siamo) — es. ciao@meetonda.com */
  contactEmail: "[EMAIL CONTATTO]",
  /** Email per richieste privacy (può coincidere con contactEmail) */
  privacyEmail: "[EMAIL PRIVACY]",
  /** Foro competente per i non-consumatori (termini di servizio) */
  courtCity: "[CITTÀ FORO COMPETENTE]",
} as const;

/** True se i dati societari sono ancora placeholder (usato per warning in dev). */
export const COMPANY_HAS_PLACEHOLDERS = Object.values(COMPANY).some((v) =>
  v.startsWith("[")
);
