/**
 * L'Italia intera: lo sfondo su cui sta tutto il resto.
 *
 * PERCHÉ ESISTE. `confini.ts` disegna una provincia per volta, con i suoi
 * comuni. Va bene finché si guarda quella provincia, ma chi allarga la mappa
 * vede la propria città sospesa nel vuoto — segnalato il 17/09 con lo
 * screenshot: «manca ancora l'Italia». Questo è il disegno d'insieme: 110
 * forme di provincia, 138 KB compressi, lo genera
 * scripts/build_italia_province.py dai confini ISTAT via openpolis (CC BY 4.0).
 *
 * DUE LIVELLI DI DETTAGLIO, NON DUE MAPPE. Lo sfondo resta acceso sempre; a
 * ingrandimento alto sopra ci va la provincia vera con i suoi comuni. È lo
 * stesso disegno visto da due distanze, come una carta stradale.
 *
 * IL RIQUADRO È LA CHIAVE. Ogni provincia porta il proprio riquadro, misurato
 * sulla geometria piena e allargato fino a contenere il centro di ogni comune
 * che ha quella sigla nel nostro elenco. Serve a decidere QUALI file di comuni
 * chiedere senza scaricarli: si prendono le province che toccano
 * l'inquadratura, non tutte e 107.
 */

import type { FormaComune } from "./confini";

export const PERCORSO_ITALIA = "/geo/italia.geojson";

/**
 * Quante province di comuni si tengono caricate insieme. Sei coprono
 * l'inquadratura di una città con tutto il suo intorno; più di così è mezza
 * regione a schermo, dove i confini comunali sono un groviglio illeggibile e
 * non servirebbero comunque.
 */
export const MAX_PROVINCE_APERTE = 6;

/**
 * Sotto questo ingrandimento i comuni non si caricano: a quella distanza sono
 * righe da mezzo pixel, e sarebbero qualche megabyte per non far vedere
 * niente. Resta lo sfondo delle province, che a quella scala è il disegno
 * giusto.
 */
export const ZOOM_COMUNI = 8;

export interface FormaProvincia {
  /** La sigla automobilistica: è anche il nome del file dei comuni. */
  sigla: string;
  nome: string;
  regione: string;
  /** [ovest, sud, est, nord]. */
  riquadro: [number, number, number, number];
  anelli: [number, number][][];
}

export interface Riquadro {
  ovest: number;
  sud: number;
  est: number;
  nord: number;
}

/** Da geojson a forme disegnabili. Come leggiConfini, ma con il riquadro. */
export function leggiProvince(dati: unknown): FormaProvincia[] {
  const collezione = dati as {
    features?: Array<{
      properties?: { s?: string; n?: string; r?: string; b?: number[] };
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  };
  const forme: FormaProvincia[] = [];
  for (const f of collezione.features ?? []) {
    const g = f.geometry;
    let anelli: [number, number][][] = [];
    if (g?.type === "MultiPolygon") {
      anelli = (g.coordinates as [number, number][][][]).map((p) => p[0]);
    } else if (g?.type === "Polygon") {
      anelli = [(g.coordinates as [number, number][][])[0]];
    }
    anelli = anelli.filter((a) => a && a.length >= 4);
    const b = f.properties?.b;
    if (anelli.length === 0 || !b || b.length !== 4) continue;
    forme.push({
      sigla: (f.properties?.s ?? "").toUpperCase(),
      nome: f.properties?.n ?? "",
      regione: f.properties?.r ?? "",
      riquadro: [b[0], b[1], b[2], b[3]],
      anelli,
    });
  }
  return forme;
}

/** I due riquadri si toccano? Confine compreso: meglio un file in più. */
export function siToccano(a: Riquadro, b: [number, number, number, number]): boolean {
  return !(b[2] < a.ovest || b[0] > a.est || b[3] < a.sud || b[1] > a.nord);
}

/**
 * Le sigle delle province da caricare per questa inquadratura, le più centrali
 * per prime.
 *
 * PERCHÉ ORDINATE E NON A CASO. Il tetto di `massimo` taglia: se tagliasse
 * nell'ordine del file si perderebbe la provincia sotto il cursore e si
 * terrebbe quella che spunta da un angolo. L'ordine è la distanza fra il
 * centro del riquadro della provincia e il centro dell'inquadratura.
 *
 * `sempre` sono le sigle che non si scartano mai — quella della base del
 * professionista e quelle dei comuni che ha già dichiarato: le sue forme
 * devono restare accese anche mentre guarda dall'altra parte.
 */
export function provinceNelRiquadro(
  province: FormaProvincia[],
  vista: Riquadro,
  massimo: number = MAX_PROVINCE_APERTE,
  sempre: string[] = []
): string[] {
  const cx = (vista.ovest + vista.est) / 2;
  const cy = (vista.sud + vista.nord) / 2;

  const candidate = new Map<string, number>();
  for (const p of province) {
    if (!p.sigla || !siToccano(vista, p.riquadro)) continue;
    const px = (p.riquadro[0] + p.riquadro[2]) / 2;
    const py = (p.riquadro[1] + p.riquadro[3]) / 2;
    const d = Math.hypot(px - cx, py - cy);
    // Una sigla può avere più forme (le province sarde soppresse): vale la
    // più vicina.
    const gia = candidate.get(p.sigla);
    if (gia === undefined || d < gia) candidate.set(p.sigla, d);
  }

  const fisse = sempre.filter((s) => s).map((s) => s.toUpperCase());
  const scelte = [...new Set(fisse)];
  [...candidate.entries()]
    .sort((a, b) => a[1] - b[1])
    .forEach(([sigla]) => {
      if (!scelte.includes(sigla)) scelte.push(sigla);
    });
  // Le fisse non contano nel tetto: sono poche e sono quelle che il
  // professionista ha scelto.
  return scelte.slice(0, Math.max(massimo, fisse.length));
}

/** Le forme di tutte le province caricate, in un elenco solo. */
export function unisciForme(
  perSigla: Map<string, FormaComune[]>,
  sigle: string[]
): FormaComune[] {
  const fuori: FormaComune[] = [];
  const viste = new Set<string>();
  for (const s of sigle) {
    for (const f of perSigla.get(s) ?? []) {
      if (viste.has(f.istat)) continue;
      viste.add(f.istat);
      fuori.push(f);
    }
  }
  return fuori;
}
