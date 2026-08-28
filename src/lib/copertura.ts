// Area di lavoro del professionista: tipi e conti geometrici.
//
// COSA STA QUI E COSA STA NEL DATABASE
// La verità è il database (migrazione 057): quando si salva un cerchio, è un
// trigger a calcolare quali zone ci cadono dentro, con l'emisenoverso in SQL.
// Le funzioni qui sotto rifanno lo stesso conto nel browser per un motivo
// solo: mostrare le zone accendersi mentre si trascina lo slider, senza un
// giro di rete a ogni pixel. Se i due conti divergessero, vince il database,
// perché è quello che il match legge.
//
// I GETTONI. Un professionista dice dove lavora con un'ampiezza qualsiasi —
// cinque quartieri, la città, la provincia, tutta Italia — e la richiesta di
// un cliente dice dov'è. Il confronto è fra due elenchi di gettoni:
//   zone:milano/navigli · city:milano · prov:milano · reg:lombardia ·
//   macro:nord · it:* · remote:*
// I gettoni della città non li componiamo qui: arrivano da
// cities.coverage_keys (migrazione 058), che è la stessa colonna letta dai due
// lati. Qui si aggiunge solo il gettone di zona, che è concatenazione di due
// stringhe che vengono entrambe dal database.

import type { Feature, Polygon } from "geojson";

export type Scope =
  | "zones"
  | "city"
  | "province"
  | "region"
  | "macro_region"
  | "national";

export type Modo = "zones" | "circle" | "polygon";

export const SCOPE_LABEL: Record<Scope, string> = {
  zones: "Zone della città",
  city: "Tutta la città",
  province: "Tutta la provincia",
  region: "Tutta la regione",
  macro_region: "Tutto il nord / centro / sud",
  national: "Tutta Italia",
};

/** Ordine dal più preciso al più ampio: serve anche a ordinare i risultati. */
export const SCOPE_ORDINE: Scope[] = [
  "zones",
  "city",
  "province",
  "region",
  "macro_region",
  "national",
];

export interface CittaRow {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  province: string | null;
  region: string | null;
  macro_region: string | null;
  coverage_keys: string[] | null;
}

export interface ZonaRow {
  slug: string;
  label: string;
  lat: number | null;
  lng: number | null;
}

export interface Copertura {
  id: string | null;
  scope: Scope;
  cityId: string | null;
  mode: Modo;
  zoneSlugs: string[];
  centerLat: number | null;
  centerLng: number | null;
  radiusM: number | null;
  worksRemote: boolean;
}

export const RAGGIO_MIN = 500;
export const RAGGIO_MAX = 50000;
export const RAGGIO_DEFAULT = 5000;

const R_TERRA = 6371000;

/** Distanza in linea d'aria, in metri. Emisenoverso, come in SQL. */
export function distanzaM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(la) * Math.cos(lb);
  return 2 * R_TERRA * Math.asin(Math.sqrt(h));
}

/** Le zone il cui centro cade nel cerchio. Anteprima: il database rifà il conto. */
export function zoneNelCerchio(
  zone: ZonaRow[],
  centro: { lat: number; lng: number },
  raggioM: number
): string[] {
  return zone
    .filter(
      (z) =>
        z.lat !== null &&
        z.lng !== null &&
        distanzaM(centro, { lat: z.lat, lng: z.lng }) <= raggioM
    )
    .map((z) => z.slug)
    .sort();
}

