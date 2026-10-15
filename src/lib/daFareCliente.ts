// «DA FARE ORA» DEL CLIENTE: COSA C'E', IN CHE ORDINE, QUANTO SI VEDE (15/10).
//
// E' il blocco piu' importante della dashboard: in cinque secondi il cliente
// deve vedere cosa aspetta lui. Fino al 14/10 le righe uscivano nell'ordine
// in cui il codice le costruiva, tagliate a quattro: tre recensioni allo
// stesso pro potevano spingere fuori la proposta d'orario di un altro pro,
// cioe' l'unica cosa con una scadenza. Qui l'ordine e' fisso e dice
// l'urgenza:
//   (a) proposta     — un pro propone un orario (anche spostandone uno gia'
//                      confermato) e l'orario e' ancora nel futuro;
//   (b) risposta     — un pro ha scritto e il cliente non ha letto;
//   (c) lavoro-fatto — «Com'è andato il lavoro con <Pro>?»: un appuntamento
//                      confermato e' finito (o il pro l'ha segnato fatto)
//                      e la richiesta e' ancora aperta (15/10, PR 6);
//   (d) chiusura     — «E' andato tutto bene?» sulle richieste senza nessun
//                      appuntamento, ferme da piu' di 10 giorni (dall'ultimo
//                      messaggio, non dalla creazione: PR 9, 15/10);
//   (e) recensioni   — UNA riga per tutte le recensioni mancanti.
// (a) e (b) si vedono sempre, anche oltre le quattro righe: chi aspetta una
// risposta non deve finire sotto «+N altri». (c), (d) ed (e) riempiono il
// resto.
//
// IL LAVORO FATTO SI CHIEDE QUANDO SI SA (15/10, PR 6). Fino al 14/10 l'unico
// promemoria per chiudere era (d): «matched» da 10 giorni. Ma «matched» voleva
// dire solo che il cliente aveva scritto in chat (PR 5; dalla migrazione 119
// lo mette la prima risposta di un pro), e dieci giorni non
// dicono se il lavoro c'e' stato. Quando un appuntamento confermato finisce,
// invece, lo sappiamo: e' il momento di chiedere, finche' il ricordo e'
// fresco. Viene prima di (d) perche' e' una certezza e (d) una stima, e dopo
// (a) e (b) perche' non scade. (d) resta solo per i lavori presi in chat,
// senza appuntamenti: una richiesta non ha mai le due righe insieme.
//
// Niente React qui: e' logica pura, e i test la provano senza la pagina.

/** Le righe che si vedono senza aprire «+N altri», se non ci sono urgenze in piu'. */
export const RIGHE_VISIBILI = 4;

const PRIORITA = ["proposta", "risposta", "lavoro-fatto", "chiusura", "recensioni"] as const;
export type TipoDaFare = (typeof PRIORITA)[number];

export interface AppuntamentoDaFare {
  id: string;
  request_id: string | null;
  professional_id: string;
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
  | {
      tipo: "lavoro-fatto";
      chiave: string;
      richiesta: R;
      /** Il pro dell'ultimo appuntamento finito, e quando era. */
      pro: { id: string; name: string };
      inizio: string;
    }
  | { tipo: "chiusura"; chiave: string; richiesta: R }
  /** Le richieste da recensire, la piu' recente per prima. */
  | { tipo: "recensioni"; chiave: string; richieste: R[] };

/** Una prenotazione disdetta non si recensisce: non e' un lavoro fatto (113). */
export function recensibile(r: { closed_reason: string | null }): boolean {
  return r.closed_reason !== "disdetto";
}

/**
 * Un appuntamento che c'e' o c'e' stato davvero: confermato o fatto, oppure
 * proposto con l'orario ancora nel futuro. Non conta l'annullato, e nemmeno
 * il rifiutato («declined»): e' una proposta a cui il cliente ha detto di no,
 * l'appuntamento non e' mai nato. (15/10: sta qui da quando serve anche a
 * «Da fare ora»; lib/richiestaCliente la riesporta.)
 *
 * LA PROPOSTA SCADUTA NON E' UN APPUNTAMENTO (15/10, PR 6). Una proposta,
 * del pro o del cliente, il cui orario e' passato senza conferma non e' mai
 * diventata niente, come in propostaDaRispondere. Contata come vera, una
 * richiesta con solo quella non aveva ne' «lavoro-fatto» (niente di
 * confermato) ne' «chiusura» (un appuntamento «c'era»): spariva.
 */
export function appuntamentoVero(
  a: { status: string; starts_at: string },
  adesso: number = Date.now()
): boolean {
  if (a.status === "confirmed" || a.status === "completed") return true;
  return a.status === "proposed" && new Date(a.starts_at).getTime() > adesso;
}

/**
 * Un appuntamento il cui lavoro e' gia' avvenuto: confermato e finito
 * (inizio + durata passati, come nonFinito), oppure segnato «completed» dal
 * pro (AppointmentDetail), che vale anche prima della fine prevista.
 */
export function lavoroAvvenuto(
  a: { status: string; starts_at: string; duration_minutes?: number | null },
  adesso: number = Date.now()
): boolean {
  return a.status === "completed" || (a.status === "confirmed" && !nonFinito(a, adesso));
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

/**
 * L'ultimo messaggio vero di ogni richiesta (PR 9, 15/10): del cliente o di
 * un pro, mai una nota di Bob, e solo nelle conversazioni non archiviate
 * (`archiviate` = chiavi «richiesta:pro»). E' l'orologio di «E' andato tutto
 * bene?».
 */
export function ultimoMessaggioPerRichiesta(
  righe: {
    request_id: string;
    professional_id: string | null;
    sender_type: string;
    created_at: string;
  }[],
  archiviate: Set<string>
): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of righe) {
    if (m.sender_type !== "customer" && m.sender_type !== "professional") continue;
    if (archiviate.has(`${m.request_id}:${m.professional_id ?? ""}`)) continue;
    const prima = out.get(m.request_id);
    if (!prima || m.created_at > prima) out.set(m.request_id, m.created_at);
  }
  return out;
}

