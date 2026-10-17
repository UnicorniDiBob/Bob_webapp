// LA SCELTA DEI PROFESSIONISTI NELLA CHAT DI BOB (17/10, decisioni di André).
//
// Nella chat il cliente spunta fino a MAX_PRO_PER_RICHIESTA professionisti fra
// quelli suggeriti e scrive UN messaggio: una richiesta, un collegamento per
// pro. Prima ogni scheda aveva il suo «Invia messaggio», che apriva una
// richiesta NUOVA con un pro solo: il 17/10 in produzione quattro richieste in
// dieci secondi per la stessa perdita, una per pro. Cosi' il tetto della 125
// non scattava mai, e il confronto e «Scegli» nella pagina della richiesta non
// avevano niente da confrontare.
//
// SE IL CLIENTE TORNA NELLA STESSA CONVERSAZIONE dopo aver scritto, i pro gia'
// contattati restano segnati («Contattato», non si spuntano) e le scelte nuove
// si AGGIUNGONO alla stessa richiesta: il tetto conta anche loro. Qui le regole,
// senza React, cosi' si provano da sole.

import { MAX_PRO_PER_RICHIESTA } from "@/lib/collegamento";

export type StatoScheda = "contattato" | "selezionato" | "libero" | "bloccato";

/** Che cosa mostra la casella di un pro. */
export function statoScheda(
  id: string,
  selezionati: ReadonlySet<string>,
  contattati: ReadonlySet<string>,
  max: number = MAX_PRO_PER_RICHIESTA
): StatoScheda {
  if (contattati.has(id)) return "contattato";
  if (selezionati.has(id)) return "selezionato";
  return selezionati.size + contattati.size >= max ? "bloccato" : "libero";
}

/** Spunta o toglie: oltre il tetto (contattati compresi) non aggiunge niente. */
export function cambiaSelezione(
  id: string,
  selezionati: ReadonlySet<string>,
  contattati: ReadonlySet<string>,
  max: number = MAX_PRO_PER_RICHIESTA
): Set<string> {
  const n = new Set(selezionati);
  if (contattati.has(id)) return n;
  if (n.has(id)) n.delete(id);
  else if (n.size + contattati.size < max) n.add(id);
  return n;
}

/** Il tetto e' pieno: le altre caselle si spengono e lo si dice. */
export function selezionePiena(
  selezionati: ReadonlySet<string>,
  contattati: ReadonlySet<string>,
  max: number = MAX_PRO_PER_RICHIESTA
): boolean {
  return selezionati.size + contattati.size >= max;
}

/** «Scrivi a 1 professionista», «Scrivi a 3 professionisti». */
export function etichettaScrivi(n: number): string {
  return `Scrivi a ${n} ${n === 1 ? "professionista" : "professionisti"}`;
}

/** «Rossi», «Rossi e Bianchi», «Rossi, Bianchi e Verdi». */
export function elencoNomi(nomi: string[]): string {
  if (nomi.length <= 1) return nomi[0] ?? "";
  return `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1]}`;
}

/**
 * Una richiesta a cui si possono ancora aggiungere pro dalla stessa chat. Una
 * chiusa (lavoro concluso, archiviata, disdetta) no: li' la chat ne apre una
 * nuova, che e' l'opzione sicura — non si riapre per la porta di servizio una
 * richiesta che il cliente ha chiuso.
 */
export function richiestaAncoraAperta(stato: string | null | undefined): boolean {
  return stato === "sent" || stato === "quote_request" || stato === "matched";
}
