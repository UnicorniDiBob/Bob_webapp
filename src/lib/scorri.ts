// SCORRERE LE CONVERSAZIONI, COME SU WHATSAPP: LE REGOLE, SENZA REACT (15/10).
//
// In /messaggi una riga si scorre: a destra «Da leggere» / «Letto» (cliente e
// pro), a sinistra «Archivia» (solo il cliente, nella scheda «Attive»). Qui ci
// sono le tre decisioni che conviene poter provare da sole: quando un gesto e'
// orizzontale (e quindi nostro) e quando e' lo scorrimento della lista; quale
// azione scatta quando il dito si stacca; e la coda di «Archivia», che aspetta
// 5 secondi prima di mandare (vedi CodaArchivia).

/** Sotto questi pixel non si decide niente: un tocco trema. */
export const SOGLIA_BLOCCO = 10;
/** I gesti che partono qui vicino al bordo sinistro sono di Safari (indietro). */
export const BORDO_SINISTRO = 24;
/** Quanto della riga va percorso perche' l'azione scatti. */
export const FRAZIONE_AZIONE = 0.35;
/** Un colpo veloce basta anche se corto: px al ms, e almeno questi px. */
export const VELOCITA_COLPO = 0.5;
export const MINIMO_COLPO = 40;

export type Direzione = "orizzontale" | "verticale" | null;

/**
 * Di chi e' il gesto. null finche' il dito non si e' mosso di SOGLIA_BLOCCO;
 * poi orizzontale solo se lo spostamento orizzontale domina chiaramente
 * (almeno una volta e mezza quello verticale): nel dubbio vince lo
 * scorrimento della lista, che non deve mai incepparsi.
 */
export function bloccoDirezione(dx: number, dy: number): Direzione {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < SOGLIA_BLOCCO && ay < SOGLIA_BLOCCO) return null;
  return ax > ay * 1.5 ? "orizzontale" : "verticale";
}

/** Un gesto che comincia sul bordo sinistro e' il «torna indietro» di iOS. */
export function partenzaIgnorata(inizioX: number): boolean {
  return inizioX < BORDO_SINISTRO;
}

export type Azione = "destra" | "sinistra" | null;

/**
 * Cosa scatta quando il dito si stacca: oltre il 35% della riga, oppure un
 * colpo veloce nella stessa direzione. Solo le direzioni permesse.
 */
export function azioneAlRilascio(g: {
  dx: number;
  larghezza: number;
  durataMs: number;
  destra: boolean;
  sinistra: boolean;
}): Azione {
  const verso: Azione = g.dx > 0 ? "destra" : g.dx < 0 ? "sinistra" : null;
  if (!verso) return null;
  if (verso === "destra" && !g.destra) return null;
  if (verso === "sinistra" && !g.sinistra) return null;
  const ax = Math.abs(g.dx);
  const oltre = ax >= g.larghezza * FRAZIONE_AZIONE;
  const colpo = ax >= MINIMO_COLPO && ax / Math.max(g.durataMs, 1) >= VELOCITA_COLPO;
  return oltre || colpo ? verso : null;
}

/** Dove sta la riga mentre il dito la porta: solo nelle direzioni permesse. */
export function spostamentoVisibile(dx: number, destra: boolean, sinistra: boolean): number {
  if (dx > 0 && !destra) return 0;
  if (dx < 0 && !sinistra) return 0;
  return dx;
}

// ---------------------------------------------------------------------------
// «Archivia» con 5 secondi per ripensarci
// ---------------------------------------------------------------------------
//
// PERCHE' ASPETTA (15/10, André). Archiviare dice al pro «Il cliente ha chiuso
// questa richiesta.» e gli chiude la chat: non si puo' disfare in silenzio.
// Cosi' la riga esce subito, compare «Annulla» per 5 secondi, e la richiesta
// parte solo quando la barra si chiude. «Annulla» vuol dire che non e' partito
// niente. Mai perso e mai doppio: un secondo «Archivia» manda subito il primo;
// uscire dalla pagina lo manda (fetch keepalive); chiudere la scheda lo manda
// con sendBeacon. Un invio parte una volta sola, qualunque strada lo mandi.

export const ATTESA_ARCHIVIA_MS = 5000;

export interface DaArchiviare {
  chiave: string;
  requestId: string;
  professionalId: string;
}

