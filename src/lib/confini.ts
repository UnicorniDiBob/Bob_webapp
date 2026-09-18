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
  /**
   * [ovest, sud, est, nord]. Serve a saltare, senza proiettare un vertice, i
   * comuni che in questo momento non sono nell'inquadratura: da quando la
   * mappa tiene aperte più province insieme sono qualche migliaio di forme, e
   * proiettarle tutte a ogni fotogramma si sentirebbe trascinando.
   */
  riquadro: [number, number, number, number];
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
    let ovest = Infinity;
    let sud = Infinity;
    let est = -Infinity;
    let nord = -Infinity;
    for (const anello of anelli) {
      for (const [x, y] of anello) {
        if (x < ovest) ovest = x;
        if (x > est) est = x;
        if (y < sud) sud = y;
        if (y > nord) nord = y;
      }
    }
    forme.push({
      istat: f.properties?.i ?? "",
      nome: f.properties?.n ?? "",
      anelli,
      riquadro: [ovest, sud, est, nord],
    });
  }
  return forme;
}

/**
 * Il punto cade dentro questa forma? Ray casting sugli anelli esterni.
 *
 * PERCHÉ SERVE. Sulla mappa le aree si scelgono cliccandole, e il bersaglio
 * dev'essere la forma, non un pallino da tre pixel. Il click però non può
 * essere intercettato dal disegno: se i tracciati SVG prendessero gli eventi,
 * trascinare la mappa sopra un comune smetterebbe di funzionare — e trascinare
 * la mappa è il gesto che si fa più spesso. Quindi il click resta della mappa,
 * e a dire quale area è stata toccata è questo conto, che costa qualche
 * migliaio di confronti: nulla, una volta per click.
 */
export function dentroForma(
  punto: { lng: number; lat: number },
  anelli: [number, number][][]
): boolean {
  return anelli.some((anello) => dentroAnello(punto.lng, punto.lat, anello));
}

function dentroAnello(x: number, y: number, anello: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0; i < anello.length - 1; i++) {
    const [x1, y1] = anello[i];
    const [x2, y2] = anello[i + 1];
    if (y1 > y !== y2 > y) {
      const taglio = x1 + ((y - y1) * (x2 - x1)) / (y2 - y1);
      if (taglio > x) dentro = !dentro;
    }
  }
  return dentro;
}
