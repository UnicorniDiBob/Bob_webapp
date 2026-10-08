// LE NUOVE PRENOTAZIONI SULLA DASHBOARD DEL PRO (08/10, André).
//
// Una prenotazione diretta (instant-book) arriva gia' confermata: non passa
// da «Nuove richieste», che legge solo le richieste da guardare, e in
// «Prossimi appuntamenti» sembra un appuntamento come gli altri. La
// campanella la dice (113), ma su 390px la campanella sta nel menu. Qui la
// dashboard la mette in cima, finche' il pro non la apre.
//
// COME SI RICONOSCE: appointments.source = 'direct'. Lo scrive solo
// /api/pro/instant-book (il default della colonna e' 'pro'), ed e' la stessa
// condizione con cui registra_evento_appuntamento scrive il «prenotato» che
// legge la campanella: status 'confirmed' e source 'direct' all'INSERT.
//
// QUANDO SPARISCE: quando il pro la apre («Apri la chat» o «Vedi nel
// calendario»), quando l'orario e' passato, o quando non e' piu' confermata
// (disdetta, rifiutata, o spostata e quindi di nuovo da confermare: quella la
// mostra gia' «Orari proposti dai clienti»).
//
// «APERTA» STA NEL BROWSER, come il «letto» della campanella
// (lib/notifiche.ts): una preferenza d'interfaccia, per account e per
// dispositivo, che non entra in nessun registro dei trattamenti.

import type { Appointment } from "@/lib/supabase/types";
import { chiaveUtente } from "@/lib/sessioni/chiavi";

export const CHIAVE_PRENOTAZIONI_APERTE = "bob.prenotazioni.aperte.v1";

/** Quante se ne vedono prima di «Vedi tutte»: su 390px «Nuove richieste» resta vicino. */
export const PRENOTAZIONI_IN_VISTA = 2;

type Candidata = Pick<Appointment, "id" | "status" | "starts_at" | "source">;

/** Una prenotazione diretta confermata e ancora da venire, aperta o no. Puro. */
export function eCandidata(a: Candidata, ora: Date = new Date()): boolean {
  return (
    a.source === "direct" &&
    a.status === "confirmed" &&
    Date.parse(a.starts_at) > ora.getTime()
  );
}

/**
 * Le prenotazioni da mostrare: candidate e non ancora aperte, la piu' vicina
 * per prima (e' quella che il pro non puo' perdersi). Puro.
 */
export function nuovePrenotazioni<T extends Candidata>(
  appuntamenti: T[],
  aperte: ReadonlySet<string>,
  ora: Date = new Date()
): T[] {
  return appuntamenti
    .filter((a) => eCandidata(a, ora) && !aperte.has(a.id))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

/** Le prime in vista e le altre dietro «Vedi tutte». Puro. */
export function dividiInVista<T>(
  lista: T[],
  espanso: boolean
): { visibili: T[]; nascoste: number } {
  if (espanso || lista.length <= PRENOTAZIONI_IN_VISTA) {
    return { visibili: lista, nascoste: 0 };
  }
  return {
    visibili: lista.slice(0, PRENOTAZIONI_IN_VISTA),
    nascoste: lista.length - PRENOTAZIONI_IN_VISTA,
  };
}

/**
 * L'elenco da salvare dopo aver aperto `id`: tiene solo gli id ancora
 * candidati, cosi' non cresce per sempre. Puro.
 */
export function aperteDaSalvare(
  salvate: ReadonlySet<string>,
  id: string,
  candidate: string[]
): string[] {
  const vive = new Set(candidate);
  const out = Array.from(salvate).filter((x) => vive.has(x));
  if (!out.includes(id)) out.push(id);
  return out;
}

/** Legge un elenco salvato; qualunque cosa non sia un array di stringhe vale vuoto. Puro. */
export function leggiElenco(testo: string | null): Set<string> {
  if (!testo) return new Set();
  try {
    const v: unknown = JSON.parse(testo);
    return new Set(
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
    );
  } catch {
    return new Set();
  }
}

/** Le prenotazioni gia' aperte in questo browser. Mai un errore: senza memoria, vuoto. */
export function leggiAperte(): Set<string> {
  try {
    return leggiElenco(
      window.localStorage.getItem(chiaveUtente(CHIAVE_PRENOTAZIONI_APERTE))
    );
  } catch {
    return new Set();
  }
}

/**
 * Segna `id` come aperta e restituisce l'elenco nuovo. Senza memoria la
 * scheda sparisce solo fino al prossimo caricamento: fastidioso, non rotto.
 */
export function segnaAperta(id: string, candidate: string[]): Set<string> {
  const nuove = aperteDaSalvare(leggiAperte(), id, candidate);
  try {
    window.localStorage.setItem(
      chiaveUtente(CHIAVE_PRENOTAZIONI_APERTE),
      JSON.stringify(nuove)
    );
  } catch {
    // storage negato
  }
  return new Set(nuove);
}
