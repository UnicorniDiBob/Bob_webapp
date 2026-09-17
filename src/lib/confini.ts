/**
 * I confini dei comuni, una provincia per volta.
 *
 * PERCHÉ NON UN FILE SOLO. Tutti i comuni italiani sono decine di megabyte: si
 * carica la provincia che si sta guardando, ~50 KB, e le altre restano dove
 * sono. Li genera scripts/build_confini_province.py dai confini ISTAT
 * distribuiti da openpolis in CC BY 4.0 — attribuzione dentro ogni file, nella
 * proprietà `fonte`.
 *
 * PERCHÉ NON SONO TILE. Stessa scelta della mappa di Milano: nessun fornitore,
 * quindi l'indirizzo IP del professionista e il pezzo d'Italia che sta
 * guardando non escono da Bob. I file stanno sul nostro dominio.
 */

export interface FormaComune {
  /** Codice ISTAT a sei cifre: la stessa chiave della tabella comuni. */
  istat: string;
  nome: string;
  /** Gli anelli esterni, in [lng, lat] come li vuole maplibre. */
  anelli: [number, number][][];
}

/** Dove sta il file di una provincia. La sigla è quella dei comuni (MI, BG). */
export function percorsoProvincia(sigla: string): string {
  return `/geo/province/${sigla.trim().toUpperCase()}.geojson`;
}

/**
 * Da geojson a forme disegnabili. Prende solo l'anello esterno di ogni
 * poligono: i buchi (le enclave) su una mappa di provincia non si vedono, e
 * disegnarli costerebbe un secondo tracciato per comune.
 */
export function leggiConfini(dati: unknown): FormaComune[] {
  const collezione = dati as {
    features?: Array<{
      properties?: { i?: string; n?: string };
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  };
  const forme: FormaComune[] = [];
  for (const f of collezione.features ?? []) {
    const g = f.geometry;
    let anelli: [number, number][][] = [];
    if (g?.type === "MultiPolygon") {
      anelli = (g.coordinates as [number, number][][][]).map((p) => p[0]);
    } else if (g?.type === "Polygon") {
      anelli = [(g.coordinates as [number, number][][])[0]];
    }
    anelli = anelli.filter((a) => a && a.length >= 4);
    if (anelli.length === 0) continue;
    forme.push({
      istat: f.properties?.i ?? "",
      nome: f.properties?.n ?? "",
      anelli,
    });
  }
  return forme;
}
