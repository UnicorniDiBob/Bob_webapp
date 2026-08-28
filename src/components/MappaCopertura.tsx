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
// Quando servirà una mappa stradale (per puntare un indirizzo) si aggiunge un
// nostro file PMTiles come sorgente, senza cambiare questo componente.
//
// E NESSUN GLYPH: le etichette dei quartieri sono marcatori HTML, non layer
// symbol. Un layer symbol richiede un server di font, che sarebbe un altro
// terzo a cui uscire.

import { useEffect, useRef } from "react";
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
    {
      id: "sfondo",
      type: "background",
      paint: { "background-color": "#f4f4f1" },
    },
  ],
};

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
  const pronta = useRef(false);

  // Le callback in ref: così gli handler si registrano una volta sola e
  // vedono sempre l'ultima versione, senza ricreare la mappa a ogni render.
  const cbCentro = useRef(onCentro);
  const cbZona = useRef(onZona);
  const cbInterattivo = useRef(interattivo);
  cbCentro.current = onCentro;
  cbZona.current = onZona;
  cbInterattivo.current = interattivo;

  // 1. Creazione, una volta.
  useEffect(() => {
    if (!box.current || mappa.current) return;

    const punti = zone.filter((z) => z.lat !== null && z.lng !== null);
    const m = new MappaLibre({
      container: box.current,
      style: SFONDO,
      center: [9.19, 45.4642],
      zoom: 10.5,
      attributionControl: {
        compact: true,
        customAttribution: "Quartieri: NIL Comune di Milano (CC-BY)",
      },
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");

    m.on("load", () => {
      pronta.current = true;

      if (punti.length > 0) {
        const b = new LngLatBounds();
        punti.forEach((z) => b.extend([z.lng as number, z.lat as number]));
        m.fitBounds(b, { padding: 48, animate: false });
      }
    });

    m.on("click", (e: MapMouseEvent) => {
      if (cbInterattivo.current) {
        cbCentro.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    mappa.current = m;
    return () => {
      m.remove();
      mappa.current = null;
      pronta.current = false;
      marcatori.current = {};
      perno.current = null;
      alone.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. I quartieri: un marcatore HTML per zona, riusato fra i render.
  useEffect(() => {
    const m = mappa.current;
    if (!m) return;
    const dentro = new Set(selezionate);

    zone.forEach((z) => {
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
        mk = new Marker({ element: radice })
          .setLngLat([z.lng, z.lat])
          .addTo(m);
        marcatori.current[z.slug] = mk;
      }
      const bottone = mk.getElement().firstElementChild as HTMLButtonElement;
      const attiva = dentro.has(z.slug);
      // Le etichette di 28 quartieri si sovrappongono al centro della citta',
      // dove i quartieri sono piccoli e vicini. Fuori area resta un pallino
      // (con il nome nel title e nell'aria per gli screen reader), dentro
      // l'area compare il nome: si legge cosa hai scelto, non l'atlante.
      bottone.className = attiva
        ? "whitespace-nowrap rounded-full border border-bob-indigo bg-bob-indigo px-2 py-0.5 text-[11px] font-medium text-white shadow-sm transition"
        : "h-3 w-3 rounded-full border border-black/25 bg-white/90 shadow-sm transition hover:h-auto hover:w-auto hover:whitespace-nowrap hover:border-black/40 hover:px-2 hover:py-0.5 hover:text-[11px] hover:font-medium hover:text-bob-ink/70";
      // Sulla mappa sta il nome corto: «Sempione / Arco della Pace» diventa
      // «Sempione». Il nome intero resta nel title, nell'aria e nelle pastiglie
      // sotto la mappa, dove c'e' spazio.
      const corto = z.label.split(" / ")[0];
      bottone.title = attiva ? `${z.label}: dentro la tua area` : z.label;
      bottone.setAttribute("aria-label", z.label);
      bottone.textContent = attiva ? corto : "";
      bottone.onmouseenter = () => {
        if (!dentro.has(z.slug)) bottone.textContent = corto;
      };
      bottone.onmouseleave = () => {
        if (!dentro.has(z.slug)) bottone.textContent = "";
      };
    });
  }, [zone, selezionate]);

  // 3. Il cerchio: un alone nel DOM, non una sorgente della mappa.
  //
  // PERCHÉ NON UN LAYER GEOJSON. Provato, e non si disegnava: una sorgente
  // geojson viene analizzata in un web worker, e nel bundle di produzione di
  // Next il worker di maplibre non viene emesso, quindi la sorgente resta
  // «non caricata» per sempre — senza un errore, il che è la parte fastidiosa.
  // Trovato con una prova nel browser: isSourceLoaded('cerchio') === false
  // mentre i dati erano corretti. Un alone in HTML non ha bisogno di nessun
  // worker, pesa niente ed è esatto: il raggio in pixel si ricava proiettando
  // due punti. Quando servirà una mappa stradale (PMTiles) il worker andrà
  // sistemato, e allora si potrà tornare a un layer se conviene.
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

    const ridisegna = () => {
      if (!centro) {
        el.style.display = "none";
        return;
      }
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
      className="h-[320px] w-full overflow-hidden rounded-xl border border-black/10 sm:h-[420px]"
      aria-label="Mappa delle zone in cui lavori"
    />
  );
}
