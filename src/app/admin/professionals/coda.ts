// LA CODA DI LAVORO DELLA VERIFICA (29/09, Lucio).
//
// PERCHE'. La pagina aveva cinque sezioni impilate per tassonomia — Emergenze,
// Ricontrollo, Coda partita IVA, due <details> e i professionisti raggruppati
// per verification_status — e per sapere cosa fare adesso bisognava leggerle
// tutte. Adesso c'e' UNA coda, ordinata dal piu' urgente, che si lavora
// dall'alto; le viste per tassonomia sono un filtro sulla stessa lista (?vista=).
//
// L'URGENZA NON SI RIDEFINISCE QUI. Palla nostra = vat_review_opened_at
// valorizzata (mig 080); oltre l'SLA = statoCoda().sforata. Sono le regole di
// src/lib/vat.ts, le stesse della pillola, delle Emergenze di prima e del giro
// notturno. Questo file le consuma e basta.
//
// Funzioni pure: si provano senza database e senza login (coda.test.ts).
// L'import e' relativo perche' vitest non risolve l'alias @/.

import {
  MOTIVO_RICONTROLLO_STAFF,
  casiInEmergenza,
  giorniLavorativiTra,
  statoCoda,
  type VatReviewState,
  type VerificationLevel,
} from "../../../lib/vat";

/** I campi di professional_verification che servono alla coda. */
export interface RigaCaso {
  professional_id: string;
  level: VerificationLevel;
  vat_review_state: VatReviewState | null;
  vat_review_opened_at: string | null;
  recheck_reason: string | null;
  recheck_opened_at: string | null;
  vat_check_source: string | null;
  updated_at: string;
}