/** Il cerchio come poligono, per disegnarlo sulla mappa. */
export function cerchioGeoJSON(
  centro: { lat: number; lng: number },
  raggioM: number,
  punti = 72
): Feature<Polygon> {
  const coords: [number, number][] = [];
  const latRad = (centro.lat * Math.PI) / 180;
  for (let i = 0; i <= punti; i++) {
    const a = (i / punti) * 2 * Math.PI;
    // Gradi di latitudine e longitudine per metro, alla latitudine data.
    const dLat = (raggioM * Math.cos(a)) / 111320;
    const dLng = (raggioM * Math.sin(a)) / (111320 * Math.cos(latRad));
    coords.push([centro.lng + dLng, centro.lat + dLat]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

/**
 * I gettoni di una richiesta: quelli della città (dal database) più, se il
 * cliente ha detto la zona, il gettone di zona.
 */
export function gettoniRichiesta(
  citta: Pick<CittaRow, "slug" | "coverage_keys">,
  zonaSlug?: string | null
): string[] {
  const base = citta.coverage_keys ?? [];
  return zonaSlug ? [`zone:${citta.slug}/${zonaSlug}`, ...base] : [...base];
}

/** Riassunto leggibile di una copertura, per la scheda pubblica e la checklist. */
export function descriviCopertura(c: Copertura, citta?: CittaRow | null): string {
  if (c.scope === "national") return "Tutta Italia";
  const nome = citta?.name ?? "la città";
  if (c.scope === "city") return `Tutta ${nome}`;
  if (c.scope === "province") return `Provincia di ${citta?.province ?? nome}`;
  if (c.scope === "region") return citta?.region ?? "Tutta la regione";
  if (c.scope === "macro_region") return `Italia: ${citta?.macro_region ?? "area"}`;
  const n = c.zoneSlugs.length;
  if (n === 0) return "Nessuna zona scelta";
  return n === 1 ? "1 zona" : `${n} zone`;
}

// ---------- Il confronto: chi trova chi ----------
//
// Queste due funzioni sono la regola del match, e stanno qui — non dentro
// data.ts — perché devono essere provabili senza database: sono pure.

/** Quanto è preciso un gettone: più alto, più vicino al cliente. */
export const RANGO_GETTONE: Record<string, number> = {
  zone: 5,
  city: 4,
  prov: 3,
  reg: 2,
  macro: 1,
  it: 0,
};

export interface CoperturaPro {
  /** I gettoni pubblicati. Vuoto = nessuna area dichiarata. */
  keys: string[];
  /** La città della riga professionals: serve alla regola di compatibilità. */
  citySlug: string;
}

/**
 * REGOLA DI COMPATIBILITÀ, non un dettaglio: un professionista che non ha
 * ancora dichiarato niente vale come «tutta la città in cui è iscritto».
 * Senza, i professionisti già in produzione — che non hanno nessuna copertura —
 * spariscono da ogni elenco il giorno del deploy.
 */
export function trovaPerRichiesta(
  pro: CoperturaPro,
  gettoniRichiesta: string[],
  cittaRichiesta: string
): boolean {
  if (pro.keys.length === 0) return pro.citySlug === cittaRichiesta;
  if (pro.keys.some((k) => gettoniRichiesta.includes(k))) return true;

  // SE IL CLIENTE NON HA DETTO LA ZONA, chi ha dichiarato dei quartieri di
  // QUESTA città rientra comunque. Senza questa riga la precisione si
  // punirebbe: un idraulico che dichiara «Navigli e Ticinese» sparirebbe da
  // ogni ricerca in cui il cliente non ha detto il quartiere — cioè, oggi, da
  // tutte: requests.zone_slug è NULL su tutte le richieste in produzione.
  // Trovato con la prova sulle regole, non leggendo il codice.
  const richiestaSenzaZona = !gettoniRichiesta.some((k) => k.startsWith("zone:"));
  if (richiestaSenzaZona) {
    const prefisso = `zone:${cittaRichiesta}/`;
    return pro.keys.some((k) => k.startsWith(prefisso));
  }
  return false;
}

/** Il rango del gettone più preciso che ha fatto match; -1 se nessuno. */
export function rangoCopertura(
  pro: CoperturaPro,
  gettoniRichiesta: string[]
): number {
  if (pro.keys.length === 0) return RANGO_GETTONE.city;
  let migliore = -1;
  for (const k of pro.keys) {
    if (!gettoniRichiesta.includes(k)) continue;
    const r = RANGO_GETTONE[k.split(":")[0]] ?? 0;
    if (r > migliore) migliore = r;
  }
  if (migliore >= 0) return migliore;

  // Richiesta senza zona e professionista a quartieri: vale come chi ha
  // dichiarato la città, non meno (vedi trovaPerRichiesta).
  const richiestaSenzaZona = !gettoniRichiesta.some((k) => k.startsWith("zone:"));
  if (richiestaSenzaZona && pro.keys.some((k) => k.startsWith("zone:"))) {
    return RANGO_GETTONE.city;
  }
  return migliore;
}
