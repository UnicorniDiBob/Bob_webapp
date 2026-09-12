// I tre piani, in un posto solo.
//
// PERCHE' QUI E NON NELLA PAGINA
// L'elenco viveva dentro /onboarding/piano. Da quando esiste anche
// /impostazioni/piano, che deve dire a un professionista cosa ha comprato, due
// copie della stessa lista sono due liste che divergono: la prima volta che si
// aggiunge una funzione al piano intermedio, una delle due resta indietro e il
// pro legge due verita' diverse sullo stesso abbonamento.
//
// I PREZZI SONO NUMERI (30/08). Erano stringhe — "€24", "al mese — €19 con
// fatturazione annuale" — e andavano bene finche' nessuno doveva farci un
// conto. Da quando un codice sconto agisce sul prezzo (migrazione 064) il
// conto serve, e serve anche al SERVER: e' il server a decidere se un piano
// scelto costa zero, e non puo' deciderlo interpretando una stringa scritta
// per essere letta. Le stringhe adesso si generano da qui.
//
// LA MATRICE (12/09). Il listino non e' piu' tre elenchi puntati scritti a
// mano ma UNA tabella: ogni funzione e' una riga e dice, per ciascun piano,
// se c'e', se non c'e' o se e' in arrivo. Tre elenchi separati permettono a
// una funzione di comparire in due piani e sparire dal terzo senza che nessuno
// se ne accorga; una riga sola, no. Gli elenchi puntati delle pagine adesso si
// GENERANO dalla matrice (vedi `puntiDi`), quindi non possono divergere.
//
// IL NOME "PRO" DIVENTA "PLUS" (12/09, decisione di Lucio). Cambia SOLO
// l'etichetta: l'id resta `pro` perche' e' un valore dell'enum
// `subscription_tier` nel database, scritto in migrazioni, righe e codici
// promozionali. Rinominare l'enum e' una migrazione a se', da fare quando si
// decide, non un effetto collaterale di un cambio di copy. C'e' anche un
// motivo buono per tenerli distinti: "Pro" e "Pro+" erano anche i nomi dei
// LIVELLI DI VERIFICA, che non sono piani. Dal 12/09 quel doppione non c'e'
// piu' da nessuna delle due parti: il badge dice «Verificato» e basta
// (src/lib/vat.ts), il piano si chiama Plus.
//
// ONESTA' DEL LISTINO (23.1): una funzione che oggi non esiste non si segna
// come inclusa. Ha la sua casella, `ARRIVO`, che in tabella si vede ed e'
// diversa da una spunta — e non entra negli elenchi puntati, che dicono cosa
// hai comprato oggi.

import type { SubscriptionTier } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// La matrice delle funzioni
// ---------------------------------------------------------------------------

/** Cosa c'e' scritto nella casella di un piano, per una funzione. */
export type Cella =
  | { tipo: "si" }
  | { tipo: "no" }
  | { tipo: "arrivo" }
  | { tipo: "testo"; testo: string };

export const SI: Cella = { tipo: "si" };
export const NO: Cella = { tipo: "no" };
export const ARRIVO: Cella = { tipo: "arrivo" };
export const testo = (t: string): Cella => ({ tipo: "testo", testo: t });

/** La casella dice "questa funzione ce l'hai, oggi". */
export function inclusa(c: Cella): boolean {
  return c.tipo === "si" || c.tipo === "testo";
}

export interface Funzione {
  /** Titolo della fascia in cui la riga compare nella tabella. */
  gruppo: string;
  nome: string;
  /** Una riga di spiegazione, quando il nome da solo non basta. */
  nota?: string;
  /**
   * Vale per tutti i piani allo stesso modo: sta in tabella ma NON negli
   * elenchi puntati, dove non distinguerebbe niente (la fee, per esempio).
   */
  fuoriElenco?: boolean;
  celle: Record<SubscriptionTier, Cella>;
}

export const GRUPPI = [
  "Profilo e clienti",
  "Strumenti di lavoro",
  "Numeri e amministrazione",
  "Costi",
] as const;

