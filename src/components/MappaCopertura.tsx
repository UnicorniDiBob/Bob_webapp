"use client";

// La mappa dell'area di lavoro.
//
// NESSUN FORNITORE, DI PROPOSITO
// Non ci sono tile: né Google, né Mapbox, né MapTiler. Lo sfondo è un colore e
// sopra ci stanno i dati che abbiamo già — i centri dei quartieri (NIL del
// Comune di Milano, CC-BY, migrazione 057) e il cerchio del professionista.
// Motivo: una tile è una richiesta HTTP a un terzo, quindi l'IP del pro e la
// porzione di città che sta guardando escono da Bob. Per scegliere «dove
// lavoro» non serve vedere le strade: servono i quartieri e un raggio.
//
// E NESSUN GLYPH: le etichette dei quartieri sono marcatori HTML, non layer
// symbol. Un layer symbol richiede un server di font, che sarebbe un altro
// terzo a cui uscire.
//
// DUE COSE IMPARATE FACENDOLE SBAGLIATE, il 28/08:
//
// 1. L'INQUADRATURA. La prima versione calcolava i confini della città una
//    volta sola, alla creazione della mappa — quando l'elenco dei quartieri
//    arriva dal database e quindi è ANCORA VUOTO. Risultato: fitBounds non
//    veniva mai chiamato e Milano restava in un angolo. Ora l'inquadratura si
//    tenta ogni volta che i quartieri cambiano, finché non riesce.
//
// 2. IL RIDIMENSIONAMENTO. Una mappa creata prima che il contenitore abbia la
//    sua altezza definitiva tiene per sempre le dimensioni sbagliate: il
//    centro non è più al centro. Serve map.resize() a ogni cambio di taglia —
//    un ResizeObserver, non un solo controllo all'avvio.
//
// 3. LE ETICHETTE. Venti pastiglie con il nome del quartiere, in tre
//    chilometri, sono un muro di testo che copre il cerchio. Sotto un certo
//    ingrandimento restano pallini: il nome compare zoomando, passandoci
//    sopra, e nelle pastiglie sotto la mappa, dove c'è spazio.

import { useCallback, useEffect, useRef } from "react";
import {
  Map as MappaLibre,
  Marker,
  NavigationControl,
  LngLatBounds,
  type StyleSpecification,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ComuneRow, ZonaRow } from "@/lib/copertura";
import {
  dentroForma,
  leggiConfini,
  percorsoProvincia,
  type FormaComune,
} from "@/lib/confini";
import {
  MAX_PROVINCE_APERTE,
  PERCORSO_ITALIA,
  ZOOM_COMUNI,
  leggiProvince,
  provinceNelRiquadro,
  siToccano,
  unisciForme,
  type FormaProvincia,
  type Riquadro,
} from "@/lib/italia";

/**
 * La forma dei quartieri, se il file c'è.
 *
 * PERCHÉ UN FILE NOSTRO E NON DELLE TILE. «Non si vede proprio Milano sotto»
 * (28/08): con i soli centri dei quartieri la mappa è uno spruzzo di pallini.
 * Per vedere la città serve la sua geometria, e la prendiamo dal perimetro dei
 * NIL pubblicato dal Comune in CC-BY — un file servito dal nostro dominio,
 * non tile di un terzo a cui uscirebbero l'IP del professionista e la porzione
 * di città che sta guardando. Lo scarica scripts/build_milano_nil_geojson.py,
 * e scripts/build_milano_nil_zones.py gli aggiunge la slug del nucleo — la
 * stessa che sta in city_zones: è così che una forma sa di essere dentro
 * l'area del professionista.
 *
 * PERCHÉ DISEGNATI IN SVG E NON COME LAYER. Una sorgente geojson di maplibre
 * viene analizzata in un web worker, e nel bundle di produzione di Next quel
 * worker non viene emesso: la sorgente resta «non caricata» per sempre, senza
 * errore (già inciampato con il cerchio). Un SVG sopra la tela non ha bisogno
 * di nessun worker: si proiettano i vertici con map.project a ogni movimento.
 *
 * SE IL FILE NON C'È non succede niente: restano i pallini, come prima. È il
 * caso di Roma e Torino, che i quartieri non li hanno ancora.
 */
interface Quartiere {
  /** La slug del nucleo (griglia della 084). */
  zona: string | null;
  /** Il nome corto di prima a cui il nucleo appartiene, quando ce n'è uno. */
  gruppo: string | null;
  anelli: [number, number][][];
  riquadro: [number, number, number, number];
  pronti: Float64Array[];
}

/** Il riquadro di un gruppo di anelli. */
function riquadroDi(anelli: [number, number][][]): [number, number, number, number] {
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
  return [ovest, sud, est, nord];
}

interface Props {
  zone: ZonaRow[];
  centro: { lat: number; lng: number } | null;
  raggioM: number;
  selezionate: string[];
  /** Se falso la mappa si guarda ma non si tocca (ambiti larghi). */
  interattivo?: boolean;
  /** Il cerchio si sposta: trascinando il perno o cliccando la mappa. */
  onCentro?: (c: { lat: number; lng: number }) => void;
  /** Click su un quartiere. */
  onZona?: (slug: string) => void;

  // ----- Fuori dalla città: i comuni (087, blocco 5) -----
  /** I comuni della provincia, per il nome e per il centro. */
  comuni?: ComuneRow[];
  /** I comuni dichiarati, per codice ISTAT. */
  comuniSelezionati?: string[];
  /** La sigla della provincia da disegnare: la mappa si carica il suo file. */
  siglaProvincia?: string | null;
  /** Click su un comune. */
  onComune?: (istat: string) => void;
  /**
   * Se vero le forme si cliccano; se falso il click sulla mappa sposta il
   * centro del cerchio, anche sopra una forma. Non possono valere insieme: in
   * modo cerchio il bersaglio è la mappa, in modo manuale sono le aree.
   */
  formeCliccabili?: boolean;
}

