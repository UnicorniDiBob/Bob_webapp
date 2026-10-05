// Fino a quando un appuntamento con un cliente si annulla dal sito, in un
// posto solo.
//
// Due lettori: la funzione annulla_appuntamento nel database (113), che
// DECIDE, e le pagine, che lo SCRIVONO. Se la regola stesse in due posti, il
// bottone e il server potrebbero non essere d'accordo sull'ultimo minuto —
// e un bottone che dice «puoi» quando il server dice «no» e' peggio di nessun
// bottone. Il limite vero resta il server: questo file e' solo il conto.
//
// LA REGOLA (113, Lucio 05/10). Il preavviso e' un'impostazione del
// professionista (48 ore di base), fotografata sull'appuntamento alla
// conferma. Vale per entrambe le parti e per ogni appuntamento con un cliente,
// non solo per la prenotazione diretta. Fuori dal preavviso si annulla dal
// sito; dentro, si chiama.
//
// «Fino a 24 ore prima» vuol dire che alle 10:00 di domani si annulla fino
// alle 10:00 di oggi compreso, e dalle 10:00:01 si chiama.

/** Il preavviso di chi non l'ha cambiato: lo stesso default della colonna. */
export const PREAVVISO_BASE_ORE = 48;

export interface PrenotazioneDisdicibile {
  starts_at: string;
  status: string;
  request_id?: string | null;
  cancellation_window_hours?: number | null;
}

/**
 * L'ultimo istante in cui si annulla dal sito; null se l'appuntamento non ha
 * un cliente (e' agenda privata del pro: lo gestisce lui dal calendario).
 */
export function disdicibileFinoA(a: PrenotazioneDisdicibile): Date | null {
  if (!a.request_id) return null;
  const inizio = new Date(a.starts_at).getTime();
  if (isNaN(inizio)) return null;
  const ore = a.cancellation_window_hours ?? PREAVVISO_BASE_ORE;
  return new Date(inizio - ore * 3600 * 1000);
}

export type StatoDisdetta =
  /** Si annulla dal sito, fino a `finoA`. */
  | { tipo: "si"; finoA: Date }
  /** Dentro il preavviso: si chiama. */
  | { tipo: "scaduta"; finoA: Date }
  /** Non e' un appuntamento confermato e futuro con un cliente. */
  | { tipo: "no" };

export function statoDisdetta(
  a: PrenotazioneDisdicibile,
  adesso: Date = new Date()
): StatoDisdetta {
  if (a.status !== "confirmed") return { tipo: "no" };
  if (new Date(a.starts_at).getTime() <= adesso.getTime()) return { tipo: "no" };
  const finoA = disdicibileFinoA(a);
  if (!finoA) return { tipo: "no" };
  return adesso.getTime() <= finoA.getTime()
    ? { tipo: "si", finoA }
    : { tipo: "scaduta", finoA };
}

/** «48 ore», «1 ora»: come si scrive il preavviso a una persona. */
export function oreInParole(ore: number): string {
  return ore === 1 ? "1 ora" : `${ore} ore`;
}
