// «DA FARE ORA» DEL CLIENTE: COSA C'E', IN CHE ORDINE, QUANTO SI VEDE (15/10).
//
// E' il blocco piu' importante della dashboard: in cinque secondi il cliente
// deve vedere cosa aspetta lui. Fino al 14/10 le righe uscivano nell'ordine
// in cui il codice le costruiva, tagliate a quattro: tre recensioni allo
// stesso pro potevano spingere fuori la proposta d'orario di un altro pro,
// cioe' l'unica cosa con una scadenza. Qui l'ordine e' fisso e dice
// l'urgenza:
//   (a) proposta   — un pro propone un orario (anche spostandone uno gia'
//                    confermato) e l'orario e' ancora nel futuro;
//   (b) risposta   — un pro ha scritto e il cliente non ha letto;
//   (c) chiusura   — «E' andato tutto bene?» sulle richieste ferme da 10 giorni;
//   (d) recensioni — UNA riga per tutte le recensioni mancanti.
// (a) e (b) si vedono sempre, anche oltre le quattro righe: chi aspetta una
// risposta non deve finire sotto «+N altri». (c) e (d) riempiono il resto.
//
// Niente React qui: e' logica pura, e i test la provano senza la pagina.

/** Le righe che si vedono senza aprire «+N altri», se non ci sono urgenze in piu'. */
export const RIGHE_VISIBILI = 4;

const PRIORITA = ["proposta", "risposta", "chiusura", "recensioni"] as const;
export type TipoDaFare = (typeof PRIORITA)[number];

export interface AppuntamentoDaFare {
  id: string;
  status: string;
  proposed_by: "professional" | "customer";
  starts_at: string;
  duration_minutes?: number | null;
}

export interface RichiestaDaFare {
  id: string;
  status: string;
  closed_reason: string | null;
  created_at: string | null;
  pros: { id: string; name: string }[];
}

export type VoceDaFare<A extends AppuntamentoDaFare, R extends RichiestaDaFare> =
  | { tipo: "proposta"; chiave: string; appuntamento: A }
  | {
      tipo: "risposta";
      chiave: string;
      richiesta: R;
      pro: { id: string; name: string };
      messaggi: number;
    }
  | { tipo: "chiusura"; chiave: string; richiesta: R }
  /** Le richieste da recensire, la piu' recente per prima. */
  | { tipo: "recensioni"; chiave: string; richieste: R[] };

/** Una prenotazione disdetta non si recensisce: non e' un lavoro fatto (113). */
export function recensibile(r: { closed_reason: string | null }): boolean {
  return r.closed_reason !== "disdetto";
}

/**
 * Una richiesta chiusa con almeno un pro ancora da recensire: la stessa
 * regola per «Da fare ora» e per il «★ Da recensire» dello storico (15/10).
 */
export function daRecensire(
  r: { id: string; closed_reason: string | null; pros: { id: string }[] },
  recensite: Set<string>
): boolean {
  return recensibile(r) && r.pros.some((p) => !recensite.has(`${r.id}:${p.id}`));
}

// LA PROPOSTA DEL CLIENTE NON E' UNA COSA DA FARE (15/10). C'era la riga
// «Hai proposto un nuovo orario · In attesa ⏳»: non chiede niente al
// cliente, e lo stato sta gia' sulla riga dell'appuntamento («in attesa di
// <pro>», PR 1). E una proposta il cui orario e' passato non si conferma
// piu': mostrare «Conferma» li' invita a un tasto che non ha senso.
export function propostaDaRispondere(
  a: AppuntamentoDaFare,
  adesso: number = Date.now()
): boolean {
  return (
    a.status === "proposed" &&
    a.proposed_by === "professional" &&
    new Date(a.starts_at).getTime() > adesso
  );
}

/** Le cose da fare, gia' nell'ordine fisso; stabile dentro ogni gruppo. */
export function vociDaFare<A extends AppuntamentoDaFare, R extends RichiestaDaFare>(
  dati: {
    appuntamenti: A[];
    /** Richieste aperte (sent, quote_request, matched). */
    aperte: R[];
    chiuse: R[];
    /** Non letti per «richiesta:pro». */
    nonLettiPerCoppia: Map<string, number>;
    /** Non letti per richiesta. */
    nonLettiPerRichiesta: Map<string, number>;
    /** Recensioni gia' lasciate, «richiesta:pro». */
    recensite: Set<string>;
  },
  adesso: number = Date.now()
): VoceDaFare<A, R>[] {
  const voci: VoceDaFare<A, R>[] = [];

  for (const a of dati.appuntamenti) {
    if (propostaDaRispondere(a, adesso)) {
      voci.push({ tipo: "proposta", chiave: `appt-${a.id}`, appuntamento: a });
    }
  }

  for (const r of dati.aperte) {
    for (const p of r.pros) {
      const n = dati.nonLettiPerCoppia.get(`${r.id}:${p.id}`) ?? 0;
      if (n > 0) {
        voci.push({
          tipo: "risposta",
          chiave: `unread-${r.id}-${p.id}`,
          richiesta: r,
          pro: p,
          messaggi: n,
        });
      }
    }
  }

  for (const r of dati.aperte) {
    const n = dati.nonLettiPerRichiesta.get(r.id) ?? 0;
    const giorni = r.created_at
      ? (adesso - new Date(r.created_at).getTime()) / 86400000
      : 0;
    if (n === 0 && r.status === "matched" && giorni > 10) {
      voci.push({ tipo: "chiusura", chiave: `close-${r.id}`, richiesta: r });
    }
  }

  // LE RECENSIONI SONO UNA RIGA SOLA (15/10). Sono tutte la stessa azione e
  // nessuna scade: tre righe «Com'è andata con…» occupavano tre posti su
  // quattro. Una riga, il conto, e il tasto apre la piu' recente.
  const mancanti = dati.chiuse
    .filter((r) => daRecensire(r, dati.recensite))
    .sort((x, y) => tempo(y.created_at) - tempo(x.created_at));
  if (mancanti.length > 0) {
    voci.push({ tipo: "recensioni", chiave: "recensioni", richieste: mancanti });
  }

  // Gia' in ordine per costruzione; l'ordinamento stabile lo garantisce anche
  // se un giorno i blocchi qui sopra cambiano posto.
  return ordinaDaFare(voci);
}

