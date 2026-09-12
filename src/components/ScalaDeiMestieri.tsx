"use client";

import { useEffect, useRef, useState } from "react";

import { Bob } from "./Bob";
import { Attrezzo, type TipoAttrezzo } from "./SceneBob";

/**
 * Una scala di legno con sopra quattro Bob di schiena, ognuno con un attrezzo
 * diverso, che lo muovono mentre la pagina scorre.
 *
 * A COSA SERVE. Sta accanto a «Come ordiniamo i risultati», che e' un testo
 * lungo e obbligatorio: su uno schermo largo lasciava mezza fascia vuota. Qui
 * la colonna vuota diventa il posto dove Bob fa vedere che i mestieri sono
 * tanti — ed e' l'idea da cui e' partito tutto questo lavoro: riempire lo
 * schermo di contenuto, non allargando le righe di testo.
 *
 * DI SCHIENA, E NON PER VEZZO. Sono al lavoro, non in posa: uno che lavora lo
 * si guarda da dietro. In piu' quattro facce identiche allineate sulla stessa
 * scala sembravano una collezione di pupazzi; quattro schiene sembrano un
 * cantiere. Il casco resta, ed e' quello che li tiene riconoscibili.
 *
 * COSA SI MUOVE. Non il Bob: il BRACCIO con l'attrezzo. Prima scorrevano su e
 * giu' tutti interi e sembrava un'immagine che scivola, non gente che lavora.
 * L'angolo e' un seno della posizione della pagina — `Math.sin(scrollY/passo +
 * fase)` — e ampiezza, PASSO e fase sono diversi per ciascuno: il cacciavite
 * si gira svelto e corto, la pennellata e' lenta e larga, lo scatolone non si
 * usa, si porta. Se oscillassero tutti uguale tornerebbe a sembrare un'unica
 * immagine che si muove.
 *
 * MANI ALTERNATE. Due lavorano di destra e due di sinistra. L'attrezzo della
 * mano sinistra e' lo stesso disegno specchiato (`scale(-1,1)` dentro un
 * `translate(200,0)`, cioe' x -> 200-x nel viewBox di Bob): un disegno solo
 * per attrezzo, e nessuna coppia che col tempo diverge.
 *
 * PERCHE' rAF E UN LISTENER PASSIVO. `scroll` scatta decine di volte al
 * secondo: leggere e ridisegnare a ogni colpo fa scattare la pagina. Si legge
 * una volta per fotogramma, e il listener e' passivo cosi' il browser non
 * aspetta noi per scorrere.
 *
 * CHI HA CHIESTO MENO MOVIMENTO NON LO RICEVE. Con
 * `prefers-reduced-motion: reduce` il listener non viene nemmeno registrato: i
 * bracci restano al loro angolo di riposo e la scala si vede lo stesso, ferma.
 *
 * E' DECORATIVA. `aria-hidden` su tutto: accanto c'e' gia' il testo che dice
 * la stessa cosa meglio, e quattro pupazzi letti da uno screen reader sono
 * solo rumore su una comunicazione che la legge vuole chiara.
 */

type Mestiere = {
  /** Dove sta sulla scala, in percentuale dell'altezza. */
  alto: number;
  /** Con quale mano lavora. */
  mano: "dx" | "sx";
  attrezzo: TipoAttrezzo;
  /** L'angolo a riposo del braccio che lavora, in gradi. */
  base: number;
  /** Di quanti gradi oscilla attorno al riposo. */
  ampiezza: number;
  /**
   * Ogni quanti pixel di scorrimento compie un ciclo intero — piu' e' piccolo,
   * piu' il gesto e' rapido. Non e' un numero decorativo: e' il ritmo del
   * mestiere. Un cacciavite si gira svelto, uno scatolone si porta e basta.
   */
  passo: number;
  /** Lo sfasamento, perche' non battano tutti a tempo. */
  fase: number;
};

const MESTIERI: Mestiere[] = [
  // chiave: gira piano e con forza
  { alto: 5, mano: "dx", attrezzo: "chiave", base: -40, ampiezza: 15, passo: 70, fase: 0 },
  // pennello: la pennellata e' lunga e larga
  { alto: 30, mano: "sx", attrezzo: "pennello", base: -34, ampiezza: 26, passo: 46, fase: 1.7 },
  // scatolone: non lo usa, lo porta. Quasi fermo.
  { alto: 55, mano: "dx", attrezzo: "scatolone", base: -6, ampiezza: 5, passo: 130, fase: 3.2 },
  // cacciavite: piccolo e svelto
  { alto: 78, mano: "sx", attrezzo: "cacciavite", base: -28, ampiezza: 17, passo: 30, fase: 4.6 },
];

export function ScalaDeiMestieri({ className = "" }: { className?: string }) {
  const [scorrimento, setScorrimento] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let inCoda = false;
    const leggi = () => {
      inCoda = false;
      setScorrimento(window.scrollY);
    };
    const alloScorrimento = () => {
      if (inCoda) return;
      inCoda = true;
      requestAnimationFrame(leggi);
    };

    leggi();
    window.addEventListener("scroll", alloScorrimento, { passive: true });
    return () => window.removeEventListener("scroll", alloScorrimento);
  }, []);

  return (
    <div
      ref={ref}
      className={`relative h-full min-h-[720px] ${className}`}
      aria-hidden="true"
    >
      <Scala />
      {MESTIERI.map((m, i) => {
        // A riposo (nessun movimento) l'angolo e' quello base e basta.
        const angolo =
          scorrimento === null
            ? m.base
            : m.base + Math.sin(scorrimento / m.passo + m.fase) * m.ampiezza;
        return (
          <div
            key={i}
            className="absolute left-1/2 w-[52%] -translate-x-1/2"
            style={{ top: `${m.alto}%` }}
          >
            <BobAlLavoro mestiere={m} angolo={angolo} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * La scala: due montanti e nove pioli, in legno.
 *
 * I pioli sono radi e spessi. Fitti e sottili sembrava una tabella: e' la
 * distanza fra i pioli a dire di che oggetto si tratta.
 */
function Scala() {
  return (
    <div className="absolute inset-y-0 left-1/2 w-[46%] -translate-x-1/2">
      <div className="absolute inset-y-0 left-0 w-[11px] rounded-full bg-[#b88a5c]" />
      <div className="absolute inset-y-0 right-0 w-[11px] rounded-full bg-[#b88a5c]" />
      <div className="flex h-full flex-col justify-between py-[6%]">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="h-[9px] w-full rounded-full bg-[#cfa87c]" />
        ))}
      </div>
    </div>
  );
}

/** Bob di schiena, con l'attrezzo nella mano giusta, all'angolo dato. */
function BobAlLavoro({
  mestiere,
  angolo,
}: {
  mestiere: Mestiere;
  angolo: number;
}) {
  const ferro = <Attrezzo tipo={mestiere.attrezzo} />;
  if (mestiere.mano === "sx") {
    return (
      <Bob
        verso="schiena"
        className="w-full"
        fuoriBordo
        // Il braccio sinistro e' lo specchio del destro: l'angolo si ribalta
        // di segno, se no alza il braccio verso l'interno.
        gradiBraccioSinistro={-angolo}
        attrezzoSinistro={
          <g transform="translate(200,0) scale(-1,1)">{ferro}</g>
        }
      />
    );
  }
  return (
    <Bob
      verso="schiena"
      className="w-full"
      fuoriBordo
      gradiBraccioDestro={angolo}
      attrezzoDestro={ferro}
    />
  );
}
