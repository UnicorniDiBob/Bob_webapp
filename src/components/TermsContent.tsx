import { TESTI } from "@/components/termini/testi";
import type { IdVersione, PubblicoTermini } from "@/lib/termini/registro";

/**
 * Il testo dei Termini del servizio per una versione e un pubblico.
 *
 * Fino al 28/09 questo file CONTENEVA il testo e la costante TERMS_VERSION:
 * una versione sola, riscritta sul posto. Adesso ogni versione e' un testo
 * congelato in src/components/termini/ e quale mostrare lo decide il registro
 * (src/lib/termini/registro.ts): chi chiama passa la versione, di solito
 * `ultimaPubblicata(pubblico).versione`. Cosi' le pagine, la finestra
 * dell'iscrizione e l'archivio non possono mostrare testi diversi per la
 * stessa versione.
 */
export type TermsAudience = PubblicoTermini;

export function TermsContent({
  audience,
  versione,
}: {
  audience: TermsAudience;
  versione: IdVersione;
}) {
  const Testo = TESTI[versione];
  return <Testo audience={audience} />;
}