function tempo(iso: string | null): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return isNaN(t) ? 0 : t;
}

/** Ordina per priorita' fissa, senza toccare l'ordine dentro ogni gruppo. */
export function ordinaDaFare<V extends { tipo: TipoDaFare }>(voci: V[]): V[] {
  return voci
    .map((v, i) => ({ v, i }))
    .sort(
      (x, y) =>
        PRIORITA.indexOf(x.v.tipo) - PRIORITA.indexOf(y.v.tipo) || x.i - y.i
    )
    .map(({ v }) => v);
}

/**
 * Quali righe si vedono subito. Proposte e risposte sempre tutte; chiusure e
 * recensioni riempiono fino a RIGHE_VISIBILI. Il resto finisce in «+N altri».
 * Vuole le voci gia' ordinate.
 */
export function divisiDaFare<V extends { tipo: TipoDaFare }>(
  ordinate: V[]
): { visibili: V[]; nascoste: V[] } {
  const urgenti = ordinate.filter(
    (v) => v.tipo === "proposta" || v.tipo === "risposta"
  ).length;
  const quante = Math.max(urgenti, RIGHE_VISIBILI);
  return { visibili: ordinate.slice(0, quante), nascoste: ordinate.slice(quante) };
}

// FINITO VUOL DIRE FINITO (14/10). La query della dashboard tiene le ultime
// 24 ore, e le serve. Ma in «Prossimi appuntamenti» venerdi' 9 compariva
// ancora «gio 8». Un appuntamento e' finito quando l'inizio piu' la durata
// (un'ora se manca) e' passato: quello in corso resta, quello di ieri no.
export function nonFinito(
  a: { starts_at: string; duration_minutes?: number | null },
  adesso: number = Date.now()
): boolean {
  const fine =
    new Date(a.starts_at).getTime() + (a.duration_minutes ?? 60) * 60000;
  return fine >= adesso;
}

/** Il giorno di calendario a Roma, «2026-10-09», qualunque sia il fuso del browser. */
function giornoARoma(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
}

// «OGGI» E «DOMANI» AL POSTO DEL GIORNO DELLA SETTIMANA (14/10): «ven 9»
// obbliga a fare il conto, «oggi 9» no. Giorni di calendario a Roma, non
// 24 ore: alle 23 «domani alle 8» e' domani.
export function giornoVicino(
  startsAt: string,
  adesso: Date = new Date()
): "oggi" | "domani" | null {
  const giorno = giornoARoma(new Date(startsAt));
  const oggi = giornoARoma(adesso);
  if (giorno === oggi) return "oggi";
  const [y, m, d] = oggi.split("-").map(Number);
  const domani = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return giorno === domani ? "domani" : null;
}

/** «oggi alle 19:00», «mar 20 alle 09:00»: l'ora di Roma. */
export function quandoBreve(startsAt: string, adesso: Date = new Date()): string {
  const d = new Date(startsAt);
  const ora = d.toLocaleTimeString("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
  });
  const vicino = giornoVicino(startsAt, adesso);
  if (vicino) return `${vicino} alle ${ora}`;
  const giorno = d
    .toLocaleDateString("it-IT", { timeZone: "Europe/Rome", weekday: "short" })
    .replace(".", "");
  const numero = d.toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "numeric" });
  return `${giorno} ${numero} alle ${ora}`;
}

// IL SOTTOTITOLO DICE QUALCOSA (15/10). Sotto «Ciao <nome>» c'era una frase
// fissa, «Il punto della situazione sui tuoi lavori.», uguale per tutti e
// ogni giorno. Adesso e' il punto davvero: quante cose aspettano il cliente
// e quando e' il prossimo appuntamento.
export function riepilogoCliente(
  daFare: number,
  appuntamenti: AppuntamentoDaFare[],
  adesso: Date = new Date()
): string {
  const parti: string[] = [];
  if (daFare > 0) parti.push(daFare === 1 ? "1 cosa da fare" : `${daFare} cose da fare`);
  const prossimo = appuntamenti
    .filter(
      (a) =>
        nonFinito(a, adesso.getTime()) &&
        (a.status === "confirmed" ||
          (a.status === "proposed" && a.proposed_by === "professional"))
    )
    .sort((x, y) => tempo(x.starts_at) - tempo(y.starts_at))[0];
  if (prossimo) parti.push(`prossimo appuntamento ${quandoBreve(prossimo.starts_at, adesso)}`);
  if (parti.length === 0) return "Nessuna novità: tutto in ordine.";
  // E' una frase sotto un titolo: comincia con la maiuscola anche quando c'e'
  // solo l'appuntamento.
  const testo = parti.join(" · ");
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}
