// Fino a quando una prenotazione diretta si disdice, in un posto solo.
//
// Due lettori: la route /api/appointments/[id]/disdici, che DECIDE, e le
// pagine, che lo SCRIVONO al cliente. Se la regola stesse in due posti, il
// bottone e il server potrebbero non essere d'accordo sull'ultimo minuto —
// e un bottone che dice «puoi» quando il server dice «no» e' peggio di nessun
// bottone. Il limite vero resta il server: questo file e' solo il conto.
//
// «Fino a 24 ore prima» vuol dire che alle 10:00 di domani si disdice fino
// alle 10:00 di oggi compreso, e dalle 10:00:01 non piu'.

export interface PrenotazioneDisdicibile {
  starts_at: string;
  status: string;
  source?: string | null;
  cancellation_window_hours?: number | null;
}

/** L'ultimo istante in cui si puo' disdire; null se non si disdice da qui. */
export function disdicibileFinoA(a: PrenotazioneDisdicibile): Date | null {
  if (a.source !== "direct" || a.cancellation_window_hours == null) return null;
  const inizio = new Date(a.starts_at).getTime();
  if (isNaN(inizio)) return null;
  return new Date(inizio - a.cancellation_window_hours * 3600 * 1000);
}

export type StatoDisdetta =
  | { tipo: "si"; finoA: Date }
  | { tipo: "scaduta"; finoA: Date }
  | { tipo: "no" };

export function statoDisdetta(
  a: PrenotazioneDisdicibile,
  adesso: Date = new Date()
): StatoDisdetta {
  if (a.status !== "confirmed") return { tipo: "no" };
  const finoA = disdicibileFinoA(a);
  if (!finoA) return { tipo: "no" };
  return adesso.getTime() <= finoA.getTime()
    ? { tipo: "si", finoA }
    : { tipo: "scaduta", finoA };
}
