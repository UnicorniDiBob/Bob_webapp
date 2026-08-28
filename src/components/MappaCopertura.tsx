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
import type { ZonaRow } from "@/lib/copertura";

/**
 * La forma dei quartieri, se il file c'è.
 *
 * PERCHÉ UN FILE NOSTRO E NON DELLE TILE. «Non si vede proprio Milano sotto»
 * (28/08): con i soli centri dei quartieri la mappa è uno spruzzo di pallini.
 * Per vedere la città serve la sua geometria, e la prendiamo dal perimetro dei
 * NIL pubblicato dal Comune in CC-BY — un file servito dal nostro dominio,
 * non tile di un terzo a cui uscirebbero l'IP del professionista e la porzione
 * di città che sta guardando. Lo genera scripts/build_milano_nil_geojson.py.
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
  zona: string | null;
  anelli: [number, number][][];
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
}

const SFONDO: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "sfondo", type: "background", paint: { "background-color": "#f4f4f1" } },
  ],
};

/** Sotto questo ingrandimento i quartieri sono pallini senza nome. */
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
  const tracciati = useRef<SVGPathElement[]>([]);
  const disegnoInCoda = useRef(false);

  // Dati e callback in ref: gli handler si registrano una volta sola e vedono
  // sempre l'ultima versione, senza ricreare la mappa a ogni render.
  const zoneRef = useRef(zone);
  const selRef = useRef(selezionate);
  const cbCentro = useRef(onCentro);
  const cbZona = useRef(onZona);
  const cbInterattivo = useRef(interattivo);
  zoneRef.current = zone;
  selRef.current = selezionate;
  cbCentro.current = onCentro;
  cbZona.current = onZona;
  cbInterattivo.current = interattivo;

  /** Inquadra la città. Torna false se i quartieri non sono ancora arrivati. */
  const inquadra = useCallback((m: MappaLibre) => {
    const punti = zoneRef.current.filter((z) => z.lat !== null && z.lng !== null);
    if (punti.length === 0) return false;
    const b = new LngLatBounds();
    punti.forEach((z) => b.extend([z.lng as number, z.lat as number]));
    m.fitBounds(b, { padding: 44, animate: false, maxZoom: 13 });
    return true;
  }, []);

  const disegnaMarcatori = useCallback(() => {
    const m = mappa.current;
    if (!m) return;
    const dentro = new Set(selRef.current);
    const conNome =
      m.getZoom() >= ZOOM_ETICHETTE && dentro.size > 0 && dentro.size <= MAX_ETICHETTE;

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

      const bottone = mk.getElement().firstElementChild as HTMLButtonElement;
      const attiva = dentro.has(z.slug);
      const corto = z.label.split(" / ")[0];
      const etichetta = attiva && conNome;

      bottone.className = etichetta
        ? "whitespace-nowrap rounded-full border border-bob-indigo bg-bob-indigo px-2 py-0.5 text-[11px] font-medium text-white shadow-sm"
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
    const badge = contatore.current;
    if (dentro.size === 0) {
      badge.textContent = "Nessuna zona nella tua area";
      badge.style.display = "block";
    } else if (!conNome) {
      badge.textContent = `${dentro.size} zone nella tua area`;
      badge.style.display = "block";
    } else {
      badge.style.display = "none";
    }
  }, []);

  /** Ridisegna i quartieri: proietta i vertici alle coordinate dello schermo. */
  const disegnaQuartieri = useCallback(() => {
    const m = mappa.current;
    const contenitore = svg.current;
    if (!m || !contenitore || quartieri.current.length === 0) return;
    const dentro = new Set(selRef.current);

    quartieri.current.forEach((q, i) => {
      let path = tracciati.current[i];
      if (!path) {
        path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        contenitore.appendChild(path);
        tracciati.current[i] = path;
      }
      const d = q.anelli
        .map((anello) => {
          const punti = anello.map(([lng, lat]) => {
            const p = m.project([lng, lat]);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          });
          return punti.length ? `M${punti.join("L")}Z` : "";
        })
        .join("");
      path.setAttribute("d", d);
      const attiva = q.zona ? dentro.has(q.zona) : false;
      path.setAttribute("fill", attiva ? "rgba(79,70,229,0.28)" : "rgba(255,255,255,0.55)");
      path.setAttribute("stroke", attiva ? "#4f46e5" : "rgba(0,0,0,0.14)");
      path.setAttribute("stroke-width", attiva ? "1.4" : "1");
    });
  }, []);

  /** Un disegno per fotogramma: trascinare la mappa non deve ingolfarsi. */
  const disegnaQuartieriRitmato = useCallback(() => {
    if (disegnoInCoda.current) return;
    disegnoInCoda.current = true;
    requestAnimationFrame(() => {
      disegnoInCoda.current = false;
      disegnaQuartieri();
    });
  }, [disegnaQuartieri]);

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
        customAttribution: "Quartieri: NIL Comune di Milano (CC-BY)",
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
    canvas.parentNode?.insertBefore(s, canvas.nextSibling);
    svg.current = s;

    let vivo = true;
    fetch("/geo/milano-nil.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((dati) => {
        if (!vivo || !dati) return;
        quartieri.current = (dati.features ?? [])
          .map((f: {
            properties?: { zona?: string | null };
            geometry?: { type?: string; coordinates?: unknown };
          }) => {
            const g = f.geometry;
            let anelli: [number, number][][] = [];
            if (g?.type === "MultiPolygon") {
              anelli = (g.coordinates as [number, number][][][]).map((p) => p[0]);
            } else if (g?.type === "Polygon") {
              anelli = [(g.coordinates as [number, number][][])[0]];
            }
            return { zona: f.properties?.zona ?? null, anelli };
          })
          .filter((q: Quartiere) => q.anelli.length > 0);
        disegnaQuartieri();
      })
      .catch(() => null);

    m.on("load", () => {
      inquadrato.current = inquadra(m);
      disegnaMarcatori();
      disegnaQuartieri();
    });
    m.on("move", disegnaQuartieriRitmato);
    m.on("zoom", disegnaQuartieriRitmato);
    m.on("resize", disegnaQuartieriRitmato);
    m.on("zoomend", disegnaMarcatori);
    m.on("click", (e: MapMouseEvent) => {
      if (cbInterattivo.current) {
        cbCentro.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
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
      tracciati.current = [];
      quartieri.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. I quartieri arrivano dal database dopo la creazione della mappa: qui si
  //    ridisegnano e, se non era ancora riuscita, si tenta l'inquadratura.
  useEffect(() => {
    const m = mappa.current;
    if (!m) return;
    if (!inquadrato.current) inquadrato.current = inquadra(m);
    disegnaMarcatori();
    disegnaQuartieri();
  }, [zone, selezionate, inquadra, disegnaMarcatori, disegnaQuartieri]);

  // 3. Il cerchio: un alone nel DOM, non una sorgente della mappa.
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