/** L'inquadratura di adesso, come riquadro. */
function vista(m: MappaLibre): Riquadro {
  const b = m.getBounds();
  return { ovest: b.getWest(), sud: b.getSouth(), est: b.getEast(), nord: b.getNorth() };
}

/**
 * IL DISEGNO, E PERCHÉ È FATTO COSÌ (18/09).
 *
 * La prima versione proiettava ogni vertice con `map.project()` e dava un
 * tracciato SVG a ogni forma. Con una provincia sola si reggeva; con l'Italia
 * e sei province aperte sono ~100.000 vertici e ~1.000 nodi nel DOM a ogni
 * fotogramma, e la mappa ha cominciato a strappare. Tre misure, in ordine di
 * quanto rendono:
 *
 * 1. I VERTICI SI PROIETTANO UNA VOLTA SOLA, quando il file arriva. In
 *    Mercatore la X dipende solo dalla longitudine e la Y solo dalla
 *    latitudine, e lo schermo è una trasformazione LINEARE di quelle due —
 *    finché la mappa non è ruotata né inclinata, che qui non succede mai
 *    (la bussola è disattivata). Quindi ogni vertice diventa due numeri in un
 *    Float64Array, e a ogni fotogramma resta una moltiplicazione e una somma:
 *    niente trigonometria, niente allocazioni, niente chiamate a maplibre.
 *    Se la mappa risulta ruotata o inclinata si torna a `map.project()`.
 *
 * 2. UN TRACCIATO SOLO PER PIANO, non uno per forma. Le forme spente hanno
 *    tutte lo stesso colore: stanno in un `<path>` unico, e cambia una
 *    stringa invece di mille attributi. Restano separate solo quelle accese,
 *    che sono poche e devono avere il loro colore.
 *
 * 3. SI ARROTONDA AL PIXEL E SI SALTANO I DOPPIONI. Due vertici che cadono
 *    sullo stesso pixel sono un vertice: a livello nazionale un confine da
 *    220 punti ne lascia una quarantina. È una semplificazione che si adatta
 *    all'ingrandimento senza precalcolare niente.
 */

/** Y di Mercatore. La X è la longitudine stessa: la trasformazione la assorbe. */
function mercatoreY(lat: number): number {
  const chiusa = lat > 85.05 ? 85.05 : lat < -85.05 ? -85.05 : lat;
  return Math.log(Math.tan(Math.PI / 4 + (chiusa * Math.PI) / 360));
}

function latDaMercatore(y: number): number {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

/** Gli anelli pronti per il disegno: [lng, mercatoreY] di fila. */
function preparaAnelli(anelli: [number, number][][]): Float64Array[] {
  return anelli.map((anello) => {
    const piatto = new Float64Array(anello.length * 2);
    for (let i = 0; i < anello.length; i++) {
      piatto[i * 2] = anello[i][0];
      piatto[i * 2 + 1] = mercatoreY(anello[i][1]);
    }
    return piatto;
  });
}

interface Trasformazione {
  ax: number;
  ay: number;
  lng0: number;
  y0: number;
  kx: number;
  ky: number;
}

/**
 * La trasformazione di questo fotogramma, tarata su due punti veri chiesti a
 * maplibre. Torna null se la mappa è ruotata o inclinata: lì non è più una
 * retta e si ricade su project(), che è lento ma giusto.
 */
function calibra(m: MappaLibre): Trasformazione | null {
  if (m.getBearing() !== 0 || m.getPitch() !== 0) return null;
  const c = m.getCenter();
  const passo = 0.05;
  const a = m.project([c.lng, c.lat]);
  const b = m.project([c.lng + passo, c.lat + passo]);
  const y0 = mercatoreY(c.lat);
  const dy = mercatoreY(c.lat + passo) - y0;
  if (dy === 0) return null;
  return {
    ax: a.x,
    ay: a.y,
    lng0: c.lng,
    y0,
    kx: (b.x - a.x) / passo,
    ky: (b.y - a.y) / dy,
  };
}

/**
 * Da anelli pronti a `d` di SVG. Arrotonda al pixel e salta i doppioni: è lì
 * che si recupera la maggior parte del lavoro a ingrandimento basso.
 */
function traccia(
  anelli: Float64Array[],
  t: Trasformazione | null,
  m: MappaLibre
): string {
  let d = "";
  for (const anello of anelli) {
    let px = NaN;
    let py = NaN;
    let quanti = 0;
    let pezzo = "";
    for (let i = 0; i < anello.length; i += 2) {
      let x: number;
      let y: number;
      if (t) {
        x = Math.round(t.ax + (anello[i] - t.lng0) * t.kx);
        y = Math.round(t.ay + (anello[i + 1] - t.y0) * t.ky);
      } else {
        const q = m.project([anello[i], latDaMercatore(anello[i + 1])]);
        x = Math.round(q.x);
        y = Math.round(q.y);
      }
      if (x === px && y === py) continue;
      pezzo += (quanti === 0 ? "M" : "L") + x + "," + y;
      px = x;
      py = y;
      quanti++;
    }
    // Un triangolo è il minimo che racchiuda qualcosa: sotto, la forma è
    // sparita nell'arrotondamento e non vale il tracciato.
    if (quanti >= 3) d += pezzo + "Z";
  }
  return d;
}

/** Una forma pronta: i gradi per il click, i numeri di Mercatore per il disegno. */
interface Disegnabile {
  chiave: string;
  nome: string;
  riquadro: [number, number, number, number];
  anelli: [number, number][][];
  pronti: Float64Array[];
}

const SFONDO: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "sfondo", type: "background", paint: { "background-color": "#f4f4f1" } },
  ],
};

/** Sotto questo ingrandimento i quartieri sono pallini senza nome. */
/**
 * Quante province di comuni si tengono in memoria. Sopra questo numero le meno
 * utili si buttano: sono ~50 KB di forme l'una, e tenerle tutte vorrebbe dire
 * arrivare ai sei megabyte dell'Italia intera un pezzo per volta.
 */
const MAX_PROVINCE_IN_MEMORIA = 10;

const ZOOM_ETICHETTE = 12;

