// LA CHAT E LA TASTIERA: I CONTI, SENZA REACT (15/10).
//
// Tre decisioni di /messaggi che conviene poter provare da sole: quanto e'
// alta la cornice con la tastiera dell'iPhone aperta, quanto e' alto il
// campo che cresce, e cosa fa il tasto Invio.

/**
 * L'altezza della cornice con la tastiera di iOS aperta: dal suo inizio
 * fino al fondo della parte visibile, TUTTO in coordinate del documento.
 *
 * Misurato sull'iPhone di André (15/10, ?diagnosi=tastiera), tastiera
 * aperta: visualViewport.height 344, offsetTop 291, pageTop 391, scrollY 391;
 * la cornice comincia a y 81 del documento (rect.top −310 + scrollY 391). La
 * parte visibile finisce a pageTop + height = 735, quindi la cornice va alta
 * 654. La formula della #165 (offsetTop + height − alto = 554) usava
 * offsetTop, che su questa versione di iOS non concorda con scrollY e
 * pageTop: mancavano 100px, la fascia vuota sopra la tastiera.
 */
export function altezzaCornice(v: {
  pageTop: number;
  altezzaVisibile: number;
  /** Dove comincia la cornice, in coordinate del documento. */
  inizioCornice: number;
}): number {
  return Math.max(0, Math.round(v.pageTop + v.altezzaVisibile - v.inizioCornice));
}

/**
 * Di quanto correggere, misurata la cornice disposta: la differenza fra il
 * fondo visibile e il fondo della cornice, in coordinate del documento. Sotto
 * i 2px non si tocca niente (arrotondamenti).
 */
export function correzioneCornice(v: {
  pageTop: number;
  altezzaVisibile: number;
  /** Il fondo della cornice in coordinate del documento (rect.bottom + scrollY). */
  fondoCornice: number;
}): number {
  const d = Math.round(v.pageTop + v.altezzaVisibile - v.fondoCornice);
  return Math.abs(d) > 2 ? d : 0;
}

/** Fino a cinque righe di 24px, piu' 10+10 di margine interno e 1+1 di bordo. */
export const CAMPO_ALTEZZA_MASSIMA = 5 * 24 + 20 + 2;

/**
 * L'altezza del campo che cresce: quanto chiede il testo (scrollHeight, che
 * non conta il bordo), fino al massimo; oltre, il campo scorre dentro.
 */
export function altezzaCampo(
  scrollHeight: number,
  bordi: number,
  massima: number = CAMPO_ALTEZZA_MASSIMA
): { altezza: number; scorre: boolean } {
  const serve = scrollHeight + bordi;
  return { altezza: Math.min(serve, massima), scorre: serve > massima };
}

/**
 * Cosa fa un tasto nel campo del messaggio. Durante la composizione (gli
 * accenti, il dettato, le tastiere asiatiche) niente: Invio conferma la
 * parola, non il messaggio. Sul telefono Invio va a capo e si manda con il
 * bottone, come su WhatsApp; con mouse e tastiera Invio manda e
 * Maiuscolo+Invio va a capo.
 */
export function cosaFaIlTasto(t: {
  tasto: string;
  maiuscolo: boolean;
  componendo: boolean;
  tattile: boolean;
}): "invia" | "a-capo" | "niente" {
  if (t.tasto !== "Enter" || t.componendo) return "niente";
  if (t.tattile || t.maiuscolo) return "a-capo";
  return "invia";
}
