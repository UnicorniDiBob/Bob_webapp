// IL RITARDO DEL PRO (116, Lucio 07/10), il conto in un posto solo.
//
// Due lettori, come per la disdetta: la funzione segnala_ritardo() nel
// database, che DECIDE, e le pagine, che scelgono se mostrare «Sono in
// ritardo». Qui c'e' solo il conto per il bottone; il limite vero e' il
// server, con la sua ora.
//
// LA REGOLA. Un ritardo non e' uno spostamento: l'appuntamento resta
// confermato e il cliente non deve approvare. Si dichiara solo su un
// appuntamento confermato con un cliente, della giornata in corso (ora di
// Roma) e non ancora finito. Il preavviso non conta: un ritardo e' per
// definizione dentro.

/** Le scelte rapide; c'e' anche un campo libero. */
export const MINUTI_RITARDO = [10, 15, 20, 30, 45, 60] as const;

/** Oltre e' uno spostamento, non un ritardo (stesso limite del database). */
export const MAX_RITARDO = 240;

const TZ = "Europe/Rome";

function giornoRoma(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export interface AppuntamentoInRitardo {
  starts_at: string;
  duration_minutes: number;
  status: string;
  request_id?: string | null;
}

/** Vero se su questo appuntamento si puo' dichiarare un ritardo adesso. */
export function ritardoPossibile(
  a: AppuntamentoInRitardo,
  adesso: Date = new Date()
): boolean {
  if (a.status !== "confirmed" || !a.request_id) return false;
  const inizio = new Date(a.starts_at);
  if (isNaN(inizio.getTime())) return false;
  const fine = inizio.getTime() + a.duration_minutes * 60000;
  if (fine <= adesso.getTime()) return false;
  return giornoRoma(inizio) === giornoRoma(adesso);
}

/** Un ritardo scritto a mano e' valido? Intero da 1 a MAX_RITARDO. */
export function minutiValidi(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_RITARDO;
}

/** «10:35», ora di Roma. */
export function oraRoma(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("it-IT", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}
