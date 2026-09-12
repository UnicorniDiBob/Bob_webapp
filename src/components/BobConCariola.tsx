import { Bob } from "./Bob";

/**
 * Bob di profilo che spinge la cariola, con le banconote che ci piovono
 * dentro. Sta nell'eroe di /per-i-professionisti e dice in un disegno quello
 * che la pagina dice a parole: qui il professionista ci guadagna, e non paga
 * per provarci.
 *
 * PERCHE' DI PROFILO, E NON DI FRONTE.
 *
 * Ci sono voluti tre tentativi. Il primo aveva Bob frontale e la cariola di
 * lato: due punti di vista nella stessa immagine, e si vedeva. Il secondo
 * girava la cariola verso lo spettatore per farla combaciare con Bob, ma vista
 * di fronte il cassone gli finisce davanti e sembra che Bob ci sia DENTRO
 * invece di spingerla. La causa stava a monte: la mascotte aveva due versi
 * soltanto. Il terzo tentativo e' stato aggiungere il verso `profilo` a
 * Bob.tsx — cioe' risolvere il problema dov'era, non aggirarlo qui.
 *
 * LE MISURE. Il cassone e' largo poco piu' di Bob, non il triplo: e' un
 * attrezzo, non il soggetto. Nella prima versione di lato occupava tre quarti
 * della scena e il protagonista sembrava lui.
 *
 * DOVE STA LA MANO. Di profilo il braccio di Bob e' spostato al centro del
 * torso stretto: con lui al 44% della scena e appoggiato all'8% dal fondo, la
 * sua mano cade a (42,8 | 120,5) di questo viewBox, raggio 4,9 — letto dal DOM
 * e non stimato. L'impugnatura parte da
 * li' e la mano, disegnata dopo, la copre.
 *
 * L'ANIMAZIONE E' IN CSS, NON IN JAVASCRIPT. Cinque banconote con cinque
 * ritardi diversi: non serve sapere dove sta la pagina, serve solo che cadano.
 * Cosi' questo resta un server component e non spedisce un byte di JS al
 * browser — al contrario della scala, dove il movimento DEVE seguire lo
 * scorrimento. La corsa finisce SOTTO il bordo del cassone: la banconota
 * sparisce dietro la sponda invece di dissolversi a mezz'aria dentro la
 * cariola, che e' il difetto della versione precedente.
 */

/** Il verde dei soldi. Non e' nella palette del marchio ed e' voluto: le
 *  banconote devono leggersi come soldi, non come un pezzo di Bob. */
const V = {
  banconota: "#4ec27a",
  banconotaScura: "#2f8f57",
  banconotaChiara: "#8ee0ab",
} as const;

/** Dove partono le banconote che cadono, e con quanto ritardo. Cadenze
 *  irregolari: a intervalli regolari si legge il ciclo e si vede il loop. */
const CADUTA = [
  { x: 104, ritardo: 0 },
  { x: 122, ritardo: 1.2 },
  { x: 140, ritardo: 0.45 },
  { x: 158, ritardo: 1.9 },
  { x: 172, ritardo: 0.8 },
];

/** La pila che esce dal cassone. */
const PILA = [
  { x: 108, y: 74, r: -10 },
  { x: 128, y: 71, r: 5 },
  { x: 148, y: 73, r: -6 },
  { x: 166, y: 76, r: 11 },
  { x: 119, y: 63, r: 6 },
  { x: 139, y: 60, r: -8 },
  { x: 158, y: 65, r: 9 },
];

/** Una banconota. Nessun testo, nessuna cifra: il verde e il taglio bastano,
 *  e un numero scritto qui dentro si taglierebbe appena la scena si stringe. */
function Banconota({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`rotate(${r} ${x} ${y})`}>
      <rect x={x - 9} y={y - 5} width="18" height="10" rx="1.5" fill={V.banconota} />
      <rect
        x={x - 6.5}
        y={y - 3}
        width="13"
        height="6"
        rx="1"
        fill="none"
        stroke={V.banconotaScura}
        strokeWidth="0.9"
      />
      <circle cx={x} cy={y} r="1.9" fill={V.banconotaChiara} />
    </g>
  );
}

export function BobConCariola({ className = "" }: { className?: string }) {
  return (
    <div className={`relative mx-auto w-full max-w-[440px] ${className}`}>
      <div className="relative aspect-[10/8]">
        {/* L'appoggio: una mezzaluna d'ombra, non un cerchio. */}
        <div className="absolute inset-x-[8%] bottom-[5%] h-[6%] rounded-[50%] bg-bob-ink/20" />

        <svg
          viewBox="0 0 200 160"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {/* --- le banconote che cadono, dietro tutto --- */}
          {CADUTA.map((b) => (
            <g
              key={b.x}
              className="banconota-cade"
              style={{ animationDelay: `${b.ritardo}s` }}
            >
              <Banconota x={b.x} y={100} r={0} />
            </g>
          ))}

          {/* --- la pila, che esce dall'imboccatura --- */}
          {PILA.map((b, i) => (
            <Banconota key={i} x={b.x} y={b.y} r={b.r} />
          ))}

          {/* --- il telaio: le stanghe scendono dalla mano al mozzo --- */}
          <rect x="42" y="114" width="126" height="6" rx="3" fill="#241e5c" transform="rotate(9 105 117)" />
          <rect x="66" y="103" width="92" height="5" rx="2.5" fill="#332c72" transform="rotate(9 112 105.5)" />
          <rect x="36" y="112" width="28" height="9" rx="4.5" fill="#4a4566" transform="rotate(9 50 116.5)" />
          {/* la gamba d'appoggio arriva a terra come i piedi di Bob */}
          <rect x="104" y="120" width="7" height="24" rx="3.5" fill="#241e5c" />
          {/* la ruota, DAVANTI al cassone e non sotto */}
          <circle cx="166" cy="132" r="12" fill="#1e1b4b" />
          <circle cx="166" cy="132" r="4.5" fill="#8f98ad" />

          {/* --- il cassone, appoggiato sulle stanghe --- */}
          <path d="M96 82h84l-16 40h-52z" fill="#fbbf24" />
          <path d="M150 82h30l-16 40h-7z" fill="#eaa50c" opacity="0.5" />
          {/* il labbro superiore passa SOPRA la pila: le banconote escono da
              dentro, non ci stanno appoggiate davanti */}
          <path d="M96 82h84l-3 8H99z" fill="#d9960a" />
        </svg>

        {/* Bob di profilo, sopra l'impugnatura: la mano la copre. */}
        <Bob
          verso="profilo"
          posa="neutro"
          gradiBraccioDestro={16}
          alt="Bob che spinge una cariola piena di banconote"
          className="absolute bottom-[8%] left-0 w-[44%]"
        />
      </div>
    </div>
  );
}
