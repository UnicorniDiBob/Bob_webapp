// Le regole delle Analisi che non dipendono dallo schermo: quali mesi copre
// un periodo, contro cosa si confronta, quando una percentuale si puo'
// mostrare. Stanno qui, e non nei componenti, perche' si provano con un test
// e perche' la pagina server e il componente client devono dire la stessa
// cosa. Spec: docs/SPEC_analisi_professionista.md, §3.3 e §3.7.

/** Un mese come lo scrive l'URL: "2026-09". */
export type MeseUrl = string;

export type Confronto = "anno" | "prec" | "no";

export interface Periodo {
  /** Primo mese, "aaaa-mm". */
  da: MeseUrl;
  /** Ultimo mese, compreso. */
  a: MeseUrl;
}

export type Scorciatoia =
  | "mese"
  | "mese-scorso"
  | "anno-finora"
  | "ultimi-12"
  | "anno-scorso";

const RE_MESE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parti(m: MeseUrl): [number, number] {
  const r = RE_MESE.exec(m);
  if (!r) throw new Error(`mese non valido: ${m}`);
  return [Number(r[1]), Number(r[2])];
}

export function meseValido(m: string | undefined | null): m is MeseUrl {
  return !!m && RE_MESE.test(m);
}

/** Sposta un mese di n mesi (anche negativi). */
export function sposta(m: MeseUrl, n: number): MeseUrl {
  const [y, mm] = parti(m);
  const t = y * 12 + (mm - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Quanti mesi copre il periodo, estremi compresi. */
export function quantiMesi(p: Periodo): number {
  const [y1, m1] = parti(p.da);
  const [y2, m2] = parti(p.a);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

/** Il mese di oggi, a Roma: e' l'ora in cui lavora il professionista. */
export function meseDiOggi(oggi: Date = new Date()): MeseUrl {
  const s = oggi.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  return s.slice(0, 7);
}

export function scorciatoia(s: Scorciatoia, oggi: MeseUrl): Periodo {
  const anno = oggi.slice(0, 4);
  switch (s) {
    case "mese":
      return { da: oggi, a: oggi };
    case "mese-scorso": {
      const m = sposta(oggi, -1);
      return { da: m, a: m };
    }
    case "anno-finora":
      return { da: `${anno}-01`, a: oggi };
    case "ultimi-12":
      return { da: sposta(oggi, -11), a: oggi };
    case "anno-scorso": {
      const y = Number(anno) - 1;
      return { da: `${y}-01`, a: `${y}-12` };
    }
  }
}

/**
 * Il periodo contro cui confrontare. «anno» = gli stessi mesi un anno prima:
 * e' il confronto che regge la stagionalita' (agosto contro agosto, non
 * contro luglio). «prec» = lo stesso numero di mesi subito prima.
 */
export function periodoContro(p: Periodo, c: Confronto): Periodo | null {
  if (c === "no") return null;
  if (c === "anno") return { da: sposta(p.da, -12), a: sposta(p.a, -12) };
  const n = quantiMesi(p);
  return { da: sposta(p.da, -n), a: sposta(p.a, -n) };
}

/**
 * Legge il periodo dall'URL. Qualunque cosa non valida vale «anno finora»;
 * un periodo al contrario si raddrizza; non si va oltre il mese di oggi.
 */
export function periodoDaUrl(
  q: { da?: string; a?: string; contro?: string },
  oggi: MeseUrl
): { periodo: Periodo; confronto: Confronto } {
  let periodo: Periodo =
    meseValido(q.da) && meseValido(q.a)
      ? { da: q.da, a: q.a }
      : scorciatoia("anno-finora", oggi);
  if (periodo.da > periodo.a) periodo = { da: periodo.a, a: periodo.da };
  if (periodo.a > oggi) periodo = { ...periodo, a: oggi };
  if (periodo.da > oggi) periodo = { ...periodo, da: oggi };
  if (quantiMesi(periodo) > 120) periodo = { ...periodo, da: sposta(periodo.a, -119) };
  const confronto: Confronto =
    q.contro === "prec" || q.contro === "no" ? q.contro : "anno";
  return { periodo, confronto };
}

/** Sotto questo denominatore una percentuale e' un numero vero e inutile. */
export const MINIMO_PER_PERCENTUALE = 10;

/**
 * «38%» se il denominatore e' almeno 10, altrimenti «3 su 7». La regola sta
 * nella spec (§3.3): «chiudi il 100%» su una richiesta sola e' vero e non
 * dice niente.
 */
export function quota(parte: number, totale: number): string {
  if (totale <= 0) return "—";
  if (totale < MINIMO_PER_PERCENTUALE) return `${parte} su ${totale}`;
  return `${Math.round((parte / totale) * 100)}%`;
}

/** Il rapporto come numero, o null quando non si deve mostrare. */
export function rapporto(parte: number, totale: number): number | null {
  if (totale < MINIMO_PER_PERCENTUALE) return null;
  return parte / totale;
}

/**
 * Variazione fra due valori, in percentuale. null quando il confronto non ha
 * senso: niente periodo di confronto, o un confronto con zero.
 */
export function variazione(adesso: number, prima: number | null | undefined): number | null {
  if (prima == null || prima === 0) return null;
  return Math.round(((adesso - prima) / prima) * 100);
}

export function nomeMese(m: MeseUrl, corto = false): string {
  const [y, mm] = parti(m);
  const s = new Date(Date.UTC(y, mm - 1, 15)).toLocaleDateString("it-IT", {
    month: corto ? "short" : "long",
    year: corto ? "2-digit" : "numeric",
    timeZone: "UTC",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function nomePeriodo(p: Periodo): string {
  if (p.da === p.a) return nomeMese(p.da);
  if (p.da.slice(0, 4) === p.a.slice(0, 4) && p.da.endsWith("-01") && p.a.endsWith("-12")) {
    return p.da.slice(0, 4);
  }
  return `${nomeMese(p.da)} – ${nomeMese(p.a)}`;
}
