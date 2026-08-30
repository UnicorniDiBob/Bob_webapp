// I tre piani, in un posto solo.
//
// PERCHE' QUI E NON NELLA PAGINA
// L'elenco viveva dentro /onboarding/piano. Da quando esiste anche
// /impostazioni/piano, che deve dire a un professionista cosa ha comprato, due
// copie della stessa lista sono due liste che divergono: la prima volta che si
// aggiunge una funzione a Bob Pro, una delle due resta indietro e il pro legge
// due verita' diverse sullo stesso abbonamento.
//
// I PREZZI SONO NUMERI (30/08). Erano stringhe — "€24", "al mese — €19 con
// fatturazione annuale" — e andavano bene finche' nessuno doveva farci un
// conto. Da quando un codice sconto agisce sul prezzo (migrazione 064) il
// conto serve, e serve anche al SERVER: e' il server a decidere se un piano
// scelto costa zero, e non puo' deciderlo interpretando una stringa scritta
// per essere letta. Le stringhe adesso si generano da qui.
//
// ONESTA' DEL LISTINO (23.1): qui si elencano SOLO funzioni che esistono nel
// prodotto oggi. Il listino commerciale completo sta su /per-i-professionisti
// e va riallineato prima di Stripe (12.4, P4.7): quello promette la Garanzia
// Bob e una fee che non esistono ancora, questo no.

import type { SubscriptionTier } from "@/lib/supabase/types";

export interface Piano {
  id: SubscriptionTier;
  nome: string;
  /** Listino al mese, in euro, con fatturazione mensile. */
  prezzoMensile: number;
  /** Listino al mese, in euro, con fatturazione annuale. null = non c'e'. */
  prezzoAnnuale: number | null;
  punti: string[];
}

export const PIANI: Piano[] = [
  {
    id: "free",
    nome: "Free",
    prezzoMensile: 0,
    prezzoAnnuale: null,
    punti: [
      "Profilo pubblico su BOB",
      "Ricevi richieste e messaggi dai clienti",
      "Calendario e appuntamenti",
    ],
  },
  {
    id: "pro",
    nome: "Bob Pro",
    prezzoMensile: 24,
    prezzoAnnuale: 19,
    punti: [
      "Tutto di Free",
      "Verifica della partita IVA e badge sul profilo",
      "Caricamento documenti per il livello Pro+",
      "1 foto portfolio sul profilo",
      "Prenotazione diretta sui lavori a tariffa fissa",
    ],
  },
  {
    id: "business",
    nome: "Bob Business",
    prezzoMensile: 59,
    prezzoAnnuale: 49,
    punti: ["Tutto di Bob Pro", "Foto portfolio illimitate"],
  },
];

export function pianoById(id: SubscriptionTier): Piano {
  return PIANI.find((p) => p.id === id) ?? PIANI[0];
}

// ---------------------------------------------------------------------------
// Gli sconti
// ---------------------------------------------------------------------------

/** Percentuale di sconto per ciascun piano, 0-100. */
export type ScontiPerPiano = Record<SubscriptionTier, number>;

export const NESSUNO_SCONTO: ScontiPerPiano = { free: 0, pro: 0, business: 0 };

/**
 * Prezzo scontato, arrotondato al centesimo. Lo sconto e' una percentuale
 * intera: 100 significa gratis, e "gratis" deve venire fuori esattamente zero
 * (non 0.004), perche' e' su questo numero che il server decide.
 */
export function prezzoScontato(base: number, pct: number): number {
  const p = Math.min(100, Math.max(0, pct));
  return Math.round(base * (100 - p)) / 100;
}

/** Il piano, con gli sconti riscattati, non costa niente. */
export function costaZero(piano: Piano, sconti: ScontiPerPiano): boolean {
  return prezzoScontato(piano.prezzoMensile, sconti[piano.id] ?? 0) === 0;
}

/** "€0", "€24", "€16,80" — mai "€24.00". */
export function euro(n: number): string {
  return n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export interface EtichettaPrezzo {
  /** Quanto paga davvero, gia' scontato. */
  attuale: string;
  /** Il listino barrato, se lo sconto lo ha cambiato. */
  listino: string | null;
  /** La riga piccola sotto al prezzo. */
  nota: string | null;
}

/**
 * Come si scrive il prezzo di un piano, con o senza sconto. Una funzione
 * sola: il prezzo compare in tre pagine e non deve essere scritto tre volte.
 */
export function etichettaPrezzo(
  piano: Piano,
  sconti: ScontiPerPiano = NESSUNO_SCONTO
): EtichettaPrezzo {
  const pct = sconti[piano.id] ?? 0;
  const scontato = prezzoScontato(piano.prezzoMensile, pct);

  if (piano.prezzoMensile === 0) {
    return { attuale: euro(0), listino: null, nota: "per sempre" };
  }
  if (pct >= 100) {
    return {
      attuale: euro(0),
      listino: euro(piano.prezzoMensile),
      nota: "gratis con il tuo codice",
    };
  }
  if (pct > 0) {
    return {
      attuale: euro(scontato),
      listino: euro(piano.prezzoMensile),
      nota: `al mese — sconto del ${pct}% con il tuo codice`,
    };
  }
  return {
    attuale: euro(piano.prezzoMensile),
    listino: null,
    nota: piano.prezzoAnnuale
      ? `al mese — ${euro(piano.prezzoAnnuale)} con fatturazione annuale`
      : "al mese",
  };
}