export const FUNZIONI: Funzione[] = [
  // --- Profilo e clienti ---
  {
    gruppo: "Profilo e clienti",
    nome: "Profilo pubblico con le tue tariffe",
    celle: { free: SI, pro: SI, business: SI },
  },
  {
    gruppo: "Profilo e clienti",
    nome: "Messaggi con i clienti",
    nota: "Senza intermediari e senza tetto mensile: su nessun piano si paga per un contatto.",
    celle: { free: SI, pro: SI, business: SI },
  },
  {
    gruppo: "Profilo e clienti",
    nome: "Richieste ricevute",
    celle: {
      free: testo("Senza tetto"),
      pro: testo("Senza tetto"),
      business: testo("Senza tetto"),
    },
  },
  {
    gruppo: "Profilo e clienti",
    nome: "Verifica della partita IVA e badge sul profilo",
    celle: { free: NO, pro: SI, business: SI },
  },
  {
    gruppo: "Profilo e clienti",
    nome: "Verifica con documenti",
    nota: "Esame documentale fatto da una persona, sopra al riscontro sulla partita IVA.",
    celle: { free: NO, pro: SI, business: SI },
  },
  {
    gruppo: "Profilo e clienti",
    nome: "Risalto nei risultati di ricerca",
    celle: { free: NO, pro: SI, business: SI },
  },
  {
    gruppo: "Profilo e clienti",
    nome: "Recensioni dei clienti sul profilo",
    celle: { free: NO, pro: SI, business: SI },
  },
  {
    gruppo: "Profilo e clienti",
    nome: "Foto dei lavori nel portfolio",
    celle: { free: NO, pro: testo("1 foto"), business: testo("Illimitate") },
  },

  // --- Strumenti di lavoro ---
  {
    gruppo: "Strumenti di lavoro",
    nome: "Calendario e appuntamenti",
    celle: { free: NO, pro: SI, business: SI },
  },
  {
    gruppo: "Strumenti di lavoro",
    nome: "Preventivi digitali",
    celle: { free: NO, pro: SI, business: SI },
  },
  {
    gruppo: "Strumenti di lavoro",
    nome: "Prenotazione diretta sui lavori a tariffa fissa",
    celle: { free: NO, pro: SI, business: SI },
  },
  {
    gruppo: "Strumenti di lavoro",
    nome: "Chiamata al cliente dentro l'app",
    nota: "Senza chiamata in app il numero di telefono ve lo scambiate voi: sul Free resta cosi'.",
    celle: { free: NO, pro: ARRIVO, business: ARRIVO },
  },
  {
    gruppo: "Strumenti di lavoro",
    nome: "Assistente che risponde ai messaggi",
    nota: "Prepara la risposta al cliente, la mandi tu. Etichettato come generato da AI.",
    celle: { free: NO, pro: ARRIVO, business: ARRIVO },
  },

  // --- Numeri e amministrazione ---
  {
    gruppo: "Numeri e amministrazione",
    nome: "Analisi base",
    nota: "Da dove arriva il tuo lavoro: quanti contatti, quanti preventivi, quanti chiusi.",
    celle: { free: ARRIVO, pro: ARRIVO, business: ARRIVO },
  },
  {
    gruppo: "Numeri e amministrazione",
    nome: "Analisi avanzate",
    nota: "Da dove arrivano i tuoi ricavi: per servizio, per zona, per periodo.",
    celle: { free: NO, pro: ARRIVO, business: ARRIVO },
  },
  {
    gruppo: "Numeri e amministrazione",
    nome: "Fatturazione elettronica integrata",
    celle: { free: NO, pro: NO, business: ARRIVO },
  },
  {
    gruppo: "Numeri e amministrazione",
    nome: "Pagamenti incassati su BOB",
    celle: { free: NO, pro: NO, business: ARRIVO },
  },
  {
    gruppo: "Numeri e amministrazione",
    nome: "Supporto prioritario",
    celle: { free: NO, pro: NO, business: ARRIVO },
  },

  // --- Costi ---
  {
    gruppo: "Costi",
    nome: "Costo per contatto",
    nota: "Non vendiamo lead. Non e' una funzione del piano: non si paga e basta.",
    fuoriElenco: true,
    celle: {
      free: testo("Nessuno"),
      pro: testo("Nessuno"),
      business: testo("Nessuno"),
    },
  },
  {
    gruppo: "Costi",
    nome: "Fee sul lavoro concluso",
    nota: "Uguale sui tre piani. Si applica ai lavori con la Garanzia Bob, che attivi tu.",
    fuoriElenco: true,
    celle: { free: testo("8%"), pro: testo("8%"), business: testo("8%") },
  },
];

// ---------------------------------------------------------------------------
// I piani
// ---------------------------------------------------------------------------

export interface Piano {
  id: SubscriptionTier;
  nome: string;
  /** Listino al mese, in euro, con fatturazione mensile. */
  prezzoMensile: number;
  /** Listino al mese, in euro, con fatturazione annuale. null = non c'e'. */
  prezzoAnnuale: number | null;
  /** Una riga: a chi serve questo piano. */
  sintesi: string;
  /** Cosa aggiunge rispetto al piano precedente. Generato dalla matrice. */
  punti: string[];
}

/** Dal piu' piccolo al piu' grande: e' anche l'ordine delle colonne. */
export const ORDINE: SubscriptionTier[] = ["free", "pro", "business"];

/** Come si scrive una casella dentro un elenco puntato. */
function vocePuntata(f: Funzione, c: Cella): string {
  return c.tipo === "testo" ? `${f.nome}: ${c.testo}` : f.nome;
}

/**
 * Le funzioni che quel piano AGGIUNGE rispetto al precedente. Le caselle
 * "in arrivo" non entrano: un elenco puntato dice cosa hai comprato, e quello
 * che non esiste ancora non l'hai comprato.
 */
function puntiDi(id: SubscriptionTier): string[] {
  const i = ORDINE.indexOf(id);
  const prima = i > 0 ? ORDINE[i - 1] : null;

  return FUNZIONI.filter((f) => !f.fuoriElenco)
    .filter((f) => {
      const mia = f.celle[id];
      if (!inclusa(mia)) return false;
      if (!prima) return true;
      const sua = f.celle[prima];
      if (!inclusa(sua)) return true;
      // Tutti e due ce l'hanno, ma non nella stessa misura (1 foto /
      // illimitate): e' proprio quella la differenza da mostrare.
      return (
        mia.tipo === "testo" && sua.tipo === "testo" && mia.testo !== sua.testo
      );
    })
    .map((f) => vocePuntata(f, f.celle[id]));
}

export const PIANI: Piano[] = [
  {
    id: "free",
    nome: "Free",
    prezzoMensile: 0,
    prezzoAnnuale: null,
    sintesi: "Esserci, ricevere richieste e parlare con i clienti.",
    punti: puntiDi("free"),
  },
  {
    id: "pro",
    nome: "Bob Plus",
    prezzoMensile: 24,
    prezzoAnnuale: 19,
    sintesi: "Farti trovare, farti riconoscere e lavorare con gli strumenti.",
    punti: ["Tutto di Free", ...puntiDi("pro")],
  },
  {
    id: "business",
    nome: "Bob Business",
    prezzoMensile: 59,
    prezzoAnnuale: 49,
    sintesi: "Tutto di Bob Plus, piu' l'amministrazione e i numeri.",
    punti: ["Tutto di Bob Plus", ...puntiDi("business")],
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