/** Le cose da fare, gia' nell'ordine fisso; stabile dentro ogni gruppo. */
export function vociDaFare<A extends AppuntamentoDaFare, R extends RichiestaDaFare>(
  dati: {
    appuntamenti: A[];
    /**
     * TUTTI gli appuntamenti delle richieste aperte, di ogni stato e di ogni
     * data: servono a «lavoro-fatto» e a sapere chi non ne ha nessuno.
     */
    appuntamentiAperte: AppuntamentoDaFare[];
    /** Richieste aperte (sent, quote_request, matched). */
    aperte: R[];
    chiuse: R[];
    /** Non letti per «richiesta:pro». */
    nonLettiPerCoppia: Map<string, number>;
    /** Non letti per richiesta. */
    nonLettiPerRichiesta: Map<string, number>;
    /** Recensioni gia' lasciate, «richiesta:pro». */
    recensite: Set<string>;
    /**
     * L'ultimo messaggio di ogni richiesta (ISO), del cliente o di un pro,
     * nelle sole conversazioni NON archiviate; le note di Bob non contano.
     * Una richiesta che qui non c'e' non ha conversazioni vive.
     */
    ultimoMessaggio: Map<string, string>;
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
    const suoi = dati.appuntamentiAperte.filter((a) => a.request_id === r.id);
    // Un confermato ancora da venire (il pro torna per una seconda visita):
    // il lavoro non e' finito.
    if (suoi.some((a) => a.status === "confirmed" && nonFinito(a, adesso))) continue;
    const ultimo = suoi
      .filter((a) => lavoroAvvenuto(a, adesso))
      .sort((x, y) => tempo(y.starts_at) - tempo(x.starts_at))[0];
    if (ultimo) {
      voci.push({
        tipo: "lavoro-fatto",
        chiave: `fatto-${r.id}`,
        richiesta: r,
        pro: r.pros.find((p) => p.id === ultimo.professional_id) ?? {
          id: ultimo.professional_id,
          name: "Professionista",
        },
        inizio: ultimo.starts_at,
      });
    }
  }

  // DIECI GIORNI DI SILENZIO, NON DIECI GIORNI DI VITA (15/10, PR 9). Il
  // conto partiva da requests.created_at: «Imbianchino», creata il 17/07 e in
  // contatto solo dal 15/10, chiedeva «È andato tutto bene?» il giorno
  // stesso, in mezzo a una conversazione viva. Adesso si conta dall'ultimo
  // messaggio vero (cliente o pro) nelle conversazioni non archiviate: le
  // note di Bob non spostano l'orologio, e una richiesta con tutte le
  // conversazioni archiviate non lo chiede mai.
  for (const r of dati.aperte) {
    const n = dati.nonLettiPerRichiesta.get(r.id) ?? 0;
    const ultimo = dati.ultimoMessaggio.get(r.id);
    if (!ultimo) continue;
    const giorni = (adesso - new Date(ultimo).getTime()) / 86400000;
    // Solo i lavori presi in chat: con un appuntamento vero (confermato,
    // fatto o proposto per il futuro; l'annullato, il rifiutato e la
    // proposta scaduta no) la domanda la fa
    // «lavoro-fatto», al momento giusto. Cosi' una richiesta non ha mai le
    // due righe insieme.
    const conAppuntamento = dati.appuntamentiAperte.some(
      (a) => a.request_id === r.id && appuntamentoVero(a, adesso)
    );
    if (n === 0 && r.status === "matched" && giorni > 10 && !conAppuntamento) {
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