/** Un evento del registro, coi soli campi che servono a dire «perche'». */
export interface EventoCaso {
  event: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Le viste
// ---------------------------------------------------------------------------

export type Vista = "aperti" | "nostra" | "pro" | "ricontrolli" | "respinti" | "attivi";

export const VISTE: { id: Vista; etichetta: string; titolo: string }[] = [
  { id: "aperti", etichetta: "Aperti", titolo: "Tutti i casi aperti, dal più urgente" },
  { id: "nostra", etichetta: "Palla nostra", titolo: "Casi che aspettano noi" },
  { id: "pro", etichetta: "In attesa del pro", titolo: "Casi che aspettano il professionista" },
  { id: "ricontrolli", etichetta: "Ricontrolli", titolo: "Verifiche già concesse da riguardare" },
  { id: "respinti", etichetta: "Respinti", titolo: "Richieste respinte" },
  { id: "attivi", etichetta: "Livelli attivi", titolo: "Livelli concessi, senza casi aperti: da qui si revoca" },
];

export const VISTA_PREDEFINITA: Vista = "aperti";

/**
 * La vista da un parametro d'indirizzo. Qualunque valore sconosciuto torna
 * alla predefinita: un link incollato male apre la coda, non una pagina vuota.
 */
export function vistaDa(param: string | string[] | undefined): Vista {
  const v = Array.isArray(param) ? param[0] : param;
  return VISTE.some((x) => x.id === v) ? (v as Vista) : VISTA_PREDEFINITA;
}

/** Un caso aperto: c'e' un esame in corso, di chiunque sia la palla. */
export function aperto(r: Pick<RigaCaso, "vat_review_state">): boolean {
  return (
    r.vat_review_state === "pending" ||
    r.vat_review_state === "docs_requested" ||
    r.vat_review_state === "recheck"
  );
}

/** Palla nostra: lo stesso criterio del giro notturno (mig 080). */
export function pallaNostra(r: Pick<RigaCaso, "vat_review_opened_at">): boolean {
  return r.vat_review_opened_at !== null;
}

// Fra i casi con la palla del professionista non corre nessun orologio: si
// mettono sotto, prima le cessazioni. E' l'ordine che il Ricontrollo aveva
// gia' (079), non una nuova definizione di urgenza.
const PESO_MOTIVO: Record<string, number> = {
  cessazione: 0,
  procedura: 1,
  intestazione: 2,
  scadenza: 3,
};

function ms(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

/**
 * L'ordine della coda: 1) palla nostra e oltre l'SLA, dal piu' vecchio
 * (casiInEmergenza); 2) palla nostra dentro l'SLA, dal piu' vecchio — con un
 * solo SLA per tutti e' anche chi manca meno allo sforamento; 3) palla del
 * professionista, ricontrolli per motivo e poi il resto per data.
 */
export function ordinaCoda<T extends RigaCaso>(righe: readonly T[], adesso: Date = new Date()): T[] {
  const aperte = righe.filter(aperto);
  const sforati = casiInEmergenza(aperte, adesso);
  const sforatiId = new Set(sforati.map((r) => r.professional_id));
  const nostriDentro = aperte
    .filter((r) => pallaNostra(r) && !sforatiId.has(r.professional_id))
    .sort((a, b) => ms(a.vat_review_opened_at) - ms(b.vat_review_opened_at));
  const loro = aperte
    .filter((r) => !pallaNostra(r))
    .sort(
      (a, b) =>
        (a.vat_review_state === "recheck" ? PESO_MOTIVO[a.recheck_reason ?? "scadenza"] ?? 9 : 9) -
          (b.vat_review_state === "recheck" ? PESO_MOTIVO[b.recheck_reason ?? "scadenza"] ?? 9 : 9) ||
        ms(a.recheck_opened_at ?? a.updated_at) - ms(b.recheck_opened_at ?? b.updated_at)
    );
  return [...sforati, ...nostriDentro, ...loro];
}

/** Le righe di una vista, nell'ordine in cui si mostrano. */
export function righeDellaVista<T extends RigaCaso>(
  righe: readonly T[],
  vista: Vista,
  adesso: Date = new Date()
): T[] {
  const coda = ordinaCoda(righe, adesso);
  const piuRecenti = (xs: T[]) => xs.sort((a, b) => ms(b.updated_at) - ms(a.updated_at));
  switch (vista) {
    case "aperti":
      return coda;
    case "nostra":
      return coda.filter(pallaNostra);
    case "pro":
      return coda.filter((r) => !pallaNostra(r));
    case "ricontrolli":
      return coda.filter((r) => r.vat_review_state === "recheck");
    case "respinti":
      return piuRecenti(righe.filter((r) => r.vat_review_state === "rejected"));
    case "attivi":
      return piuRecenti(righe.filter((r) => r.level !== "none" && r.vat_review_state === null));
  }
}

/** I numeri in cima: quanti da fare ora, quanti oltre, quanti aspettano il pro. */
export function contatori(righe: readonly RigaCaso[], adesso: Date = new Date()) {
  const aperte = righe.filter(aperto);
  return {
    daFare: aperte.filter(pallaNostra).length,
    oltreSla: casiInEmergenza(aperte, adesso).length,
    inAttesaDelPro: aperte.filter((r) => !pallaNostra(r)).length,
  };
}

// ---------------------------------------------------------------------------
// La riga: chi, perche', da quanto
// ---------------------------------------------------------------------------

function ultimo(eventi: readonly EventoCaso[], nomi: string[]): EventoCaso | null {
  return (
    eventi
      .filter((e) => nomi.includes(e.event))
      .sort((a, b) => ms(b.created_at) - ms(a.created_at))[0] ?? null
  );
}

/** Perche' il caso e' in coda, in parole: si legge senza aprire la scheda. */
export function perche(r: RigaCaso, eventi: readonly EventoCaso[] = []): string {
  const motivo = () =>
    MOTIVO_RICONTROLLO_STAFF[(r.recheck_reason ?? "scadenza") as keyof typeof MOTIVO_RICONTROLLO_STAFF] ??
    r.recheck_reason ??
    "ricontrollo";
  switch (r.vat_review_state) {
    case "pending": {
      const u = ultimo(eventi, ["vat_submitted", "documents_submitted"]);
      if (u?.event === "documents_submitted") return "Documenti caricati, da esaminare";
      return r.vat_check_source === null
        ? "Prima richiesta · il VIES non ha risposto"
        : "Prima richiesta · il VIES non ha confermato";
    }
    case "docs_requested":
      return "Documenti richiesti";
    case "recheck":
      return pallaNostra(r)
        ? `Ricontrollo · ${motivo()} · documento caricato`
        : `Ricontrollo · ${motivo()}`;
    case "rejected":
      return "Respinta";
    default:
      return r.level !== "none" ? "Livello attivo" : "—";
  }
}

/**
 * Da quanto aspetta, in parole. Palla nostra: la pillola di statoCoda() dice
 * gia' tutto, qui si restituisce null. Palla sua: da quando gliel'abbiamo
 * passata, in giorni lavorativi (la stessa unita' dell'SLA).
 */
export function inAttesaDelProDa(
  r: RigaCaso,
  eventi: readonly EventoCaso[] = [],
  adesso: Date = new Date()
): string | null {
  if (!aperto(r) || pallaNostra(r)) return null;
  const da =
    r.vat_review_state === "recheck"
      ? r.recheck_opened_at
      : ultimo(eventi, ["documents_requested"])?.created_at ?? r.updated_at;
  if (!da) return null;
  const g = giorniLavorativiTra(new Date(da), adesso);
  return `In attesa del professionista da ${g} ${g === 1 ? "giorno lavorativo" : "giorni lavorativi"}`;
}

/** La pillola dell'SLA, come testo: la stessa di prima, calcolata da statoCoda(). */
export function testoSla(r: Pick<RigaCaso, "vat_review_opened_at">, adesso: Date = new Date()) {
  const s = statoCoda(r.vat_review_opened_at, adesso);
  if (!s) return null;
  const testo = s.sforata
    ? `SLA sforata di ${-s.rimasti} ${-s.rimasti === 1 ? "giorno" : "giorni"}`
    : s.rimasti === 0
      ? "Ultimo giorno utile"
      : `Restano ${s.rimasti} ${s.rimasti === 1 ? "giorno" : "giorni"}`;
  return { testo, inCoda: s.inCoda, sforata: s.sforata, rimasti: s.rimasti, scadenzaSla: s.scadenzaSla };
}

// ---------------------------------------------------------------------------
// I documenti: si firmano solo quelli che si mostrano
// ---------------------------------------------------------------------------

export interface DocumentoGrezzo {
  professional_id: string;
  file_name: string;
  storage_path: string;
  status: string;
  uploaded_at: string;
}

export interface DocumentoFirmato {
  file_name: string;
  status: string;
  uploaded_at: string;
  url: string | null;
  /** Vero se la firma e' fallita: la scheda lo dice, invece di mostrare un nome senza link. */
  firmaFallita: boolean;
}

/**
 * PRIVILEGIO MINIMO (29/09). Prima si creava un link firmato di un'ora per
 * OGNI documento di OGNI caso a ogni apertura della pagina — livelli attivi e
 * respinti compresi — anche se nessuno li apriva. Adesso chi chiama passa solo
 * i documenti dei casi della vista mostrata. Una firma che fallisce non sparisce
 * in silenzio: il documento resta in elenco con firmaFallita = true.
 */
export async function firmaDocumenti(
  documenti: readonly DocumentoGrezzo[],
  firma: (percorso: string) => Promise<string | null>
): Promise<Map<string, DocumentoFirmato[]>> {
  const perPro = new Map<string, DocumentoFirmato[]>();
  for (const d of documenti) {
    let url: string | null = null;
    try {
      url = await firma(d.storage_path);
    } catch {
      url = null;
    }
    const lista = perPro.get(d.professional_id) ?? [];
    lista.push({
      file_name: d.file_name,
      status: d.status,
      uploaded_at: d.uploaded_at,
      url,
      firmaFallita: url === null,
    });
    perPro.set(d.professional_id, lista);
  }
  return perPro;
}