export class CodaArchivia {
  private corrente: DaArchiviare | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly invia: (d: DaArchiviare, modo: "normale" | "beacon") => void,
    private readonly cambiata: (inAttesa: DaArchiviare | null) => void,
    private readonly attesaMs: number = ATTESA_ARCHIVIA_MS,
    private readonly orologio: {
      set: (f: () => void, ms: number) => ReturnType<typeof setTimeout>;
      clear: (t: ReturnType<typeof setTimeout>) => void;
    } = { set: (f, ms) => setTimeout(f, ms), clear: (t) => clearTimeout(t) }
  ) {}

  get inAttesa(): DaArchiviare | null {
    return this.corrente;
  }

  /** Un «Archivia» nuovo: se ce n'era uno in attesa, parte subito. */
  aggiungi(d: DaArchiviare): void {
    if (this.corrente) this.manda("normale");
    this.corrente = d;
    this.timer = this.orologio.set(() => this.manda("normale"), this.attesaMs);
    this.cambiata(this.corrente);
  }

  /** «Annulla»: non parte niente. */
  annulla(): DaArchiviare | null {
    const d = this.corrente;
    this.ferma();
    this.corrente = null;
    this.cambiata(null);
    return d;
  }

  /** Uscire dalla pagina (normale) o chiudere la scheda (beacon): parte adesso. */
  svuota(modo: "normale" | "beacon"): void {
    if (this.corrente) this.manda(modo);
  }

  private manda(modo: "normale" | "beacon"): void {
    const d = this.corrente;
    if (!d) return;
    this.ferma();
    this.corrente = null;
    this.cambiata(null);
    this.invia(d, modo);
  }

  private ferma(): void {
    if (this.timer) this.orologio.clear(this.timer);
    this.timer = null;
  }
}

// ---------------------------------------------------------------------------
// Il pallino: i non letti, con i segni «da leggere»
// ---------------------------------------------------------------------------

/**
 * Quanto conta il pallino dei messaggi. Ogni conversazione conta i suoi
 * messaggi non letti; una segnata «da leggere» conta almeno 1, anche se i
 * messaggi li ha gia' letti tutti (e non 1 in piu' se ne ha).
 */
export function contaNonLetti(conversazioni: { nonLetti: number; daLeggere: boolean }[]): number {
  return conversazioni.reduce((n, c) => n + Math.max(c.nonLetti, c.daLeggere ? 1 : 0), 0);
}

// ---------------------------------------------------------------------------
// Chi puo' scorrere cosa (16/10)
// ---------------------------------------------------------------------------
//
// A destra sempre «Da leggere» / «Letto», per cliente e pro, anche nella
// scheda «Archiviate» del cliente. A sinistra solo il cliente: nella scheda
// «Attive» archivia (con «Annulla», perche' avvisa il pro), in «Archiviate»
// RIAPRE, subito e senza barra: riaprire non avvisa nessuno (123) e si
// disfa archiviando di nuovo. Il pro non ha la sinistra: archiviare e'
// una decisione del cliente (Lucio 14/10).

export type AzioneSinistra = "archivia" | "riapri";

export interface AzioniRiga {
  destra: { etichetta: "Da leggere" | "Letto" };
  sinistra: { tipo: AzioneSinistra; etichetta: "Archivia" | "Riapri"; conAnnulla: boolean } | null;
}

export function azioniRiga(r: {
  ruolo: "customer" | "professional";
  archiviata: boolean;
  /** Richiesta chiusa: niente da archiviare. */
  chiusa: boolean;
  daLeggere: boolean;
}): AzioniRiga {
  const destra = { etichetta: r.daLeggere ? ("Letto" as const) : ("Da leggere" as const) };
  if (r.ruolo !== "customer") return { destra, sinistra: null };
  if (r.archiviata) {
    return { destra, sinistra: { tipo: "riapri", etichetta: "Riapri", conAnnulla: false } };
  }
  if (r.chiusa) return { destra, sinistra: null };
  return { destra, sinistra: { tipo: "archivia", etichetta: "Archivia", conAnnulla: true } };
}

/**
 * Il pallino della bolla, per ruolo. Il segno «da leggere» conta anche su
 * una conversazione archiviata del cliente (dal 16/10 la puo' segnare li');
 * per il pro le archiviate non contano mai (PR 8).
 */
export function pallino(
  ruolo: "customer" | "professional",
  conversazioni: { nonLetti: number; daLeggere: boolean; archiviata: boolean }[]
): number {
  return contaNonLetti(
    conversazioni.map((c) => ({
      nonLetti: c.nonLetti,
      daLeggere: c.daLeggere && !(ruolo === "professional" && c.archiviata),
    }))
  );
}