/**
 * E soprattutto: oltre questo numero di zone incluse, NESSUNA etichetta.
 *
 * La prima regola guardava solo lo zoom, e non bastava: con il raggio al
 * massimo sono incluse tutte e 28 le zone, quindi 28 pastiglie una sull'altra
 * — la mappa diventava un muro di nomi (segnalato il 28/08, seconda volta).
 * Quando le zone sono tante il nome di ognuna non serve: serve sapere quante
 * sono, e quello lo dice il contatore in un angolo. I nomi stanno nelle
 * pastiglie sotto la mappa, dove c'e' spazio per venti righe.
 */
const MAX_ETICHETTE = 6;

export default function MappaCopertura({
  zone,
  centro,
  raggioM,
  selezionate,
  interattivo = true,
  onCentro,
  onZona,
  comuni = [],
  comuniSelezionati = [],
  siglaProvincia = null,
  onComune,
  formeCliccabili = false,
}: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const mappa = useRef<MappaLibre | null>(null);
  const marcatori = useRef<Record<string, Marker>>({});
  const perno = useRef<Marker | null>(null);
  const alone = useRef<HTMLDivElement | null>(null);
  const inquadrato = useRef(false);
  const contatore = useRef<HTMLDivElement | null>(null);
  const quartieri = useRef<Quartiere[]>([]);
  const svg = useRef<SVGSVGElement | null>(null);
  const gruppoComuni = useRef<SVGGElement | null>(null);
  const gruppoQuartieri = useRef<SVGGElement | null>(null);
  const tracciati = useRef<Map<string, SVGPathElement>>(new Map());
  const forme = useRef<Disegnabile[]>([]);
  const tracciatiComuni = useRef<Map<string, SVGPathElement>>(new Map());
  /** Il tracciato unico delle forme spente, uno per piano. */
  const spentiComuni = useRef<SVGPathElement | null>(null);
  const spentiQuartieri = useRef<SVGPathElement | null>(null);
  const spentiProvince = useRef<SVGPathElement | null>(null);
  const targhetta = useRef<HTMLDivElement | null>(null);
  const sopraRitmato = useRef(false);
  const disegnoInCoda = useRef(false);

  // L'ITALIA DI SFONDO E LE PROVINCE APERTE (17/09).
  // `province` sono le 110 forme dello sfondo, caricate una volta sola;
  // `comuniPerSigla` è quello che si è scaricato finora, una provincia per
  // chiave; `forme` resta l'elenco piatto su cui si disegna e si cerca il
  // click, e adesso è la somma delle province aperte invece di una sola.
  const province = useRef<(FormaProvincia & { pronti: Float64Array[] })[]>([]);
  const gruppoProvince = useRef<SVGGElement | null>(null);
  const comuniPerSigla = useRef<Map<string, FormaComune[]>>(new Map());
  const inCorso = useRef<Set<string>>(new Set());
  const siglaRef = useRef<string | null>(siglaProvincia);
  siglaRef.current = siglaProvincia;

  // Dati e callback in ref: gli handler si registrano una volta sola e vedono
  // sempre l'ultima versione, senza ricreare la mappa a ogni render.
  const zoneRef = useRef(zone);
  const selRef = useRef(selezionate);
  const cbCentro = useRef(onCentro);
  const cbZona = useRef(onZona);
  const cbInterattivo = useRef(interattivo);
  const comuniRef = useRef(comuni);
  const selComuniRef = useRef(comuniSelezionati);
  const cbComune = useRef(onComune);
  const cliccabiliRef = useRef(formeCliccabili);
  zoneRef.current = zone;
  selRef.current = selezionate;
  cbCentro.current = onCentro;
  cbZona.current = onZona;
  cbInterattivo.current = interattivo;
  comuniRef.current = comuni;
  selComuniRef.current = comuniSelezionati;
  cbComune.current = onComune;
  cliccabiliRef.current = formeCliccabili;

  /**
   * Inquadra quello che c'è da guardare: i quartieri se la città ne ha, se no
   * i comuni della provincia. Torna false se non è ancora arrivato niente —
   * succede sempre al primo giro, perché i dati vengono dal database e la
   * mappa nasce prima (imparato il 28/08: fitBounds su un elenco vuoto non
   * fallisce, semplicemente non fa niente, e Milano resta in un angolo).
   */
  const inquadra = useCallback((m: MappaLibre) => {
    const b = new LngLatBounds();
    let punti = 0;
    zoneRef.current.forEach((z) => {
      if (z.lat === null || z.lng === null) return;
      b.extend([z.lng, z.lat]);
      punti++;
    });
    if (punti === 0) {
      comuniRef.current.forEach((c) => {
        if (c.lat === null || c.lng === null) return;
        b.extend([c.lng, c.lat]);
        punti++;
      });
    }
    if (punti === 0) return false;
    m.fitBounds(b, { padding: 44, animate: false, maxZoom: 13 });
    return true;
  }, []);

  const disegnaMarcatori = useCallback(() => {
    const m = mappa.current;
    if (!m) return;
    const dentro = new Set(selRef.current);
    const conNome =
      m.getZoom() >= ZOOM_ETICHETTE && dentro.size > 0 && dentro.size <= MAX_ETICHETTE;
    // A livello nazionale gli 88 pallini dei quartieri di Milano cadono tutti
    // sullo stesso punto: sono 88 elementi che il browser dispone e ridipinge
    // a ogni fotogramma per mostrare una macchia grande tre pixel.
    const visibili = m.getZoom() >= ZOOM_COMUNI;

    zoneRef.current.forEach((z) => {
      if (z.lat === null || z.lng === null) return;
      let mk = marcatori.current[z.slug];
      if (!mk) {
        // La radice appartiene a maplibre (ci mette maplibregl-marker, che è
        // quella che la rende position:absolute): lo stile nostro va su un
        // figlio, altrimenti i marcatori si impilano in cima al contenitore.
        const radice = document.createElement("div");
        const bottone = document.createElement("button");
        bottone.type = "button";
        bottone.dataset.zona = z.slug;
        bottone.addEventListener("click", (ev) => {
          ev.stopPropagation();
          cbZona.current?.(z.slug);
        });
        radice.appendChild(bottone);
        mk = new Marker({ element: radice }).setLngLat([z.lng, z.lat]).addTo(m);
        marcatori.current[z.slug] = mk;
      }

      mk.getElement().style.display = visibili ? "" : "none";
      if (!visibili) return;

      const bottone = mk.getElement().firstElementChild as HTMLButtonElement;
      const attiva = dentro.has(z.slug);
      const corto = z.label.split(" / ")[0];
      const etichetta = attiva && conNome;

      bottone.className = etichetta
        ? "whitespace-nowrap rounded-full border border-bob-indigo bg-bob-indigo px-2 py-0.5 text-2xs font-medium text-white shadow-sm"
        : attiva
          ? "h-3.5 w-3.5 rounded-full border-2 border-white bg-bob-indigo shadow"
          : "h-3 w-3 rounded-full border border-black/25 bg-white/90 shadow-sm hover:border-bob-indigo";
      bottone.title = attiva ? `${z.label} — dentro la tua area` : z.label;
      bottone.setAttribute("aria-label", z.label);
      bottone.setAttribute("aria-pressed", attiva ? "true" : "false");
      bottone.textContent = etichetta ? corto : "";
    });

    // Il contatore: c'e' solo quando i nomi non ci sono.
    if (!contatore.current) {
      const el = document.createElement("div");
      el.className =
        "pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-bob-ink/70 shadow-sm";
      m.getCanvasContainer().appendChild(el);
      contatore.current = el;
    }
    // Il contatore parla della griglia che si sta usando: dove non ci sono
    // quartieri — cioè fuori dalle città che li pubblicano — dire «nessuna
    // zona» sarebbe falso e scoraggiante, mentre i comuni ci sono eccome.
    const badge = contatore.current;
    const comuniDentro = selComuniRef.current.length;
    const senzaQuartieri = zoneRef.current.length === 0;

    if (senzaQuartieri) {
      badge.textContent =
        comuniDentro === 0
          ? "Nessun comune nella tua area"
          : comuniDentro === 1
            ? "1 comune nella tua area"
            : `${comuniDentro} comuni nella tua area`;
      badge.style.display = "block";
    } else if (dentro.size === 0) {
      badge.textContent = "Nessuna zona nella tua area";
      badge.style.display = "block";
    } else if (!conNome) {
      badge.textContent =
        comuniDentro > 0
          ? `${dentro.size} zone e ${comuniDentro} comuni nella tua area`
          : `${dentro.size} zone nella tua area`;
      badge.style.display = "block";
    } else {
      badge.style.display = "none";
    }
  }, []);

  /**
   * Ridisegna i comuni della provincia. Stesso mestiere dei quartieri, con una
   * differenza: qui le forme SI CLICCANO. Un comune è un bersaglio grande e
   * riconoscibile, mentre un pallino da tre pixel su una provincia larga
   * cinquanta chilometri non lo è — e chi sceglie i comuni a mano ne tocca
   * dieci o venti, non uno.
   */
  /**
   * LO SFONDO: l'Italia, sempre acceso.
   *
   * PERCHÉ. Con una sola provincia disegnata, chi allarga la mappa vede la
   * propria città sospesa nel vuoto — segnalato il 17/09 con lo screenshot.
   * Queste sono le 110 forme di provincia: 138 KB compressi, una volta sola,
   * e a qualsiasi ingrandimento sotto c'è l'Italia.
   *
   * SI DISEGNA SOLO QUELLO CHE SI VEDE. Le 110 forme sono 24.000 vertici: a
   * proiettarli tutti a ogni fotogramma il trascinamento si sentirebbe.
   * Il riquadro di ogni provincia — che sta nel file — dice in un confronto se
   * vale la pena proiettarla.
   */
  const disegnaProvince = useCallback(() => {
    const m = mappa.current;
    const gruppo = gruppoProvince.current;
    if (!m || !gruppo || province.current.length === 0) return;
    const v = vista(m);
    const t = calibra(m);

    let path = spentiProvince.current;
    if (!path) {
      path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("fill", "rgba(255,255,255,0.62)");
      path.setAttribute("stroke", "rgba(0,0,0,0.2)");
      path.setAttribute("stroke-width", "0.8");
      path.setAttribute("stroke-linejoin", "round");
      gruppo.appendChild(path);
      spentiProvince.current = path;
    }

    let d = "";
    for (const p of province.current) {
      if (!siToccano(v, p.riquadro)) continue;
      d += traccia(p.pronti, t, m);
    }
    path.setAttribute("d", d);
  }, []);

  /**
   * `forme` è la somma delle province caricate. Cambia di numero e di ordine
   * ogni volta che se ne apre una, quindi i tracciati vecchi si buttano tutti:
   * riusarli per indice disegnerebbe il comune sbagliato.
   */
  const rinfrescaForme = useCallback(() => {
    const unite = unisciForme(comuniPerSigla.current, [
      ...comuniPerSigla.current.keys(),
    ]);
    // Si proietta qui, una volta per file, non a ogni fotogramma.
    forme.current = unite.map((f: FormaComune) => ({
      chiave: f.istat,
      nome: f.nome,
      riquadro: f.riquadro,
      anelli: f.anelli,
      pronti: preparaAnelli(f.anelli),
    }));
    tracciatiComuni.current.forEach((t) => t.remove());
    tracciatiComuni.current = new Map();
  }, []);

  const disegnaComuni = useCallback(() => {
    const m = mappa.current;
    const gruppo = gruppoComuni.current;
    if (!m || !gruppo) return;

    let spento = spentiComuni.current;
    if (!spento) {
      spento = document.createElementNS("http://www.w3.org/2000/svg", "path");
      spento.setAttribute("fill", "rgba(255,255,255,0.5)");
      spento.setAttribute("stroke", "rgba(0,0,0,0.16)");
      spento.setAttribute("stroke-width", "0.9");
      spento.setAttribute("stroke-linejoin", "round");
      gruppo.appendChild(spento);
      spentiComuni.current = spento;
    }

    // SOTTO LO ZOOM 8 I COMUNI NON SI DISEGNANO. Prima il controllo c'era solo
    // sul CARICAMENTO: le province già in memoria continuavano a disegnarsi a
    // livello nazionale, dove 780 forme diventano una macchia grigia sul nord
    // Italia — visibile nello screenshot del 18/09 — e costano tutto il
    // fotogramma per non far vedere niente.
    if (forme.current.length === 0 || m.getZoom() < ZOOM_COMUNI) {
      spento.setAttribute("d", "");
      tracciatiComuni.current.forEach((t) => t.remove());
      tracciatiComuni.current = new Map();
      return;
    }

    const dentro = new Set(selComuniRef.current);
    const v = vista(m);
    const t = calibra(m);
    const vive = new Set<string>();
    let d = "";

    for (const forma of forme.current) {
      // Fuori dall'inquadratura non si proietta: con sei province aperte sono
      // qualche migliaio di forme, e il trascinamento si sentirebbe.
      if (!siToccano(v, forma.riquadro)) continue;
      const pezzo = traccia(forma.pronti, t, m);
      if (!pezzo) continue;

      if (!dentro.has(forma.chiave)) {
        // Le spente hanno tutte lo stesso colore: un tracciato solo.
        d += pezzo;
        continue;
      }

      // Le accese hanno il loro, e sono poche.
      vive.add(forma.chiave);
      let path = tracciatiComuni.current.get(forma.chiave);
      if (!path) {
        path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("fill", "rgba(79,70,229,0.22)");
        path.setAttribute("stroke", "#4f46e5");
        path.setAttribute("stroke-width", "1.4");
        path.setAttribute("stroke-linejoin", "round");
        gruppo.appendChild(path);
        tracciatiComuni.current.set(forma.chiave, path);
      }
      path.setAttribute("d", pezzo);
    }

    spento.setAttribute("d", d);
    tracciatiComuni.current.forEach((path, chiave) => {
      if (vive.has(chiave)) return;
      path.remove();
      tracciatiComuni.current.delete(chiave);
    });
    // Nessun evento sui tracciati: se il disegno prendesse i click,
    // trascinare la mappa sopra un comune smetterebbe di funzionare — ed è il
    // gesto che si fa più spesso. Il click resta della mappa, che poi chiede a
    // dentroForma() quale area è stata toccata.
  }, []);

  /** Ridisegna i quartieri. Stessa struttura dei comuni: uno spento, N accesi. */
  const disegnaQuartieri = useCallback(() => {
    const m = mappa.current;
    const contenitore = svg.current;
    const gruppo = gruppoQuartieri.current ?? contenitore;
    if (!m || !gruppo || quartieri.current.length === 0) return;

    let spento = spentiQuartieri.current;
    if (!spento) {
      spento = document.createElementNS("http://www.w3.org/2000/svg", "path");
      spento.setAttribute("fill", "rgba(255,255,255,0.55)");
      spento.setAttribute("stroke", "rgba(0,0,0,0.14)");
      spento.setAttribute("stroke-width", "1");
      spento.setAttribute("stroke-linejoin", "round");
      gruppo.appendChild(spento);
      spentiQuartieri.current = spento;
    }

    const dentro = new Set(selRef.current);
    const v = vista(m);
    const t = calibra(m);
    const vive = new Set<string>();
    let d = "";

    quartieri.current.forEach((q, i) => {
      if (!siToccano(v, q.riquadro)) return;
      const pezzo = traccia(q.pronti, t, m);
      if (!pezzo) return;

      // Si accende sul nucleo O sul gruppo: prima che la 084 sia applicata le
      // zone salvate sono ancora i 28 nomi corti, e senza il gruppo la forma
      // resterebbe spenta su un'area che il professionista copre davvero.
      const attiva =
        (q.zona !== null && dentro.has(q.zona)) ||
        (q.gruppo !== null && dentro.has(q.gruppo));
      if (!attiva) {
        d += pezzo;
        return;
      }

      const chiave = q.zona ?? q.gruppo ?? String(i);
      vive.add(chiave);
      let path = tracciati.current.get(chiave);
      if (!path) {
        path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("fill", "rgba(79,70,229,0.28)");
        path.setAttribute("stroke", "#4f46e5");
        path.setAttribute("stroke-width", "1.4");
        path.setAttribute("stroke-linejoin", "round");
        gruppo.appendChild(path);
        tracciati.current.set(chiave, path);
      }
      path.setAttribute("d", pezzo);
    });

    spento.setAttribute("d", d);
    tracciati.current.forEach((path, chiave) => {
      if (vive.has(chiave)) return;
      path.remove();
      tracciati.current.delete(chiave);
    });
  }, []);

  /** Un disegno per fotogramma: trascinare la mappa non deve ingolfarsi. */
  const disegnaQuartieriRitmato = useCallback(() => {
    if (disegnoInCoda.current) return;
    disegnoInCoda.current = true;
    requestAnimationFrame(() => {
      disegnoInCoda.current = false;
      disegnaProvince();
      disegnaComuni();
      disegnaQuartieri();
    });
  }, [disegnaProvince, disegnaComuni, disegnaQuartieri]);

  /**
   * QUALI PROVINCE TENERE APERTE.
   *
   * L'Italia intera a livello di comune sono sei megabyte: non si spediscono a
   * un idraulico che sceglie un raggio. Ma una provincia sola non basta — chi
   * lavora a Monza copre anche Milano e Como, e prima di oggi vedeva solo la
   * Brianza. Quindi: si caricano le province che stanno nell'inquadratura, al
   * massimo sei, e solo da un certo ingrandimento in su. Sotto, lo sfondo
   * delle province è già il disegno giusto e i confini comunali sarebbero
   * righe da mezzo pixel.
   *
   * COSA NON SI BUTTA MAI: la provincia della base del professionista e quelle
   * dove ha già acceso un comune. Se si buttassero, la sua scelta sparirebbe
   * dallo schermo appena sposta la mappa — e sembrerebbe cancellata.
   */
  const aggiornaProvinceAperte = useCallback(() => {
    const m = mappa.current;
    if (!m || province.current.length === 0) return;
    if (m.getZoom() < ZOOM_COMUNI) return;

    const selezionati = new Set(selComuniRef.current);
    const intoccabili = new Set<string>();
    if (siglaRef.current) intoccabili.add(siglaRef.current.toUpperCase());
    comuniPerSigla.current.forEach((elenco, sigla) => {
      if (elenco.some((f) => selezionati.has(f.istat))) intoccabili.add(sigla);
    });

    const volute = provinceNelRiquadro(
      province.current,
      vista(m),
      MAX_PROVINCE_APERTE,
      [...intoccabili]
    );

    volute.forEach((sigla) => {
      if (comuniPerSigla.current.has(sigla) || inCorso.current.has(sigla)) return;
      inCorso.current.add(sigla);
      fetch(percorsoProvincia(sigla))
        .then((r) => (r.ok ? r.json() : null))
        .then((dati) => {
          inCorso.current.delete(sigla);
          if (!dati || !mappa.current) return;
          comuniPerSigla.current.set(sigla, leggiConfini(dati));

          // Si fa spazio: le province che non servono più e che non tengono
          // niente di acceso escono, le più vecchie per prime.
          const salve = new Set([...volute, ...intoccabili]);
          for (const vecchia of [...comuniPerSigla.current.keys()]) {
            if (comuniPerSigla.current.size <= MAX_PROVINCE_IN_MEMORIA) break;
            if (salve.has(vecchia)) continue;
            comuniPerSigla.current.delete(vecchia);
          }

          rinfrescaForme();
          disegnaComuni();
        })
        // Un file che manca non è un errore da mostrare: quella provincia
        // resta senza comuni e la mappa continua a funzionare.
        .catch(() => {
          inCorso.current.delete(sigla);
        });
    });
  }, [rinfrescaForme, disegnaComuni]);

  // 1. Creazione, una volta.
  useEffect(() => {
    const contenitore = box.current;
    if (!contenitore || mappa.current) return;

    const m = new MappaLibre({
      container: contenitore,
      style: SFONDO,
      center: [9.19, 45.4642],
      zoom: 11,
      attributionControl: {
        compact: true,
        customAttribution:
        "Quartieri: NIL Comune di Milano (CC-BY) · Comuni: confini ISTAT (CC BY 4.0)",
      },
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mappa.current = m;

    // Il piano dei quartieri sta SOTTO i marcatori e non intercetta i click:
    // i bersagli restano i pallini.
    // SUBITO SOPRA LA TELA, non sotto: la tela dipinge uno sfondo opaco, e un
    // SVG messo prima di lei non si vede (provato: 28 tracciati nel DOM, con i
    // colori giusti, e niente sullo schermo). I marcatori vengono aggiunti dopo
    // e restano quindi al di sopra; l'SVG non intercetta i click.
    const canvas = m.getCanvas();
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("class", "pointer-events-none absolute inset-0 h-full w-full");
    // Tre piani, in quest'ordine: l'Italia sotto, poi i comuni, poi i
    // quartieri. È una carta a tre scale: allargando resta il paese, entrando
    // compaiono i comuni, dentro Milano i nuclei. Quella fine deve restare
    // leggibile — e cliccabile — sopra quelle larghe.
    const gProvince = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const gComuni = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const gQuartieri = document.createElementNS("http://www.w3.org/2000/svg", "g");
    s.appendChild(gProvince);
    s.appendChild(gComuni);
    s.appendChild(gQuartieri);
    gruppoProvince.current = gProvince;
    gruppoComuni.current = gComuni;
    gruppoQuartieri.current = gQuartieri;
    canvas.parentNode?.insertBefore(s, canvas.nextSibling);
    svg.current = s;

    let vivo = true;

    // L'ITALIA, una volta sola: da qui in poi lo sfondo c'è a ogni
    // ingrandimento, e i riquadri dentro il file dicono quali province di
    // comuni valga la pena chiedere.
    fetch(PERCORSO_ITALIA)
      .then((r) => (r.ok ? r.json() : null))
      .then((dati) => {
        if (!vivo || !dati) return;
        province.current = leggiProvince(dati).map((p) => ({
          ...p,
          pronti: preparaAnelli(p.anelli),
        }));
        disegnaProvince();
        aggiornaProvinceAperte();
      })
      .catch(() => null);

    fetch("/geo/milano-nil.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((dati) => {
        if (!vivo || !dati) return;
        quartieri.current = (dati.features ?? [])
          .map((f: {
            properties?: {
              slug?: string | null;
              zona?: string | null;
              gruppo?: string | null;
            };
            geometry?: { type?: string; coordinates?: unknown };
          }) => {
            const g = f.geometry;
            let anelli: [number, number][][] = [];
            if (g?.type === "MultiPolygon") {
              anelli = (g.coordinates as [number, number][][][]).map((p) => p[0]);
            } else if (g?.type === "Polygon") {
              anelli = [(g.coordinates as [number, number][][])[0]];
            }
            // `slug` è il nucleo (la griglia della 084), `gruppo` il nome
            // corto di prima: si tengono tutti e due, così la mappa si accende
            // sia con le zone vecchie sia con quelle nuove.
            return {
              zona: f.properties?.slug ?? f.properties?.zona ?? null,
              gruppo: f.properties?.gruppo ?? f.properties?.zona ?? null,
              anelli,
              riquadro: riquadroDi(anelli),
              pronti: preparaAnelli(anelli),
            };
          })
          .filter((q: Quartiere) => q.anelli.length > 0);
        disegnaQuartieri();
      })
      .catch(() => null);

    m.on("load", () => {
      inquadrato.current = inquadra(m);
      disegnaMarcatori();
      disegnaProvince();
      disegnaComuni();
      disegnaQuartieri();
      aggiornaProvinceAperte();
    });
    // Le province si chiedono a movimento finito, non durante: mentre si
    // trascina l'inquadratura cambia sessanta volte al secondo, e sarebbero
    // sessanta richieste per un file solo che serve.
    m.on("moveend", aggiornaProvinceAperte);
    m.on("move", disegnaQuartieriRitmato);
    m.on("zoom", disegnaQuartieriRitmato);
    m.on("resize", disegnaQuartieriRitmato);
    m.on("zoomend", disegnaMarcatori);
    /**
     * CHI C'È SOTTO IL PUNTATORE.
     *
     * Il click resta della mappa e non dei tracciati (vedi disegnaComuni), e a
     * dire quale area è stata toccata è un point-in-polygon. Con l'Italia e sei
     * province aperte sono qualche migliaio di forme: si guarda PRIMA il
     * riquadro, che è un confronto fra numeri, e il ray casting vero tocca a
     * una o due forme. Senza questo filtro il conto girava a ogni movimento del
     * mouse, e si sentiva.
     */
    const sotto = (punto: { lng: number; lat: number }) => {
      for (const q of quartieri.current) {
        if (q.zona === null) continue;
        const r = q.riquadro;
        if (punto.lng < r[0] || punto.lng > r[2] || punto.lat < r[1] || punto.lat > r[3]) {
          continue;
        }
        if (dentroForma(punto, q.anelli)) return { zona: q.zona, nome: null as string | null };
      }
      if (m.getZoom() >= ZOOM_COMUNI) {
        for (const c of forme.current) {
          const r = c.riquadro;
          if (punto.lng < r[0] || punto.lng > r[2] || punto.lat < r[1] || punto.lat > r[3]) {
            continue;
          }
          if (dentroForma(punto, c.anelli)) return { comune: c.chiave, nome: c.nome };
        }
      }
      return null;
    };

    m.on("click", (e: MapMouseEvent) => {
      const punto = { lat: e.lngLat.lat, lng: e.lngLat.lng };

      // In modo manuale il click accende l'area toccata. Si guarda prima il
      // quartiere e poi il comune: dentro Milano le due griglie stanno una
      // sopra l'altra, e quella fine è quella che il professionista intende.
      if (cliccabiliRef.current) {
        const bersaglio = sotto(punto) as
          | { zona?: string; comune?: string; nome: string | null }
          | null;
        if (bersaglio?.zona) cbZona.current?.(bersaglio.zona);
        else if (bersaglio?.comune) cbComune.current?.(bersaglio.comune);
        return;
      }

      if (cbInterattivo.current) {
        cbCentro.current?.(punto);
      }
    });

    // Il puntatore dice se lì sotto c'è qualcosa da accendere, e la targhetta
    // dice cosa. Un fotogramma per volta: mousemove arriva a raffica.
    m.on("mousemove", (e: MapMouseEvent) => {
      if (!cliccabiliRef.current) {
        m.getCanvas().style.cursor = "";
        if (targhetta.current) targhetta.current.style.display = "none";
        return;
      }
      if (sopraRitmato.current) return;
      sopraRitmato.current = true;
      const punto = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      requestAnimationFrame(() => {
        sopraRitmato.current = false;
        const bersaglio = sotto(punto) as { nome: string | null } | null;
        m.getCanvas().style.cursor = bersaglio ? "pointer" : "";

        if (!targhetta.current) {
          const el = document.createElement("div");
          el.className =
            "pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-bob-ink/80 shadow-sm";
          el.style.display = "none";
          m.getCanvasContainer().appendChild(el);
          targhetta.current = el;
        }
        // Il nome del comune: prima stava in un <title> per forma, che adesso
        // non c'è più perché le forme spente condividono un tracciato solo.
        // Questo si vede subito, invece di aspettare il secondo del browser.
        if (bersaglio?.nome) {
          targhetta.current.textContent = bersaglio.nome;
          targhetta.current.style.display = "";
        } else {
          targhetta.current.style.display = "none";
        }
      });
    });

    // Il contenitore cambia taglia (layout, rotazione, apertura di una
    // sezione): senza resize() la mappa tiene le dimensioni vecchie e il
    // centro non è al centro.
    const osservatore = new ResizeObserver(() => {
      m.resize();
      if (!inquadrato.current) inquadrato.current = inquadra(m);
    });
    osservatore.observe(contenitore);

    return () => {
      vivo = false;
      osservatore.disconnect();
      m.off("moveend", aggiornaProvinceAperte);
      m.off("move", disegnaQuartieriRitmato);
      m.off("zoom", disegnaQuartieriRitmato);
      m.off("resize", disegnaQuartieriRitmato);
      m.remove();
      mappa.current = null;
      inquadrato.current = false;
      marcatori.current = {};
      perno.current = null;
      alone.current = null;
      contatore.current = null;
      svg.current = null;
      gruppoComuni.current = null;
      gruppoQuartieri.current = null;
      tracciati.current = new Map();
      tracciatiComuni.current = new Map();
      spentiComuni.current = null;
      spentiQuartieri.current = null;
      spentiProvince.current = null;
      targhetta.current = null;
      quartieri.current = [];
      forme.current = [];
      gruppoProvince.current = null;
      province.current = [];
      comuniPerSigla.current = new Map();
      inCorso.current = new Set();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. La provincia della base: quella si carica sempre, anche se in questo
  //    momento la mappa sta guardando da un'altra parte. Le altre le decide
  //    l'inquadratura, in aggiornaProvinceAperte.
  //
  //    PRIMA (fino al 17/09) QUI SI BUTTAVA TUTTO e si caricava una provincia
  //    sola: cambiare provincia cancellava le forme di quella di prima. Adesso
  //    le province aperte convivono — un professionista di Monza copre anche
  //    Milano e Como — e chi decide cosa tenere è la cache, non questo effetto.
  useEffect(() => {
    if (!siglaProvincia) return;
    const sigla = siglaProvincia.trim().toUpperCase();
    if (comuniPerSigla.current.has(sigla) || inCorso.current.has(sigla)) {
      aggiornaProvinceAperte();
      return;
    }
    let vivo = true;
    inCorso.current.add(sigla);
    fetch(percorsoProvincia(sigla))
      .then((r) => (r.ok ? r.json() : null))
      .then((dati) => {
        inCorso.current.delete(sigla);
        if (!vivo || !dati) return;
        comuniPerSigla.current.set(sigla, leggiConfini(dati));
        rinfrescaForme();
        disegnaComuni();
        const m = mappa.current;
        if (m && !inquadrato.current) inquadrato.current = inquadra(m);
        aggiornaProvinceAperte();
      })
      // Un file che manca non è un errore da mostrare: la provincia resta
      // senza forme e restano i comuni come punti nell'elenco sotto.
      .catch(() => {
        inCorso.current.delete(sigla);
      });
    return () => {
      vivo = false;
    };
  }, [siglaProvincia, disegnaComuni, inquadra, rinfrescaForme, aggiornaProvinceAperte]);

  // 3. I quartieri arrivano dal database dopo la creazione della mappa: qui si
  //    ridisegnano e, se non era ancora riuscita, si tenta l'inquadratura.
  useEffect(() => {
    const m = mappa.current;
    if (!m) return;
    if (!inquadrato.current) inquadrato.current = inquadra(m);
    disegnaMarcatori();
    disegnaProvince();
    disegnaComuni();
    disegnaQuartieri();
  }, [
    zone,
    selezionate,
    comuni,
    comuniSelezionati,
    formeCliccabili,
    inquadra,
    disegnaMarcatori,
    disegnaProvince,
    disegnaComuni,
    disegnaQuartieri,
  ]);

  // 4. Il cerchio: un alone nel DOM, non una sorgente della mappa.
  //
  // PERCHÉ NON UN LAYER GEOJSON. Provato, e non si disegnava: una sorgente
  // geojson viene analizzata in un web worker, e nel bundle di produzione di
  // Next il worker di maplibre non viene emesso, quindi la sorgente resta
  // «non caricata» per sempre — senza un errore, il che è la parte fastidiosa.
  // Un alone in HTML non ha bisogno di nessun worker, pesa niente ed è esatto:
  // il raggio in pixel si ricava proiettando due punti.
  useEffect(() => {
    const m = mappa.current;
    if (!m) return;

    if (!alone.current) {
      const el = document.createElement("div");
      el.className =
        "pointer-events-none absolute rounded-full border-2 border-bob-indigo bg-bob-indigo/10";
      el.style.display = "none";
      m.getCanvasContainer().appendChild(el);
      alone.current = el;
    }
    const el = alone.current;

    // Se il cerchio è più grande della finestra, la sua superficie colorata
    // diventa uno sfondo e il cerchio non si vede più (visto il 28/08 con il
    // raggio al massimo). In quel caso si allarga l'inquadratura, una volta
    // sola per ogni combinazione di centro e raggio, altrimenti fitBounds
    // richiama se stesso all'infinito.
    let inquadraturaFatta = "";
    const stiEntro = () => {
      if (!centro) return;
      const chiave = `${centro.lat.toFixed(5)}|${centro.lng.toFixed(5)}|${raggioM}`;
      if (inquadraturaFatta === chiave) return;
      const c = m.project([centro.lng, centro.lat]);
      const bordo = m.project([centro.lng, centro.lat + raggioM / 111320]);
      const r = Math.abs(c.y - bordo.y);
      const cassa = m.getCanvas();
      const lato = Math.min(cassa.clientWidth, cassa.clientHeight);
      if (2 * r <= lato * 0.92) return;
      inquadraturaFatta = chiave;
      const gradiLat = raggioM / 111320;
      const gradiLng = gradiLat / Math.cos((centro.lat * Math.PI) / 180);
      m.fitBounds(
        new LngLatBounds(
          [centro.lng - gradiLng, centro.lat - gradiLat],
          [centro.lng + gradiLng, centro.lat + gradiLat]
        ),
        { padding: 28, animate: false }
      );
    };

    const ridisegna = () => {
      if (!centro) {
        el.style.display = "none";
        return;
      }
      stiEntro();
      const c = m.project([centro.lng, centro.lat]);
      // Un punto a raggioM metri verso nord: la differenza in pixel è il raggio.
      const bordo = m.project([centro.lng, centro.lat + raggioM / 111320]);
      const r = Math.abs(c.y - bordo.y);
      el.style.display = "block";
      el.style.left = `${c.x - r}px`;
      el.style.top = `${c.y - r}px`;
      el.style.width = `${2 * r}px`;
      el.style.height = `${2 * r}px`;
    };

    ridisegna();
    m.on("move", ridisegna);
    m.on("zoom", ridisegna);
    m.on("resize", ridisegna);

    if (!centro) {
      perno.current?.remove();
      perno.current = null;
    } else if (!perno.current) {
      const wrap = document.createElement("div");
      const pallino = document.createElement("div");
      pallino.className =
        "h-4 w-4 rounded-full border-2 border-white bg-bob-indigo shadow-md";
      pallino.title = "Trascina per spostare il centro";
      wrap.appendChild(pallino);
      const mk = new Marker({ element: wrap, draggable: true })
        .setLngLat([centro.lng, centro.lat])
        .addTo(m);
      mk.on("dragend", () => {
        const pos = mk.getLngLat();
        cbCentro.current?.({ lat: pos.lat, lng: pos.lng });
      });
      perno.current = mk;
    } else {
      perno.current.setLngLat([centro.lng, centro.lat]);
    }
    perno.current?.setDraggable(cbInterattivo.current);

    return () => {
      m.off("move", ridisegna);
      m.off("zoom", ridisegna);
      m.off("resize", ridisegna);
    };
  }, [centro, raggioM]);

  return (
    <div
      ref={box}
      className="h-[340px] w-full overflow-hidden rounded-xl border border-black/10 sm:h-[420px]"
      aria-label="Mappa delle zone in cui lavori"
    />
  );
}
