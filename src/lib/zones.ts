// Zone (quartieri) di Milano — l'informazione di posizione grossolana che il
// professionista vede PRIMA di essere scelto. Vedi migrazione 045.
//
// PERCHÉ ESISTE QUESTO FILE INVECE DI UN GEOCODER
// Per calcolare una distanza servono due punti, e un punto sono due numeri.
// Un indirizzo è testo: trasformarlo in numeri (geocoding) richiede un servizio
// esterno, che riceverebbe gli indirizzi dei clienti e diventerebbe un
// responsabile del trattamento — DPA art. 28, regione UE, roadmap 40.0.
// Qui il punto non viene ricavato dall'indirizzo: è il centro di un quartiere,
// che è un fatto pubblico sulla geografia di Milano e non un dato sul cliente.
// Il cliente sceglie "Isola" e noi conserviamo "isola". Nessuna conversione,
// nessun fornitore, e il livello di dettaglio lo decide lui.
//
// PRECISIONE
// Il centro di un quartiere dista fino a ~1 km dall'indirizzo vero. È voluto, e
// non toglie niente alla decisione: fra 6,0 e 6,8 km il professionista sceglie
// uguale. Appena viene accettato riceve via e civico esatti (mig 044).
//
// LE COORDINATE
// `lat`/`lng` sono null finché non gira `scripts/build_milano_zones.py`, che le
// prende dal dataset NIL ufficiale del Comune di Milano (licenza CC-BY) e
// riscrive questo elenco. Senza coordinate il quartiere si vede lo stesso come
// etichetta ("Zona Isola"): si spegne solo la distanza in chilometri. Le
// coordinate non sono scritte a mano di proposito — un nome sbagliato si vede,
// una coordinata sbagliata manda un professionista dall'altra parte della città
// senza che nessuno se ne accorga.

export interface Zone {
  slug: string;
  label: string;
  /** Centro del quartiere. null finché non gira il generatore. */
  lat: number | null;
  lng: number | null;
}

// GENERATO IN PARTE — rigenera con: python3 scripts/build_milano_zones.py
// I nomi sono l'elenco corto e riconoscibile; il generatore li allinea ai NIL
// ufficiali e riempie lat/lng.
export const MILANO_ZONES: Zone[] = [
  { slug: "centro", label: "Centro / Duomo", lat: 45.46371, lng: 9.18695 },
  { slug: "brera", label: "Brera", lat: 45.47425, lng: 9.18816 },
  { slug: "isola", label: "Isola", lat: 45.49089, lng: 9.18962 },
  { slug: "porta-nuova", label: "Porta Nuova / Garibaldi", lat: 45.48359, lng: 9.19058 },
  { slug: "porta-venezia", label: "Porta Venezia", lat: 45.47703, lng: 9.21449 },
  { slug: "porta-romana", label: "Porta Romana", lat: 45.46322, lng: 9.20189 },
  { slug: "navigli", label: "Navigli", lat: 45.43742, lng: 9.15352 },
  { slug: "ticinese", label: "Ticinese", lat: 45.4495, lng: 9.17528 },
  { slug: "sempione", label: "Sempione / Arco della Pace", lat: 45.47413, lng: 9.17625 },
  { slug: "citta-studi", label: "Città Studi", lat: 45.47727, lng: 9.23082 },
  { slug: "lambrate", label: "Lambrate", lat: 45.47929, lng: 9.24966 },
  { slug: "bicocca", label: "Bicocca", lat: 45.51898, lng: 9.21281 },
  { slug: "bovisa", label: "Bovisa", lat: 45.51062, lng: 9.15835 },
  { slug: "affori", label: "Affori", lat: 45.51393, lng: 9.17129 },
  { slug: "niguarda", label: "Niguarda", lat: 45.5167, lng: 9.19612 },
  { slug: "greco", label: "Greco", lat: 45.50349, lng: 9.20952 },
  { slug: "loreto", label: "Loreto", lat: 45.49094, lng: 9.22223 },
  { slug: "corvetto", label: "Corvetto", lat: 45.43648, lng: 9.22845 },
  { slug: "rogoredo", label: "Rogoredo / Santa Giulia", lat: 45.43667, lng: 9.24352 },
  { slug: "barona", label: "Barona", lat: 45.43235, lng: 9.15619 },
  { slug: "famagosta", label: "Famagosta", lat: 45.42994, lng: 9.17844 },
  { slug: "san-siro", label: "San Siro", lat: 45.47138, lng: 9.13836 },
  { slug: "baggio", label: "Baggio", lat: 45.4596, lng: 9.08721 },
  { slug: "quarto-oggiaro", label: "Quarto Oggiaro", lat: 45.51364, lng: 9.13773 },
  { slug: "washington", label: "Washington / De Angeli", lat: 45.47488, lng: 9.14841 },
  { slug: "bande-nere", label: "Bande Nere / Lorenteggio", lat: 45.45563, lng: 9.1292 },
  { slug: "forlanini", label: "Forlanini", lat: 45.45806, lng: 9.25159 },
  { slug: "gratosoglio", label: "Gratosoglio", lat: 45.41169, lng: 9.17119 },
];

const BY_SLUG = new Map(MILANO_ZONES.map((z) => [z.slug, z]));

/** Le zone valgono per Milano: le altre città non ne hanno ancora. */
export function zonesForCity(citySlug: string | null | undefined): Zone[] {
  return citySlug === "milano" ? MILANO_ZONES : [];
}

export function zoneLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return BY_SLUG.get(slug)?.label ?? null;
}

export function zoneCoords(
  slug: string | null | undefined
): { lat: number; lng: number } | null {
  const z = slug ? BY_SLUG.get(slug) : undefined;
  if (!z || z.lat === null || z.lng === null) return null;
  return { lat: z.lat, lng: z.lng };
}

/** Distanza in linea d'aria, in chilometri. Formula dell'emisenoverso. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(la) * Math.cos(lb);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// La distanza è approssimata quanto il centro del quartiere: arrotondarla al
// mezzo chilometro evita di promettere una precisione che non abbiamo. Sotto
// il chilometro e mezzo si dice solo "vicino": scrivere "0,5 km" da un centro
// di quartiere sarebbe una cifra inventata.
export function formatDistance(km: number): string {
  if (km < 1.5) return "vicino a te";
  return `~${(Math.round(km * 2) / 2).toLocaleString("it-IT")} km da te`;
}
