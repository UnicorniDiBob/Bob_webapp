// SCEGLI E ARCHIVIA: LE REGOLE, SENZA REACT (15/10, PR 7, migrazione 120).
//
// Il cliente confronta i pro nella pagina della richiesta e ne sceglie uno:
// gli altri vengono archiviati (leggono, non scrivono piu'). Chi puo' essere
// scelto lo decide il database (scegli_professionista) quando si sceglie
// davvero; qui c'e' la stessa regola per decidere DOVE mostrare «Scegli»,
// e i testi dei rifiuti della route. Le decisioni (Lucio 14/10, André
// 15/10):
//   5. si cambia scelta finche' col pro scelto non c'e' un appuntamento
//      confermato (o gia' fatto): dopo, «Scegli» sparisce;
//   6. «Scegli» solo su chi ha scritto almeno un messaggio;
//   7. con un pro solo niente «Scegli»: non c'e' niente da confrontare.

/** I testi delle note di Bob: gli stessi di scegli_professionista() e riapri_conversazione() (120). */
export const BOB_CHIUSA = "Il cliente ha chiuso questa richiesta.";
export const BOB_RIAPERTA = "Il cliente ha riaperto la conversazione.";

export interface AppuntamentoScelta {
  professional_id: string;
  status: string;
}

/** I motivi con cui scegli_professionista() e riapri_conversazione() dicono di no. */
export type MotivoRifiuto =
  | "non_trovata"
  | "chiusa"
  | "non_collegato"
  | "un_solo_pro"
  | "non_ha_risposto"
  | "appuntamento_altro"
  | "scelta_bloccata"
  | "non_archiviata";

/** La scelta non si cambia piu': col pro scelto c'e' un appuntamento confermato o fatto. */
export function sceltaBloccata(
  scelto: string | null,
  appuntamenti: AppuntamentoScelta[]
): boolean {
  if (!scelto) return false;
  return appuntamenti.some(
    (a) => a.professional_id === scelto && (a.status === "confirmed" || a.status === "completed")
  );
}

/** Dove compare «Scegli»: su quali schede, per questa richiesta. */
export function sceglibili(r: {
  chiusa: boolean;
  /** Tutti i pro collegati alla richiesta, archiviati compresi. */
  collegati: string[];
  /** I pro che hanno scritto almeno un messaggio. */
  rispondenti: Set<string>;
  archiviati: Set<string>;
  scelto: string | null;
  appuntamenti: AppuntamentoScelta[];
}): Set<string> {
  const out = new Set<string>();
  if (r.chiusa || r.collegati.length < 2) return out;
  if (sceltaBloccata(r.scelto, r.appuntamenti)) return out;
  for (const id of r.collegati) {
    if (id === r.scelto || r.archiviati.has(id) || !r.rispondenti.has(id)) continue;
    out.add(id);
  }
  return out;
}

/**
 * L'ordine delle schede del confronto: il pro scelto per primo, poi gli
 * altri nell'ordine di sempre; gli archiviati escono dal confronto.
 */
export function ordineConfronto<P extends { id: string }>(
  pros: P[],
  scelto: string | null,
  archiviati: Set<string>
): P[] {
  const attivi = pros.filter((p) => !archiviati.has(p.id));
  const primo = attivi.find((p) => p.id === scelto);
  return primo ? [primo, ...attivi.filter((p) => p.id !== scelto)] : attivi;
}

/** Il testo che il cliente legge quando la route dice di no. */
export function testoRifiuto(motivo: MotivoRifiuto | string, nomePro?: string | null): string {
  const pro = nomePro || "un altro professionista";
  switch (motivo) {
    case "non_trovata":
      return "Questa richiesta non c'è o non è tua.";
    case "chiusa":
      return "Questa richiesta è chiusa: non c'è più niente da scegliere.";
    case "non_collegato":
      return "Questo professionista non è fra quelli della richiesta.";
    case "un_solo_pro":
      return "Con un solo professionista non c'è niente da scegliere.";
    case "non_ha_risposto":
      return "Puoi scegliere solo un professionista che ti ha risposto.";
    case "appuntamento_altro":
      return `C'è un appuntamento confermato con ${pro}: disdicilo prima di scegliere un altro professionista.`;
    case "scelta_bloccata":
      return `Hai già un appuntamento confermato con ${pro}: la scelta non si cambia più.`;
    case "non_archiviata":
      return "Questa conversazione non è archiviata.";
    default:
      return "Non è andata. Riprova fra poco.";
  }
}

/** Lo stato HTTP di un rifiuto: «non c'è» e' 404, il resto e' un conflitto. */
export function statoRifiuto(motivo: string): number {
  return motivo === "non_trovata" || motivo === "non_collegato" ? 404 : 409;
}

/**
 * LE CONVERSAZIONI DEL PRO: LE ARCHIVIATE IN FONDO (15/10, PR 8). Una
 * richiesta che il cliente ha chiuso non aspetta piu' niente da lui: resta
 * da rileggere, ma sotto tutte quelle aperte. Dentro ogni gruppo l'ordine
 * resta quello di prima (il piu' recente in alto). Solo per il pro: il
 * cliente ha il suo filtro «Archiviate» (PR 9).
 */
export function archiviateInFondo<T extends { archiviata?: boolean }>(conversazioni: T[]): T[] {
  return [
    ...conversazioni.filter((c) => !c.archiviata),
    ...conversazioni.filter((c) => c.archiviata),
  ];
}

/**
 * CHI CONTA NELLA DASHBOARD (15/10). Un pro archiviato su una richiesta non
 * conta piu' da nessuna parte: ne' fra le risposte da confrontare, ne' nei
 * non letti, ne' fra le proposte da rispondere. `archiviati` e' l'insieme
 * delle coppie «richiesta:pro» archiviate.
 */
export function chiaveCoppia(requestId: string | null, professionalId: string | null): string {
  return `${requestId ?? ""}:${professionalId ?? ""}`;
}

export function senzaArchiviati<
  T extends { request_id: string | null; professional_id: string | null },
>(righe: T[], archiviati: Set<string>): T[] {
  if (archiviati.size === 0) return righe;
  return righe.filter((r) => !archiviati.has(chiaveCoppia(r.request_id, r.professional_id)));
}
