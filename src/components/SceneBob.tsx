import { Bob } from "./Bob";

/**
 * Le tre scene illustrate dei passi della home.
 *
 * Non sono un SVG unico: sono un cerchio in CSS con dentro Bob e un oggetto,
 * posizionati in percentuale. Costa meno di un disegno intero, resta
 * ricolorabile con le classi del progetto, e soprattutto Bob dentro la scena e'
 * lo STESSO componente dell'eroe — non una copia che col tempo divergera'.
 *
 * Le proporzioni sono in percentuale e non in pixel: la scena e' un quadrato
 * che si adatta alla colonna, e su un telefono si rimpicciolisce tutta insieme.
 */

/**
 * Il tondo su cui poggiano le scene.
 *
 * Esportato perche' serve anche fuori da qui: su una fascia scura Bob ha la
 * salopette dello stesso indaco del fondo, e senza un tondo chiaro dietro si
 * perde nello sfondo. E' il suo mestiere, dare un fondo a Bob.
 */
export function Cerchio({
  tinta,
  appoggio = "bg-black/[0.06]",
  children,
}: {
  tinta: string;
  /**
   * La mezzaluna in basso. Di default e' un velo di nero, che su fondo chiaro
   * funziona. Su una fascia scura il nero non si vede: li' si passa un velo
   * chiaro. E' una prop e non una classe aggiunta da fuori per il motivo
   * scritto in cima a sezioni.tsx — fra due utility pari vince quella che nel
   * CSS generato viene dopo, non quella passata per ultima.
   */
  appoggio?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      <div className={`absolute inset-0 rounded-full ${tinta}`} />
      <div
        className={`absolute inset-x-0 bottom-0 h-1/2 overflow-hidden rounded-b-[999px] ${appoggio}`}
      />
      {children}
    </div>
  );
}

/** Passo 1 — la richiesta arriva sul telefono. */
export function ScenaRichiesta() {
  return (
    <Cerchio tinta="bg-bob-indigo-100">
      <Bob posa="neutro" className="absolute bottom-[7%] left-[3%] w-[48%]" />
      <div className="absolute right-[9%] top-[26%] w-[27%] rounded-[14%/9%] bg-bob-ink p-[6%] shadow-card">
        <div className="rounded-[10%/7%] bg-white p-[9%]">
          <div className="h-1.5 w-4/5 rounded-full bg-bob-indigo-100" />
          <div className="mt-[8%] h-1.5 w-3/5 rounded-full bg-bob-indigo-100" />
          <div className="mt-[14%] h-3 w-4/5 rounded-full bg-bob-yellow" />
          <div className="mt-[8%] h-1.5 w-2/5 rounded-full bg-bob-indigo-100" />
        </div>
      </div>
    </Cerchio>
  );
}

/** Passo 2 — i profili si confrontano, uno emerge. */
export function ScenaConfronto() {
  return (
    <Cerchio tinta="bg-bob-yellow/25">
      <Bob posa="neutro" className="absolute bottom-[7%] left-[1%] w-[46%]" />
      <div className="absolute right-[6%] top-[20%] flex w-[44%] flex-col gap-[7%]">
        <SchedaFinta colore="bg-bob-indigo" />
        <SchedaFinta colore="bg-bob-indigo-600" />
        <SchedaFinta colore="bg-bob-yellow" scelta />
      </div>
    </Cerchio>
  );
}

function SchedaFinta({ colore, scelta = false }: { colore: string; scelta?: boolean }) {
  return (
    <div
      className={`flex items-center gap-[6%] rounded-xl bg-white p-[7%] ${
        scelta ? "ring-2 ring-bob-yellow" : "ring-1 ring-black/5"
      }`}
    >
      <span className={`h-5 w-5 flex-none rounded-full ${colore}`} />
      <span className="flex-1">
        <span className="block h-1.5 w-4/5 rounded-full bg-bob-indigo-100" />
        <span className="mt-1.5 block h-1.5 w-3/5 rounded-full bg-black/[0.07]" />
      </span>
    </div>
  );
}

/** Passo 3 — Bob scrive il primo messaggio, e il lavoro parte. */
export function ScenaMessaggio() {
  return (
    <Cerchio tinta="bg-bob-indigo-100">
      <Bob posa="telefono" className="absolute bottom-[7%] left-[3%] w-[48%]" />
      <div className="absolute right-[7%] top-[24%] w-[42%] rounded-2xl bg-white p-[9%] shadow-card">
        <div className="h-1.5 w-full rounded-full bg-bob-indigo-100" />
        <div className="mt-[9%] h-1.5 w-4/5 rounded-full bg-bob-indigo-100" />
        <div className="mt-[9%] h-1.5 w-2/3 rounded-full bg-black/[0.07]" />
      </div>
      <div className="absolute right-[4%] top-[14%] flex h-[15%] w-[15%] items-center justify-center rounded-full bg-bob-yellow">
        <svg viewBox="0 0 24 24" className="h-3/5 w-3/5" aria-hidden="true">
          <path
            d="m5 12 4.5 5L19 7"
            fill="none"
            stroke="#1e1b4b"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </Cerchio>
  );
}

/**
 * La bilancia coi bracci pari — «equo per i professionisti».
 *
 * NON E' UNA SCENA: non ha il cerchio e non ha Bob. E' un segno, e basta uno.
 * Il cerchio serve a dare un fondo a Bob quando c'e'; senza Bob diventa solo
 * una bolla attorno a un disegno, e la fascia indaco un fondo ce l'ha gia'.
 *
 * La tinta e' una prop perche' vive su fondo scuro: il tratto blu notte delle
 * altre illustrazioni li' sparirebbe, e i due piatti allo stesso livello sono
 * tutto il messaggio — se non si vedono, non c'e' messaggio.
 */
export function Bilancia({
  tinta = "chiara",
  className = "",
}: {
  tinta?: "chiara" | "scura";
  className?: string;
}) {
  const tratto = tinta === "chiara" ? "#ffffff" : "#1e1b4b";
  return (
    <svg
      viewBox="0 0 120 100"
      className={`mx-auto w-full max-w-[300px] ${className}`}
      aria-hidden="true"
    >
      {/* colonna e base */}
      <rect x="56" y="14" width="8" height="74" rx="4" fill={tratto} />
      <rect x="34" y="88" width="52" height="9" rx="4.5" fill={tratto} />
      {/* giogo */}
      <rect x="8" y="12" width="104" height="8" rx="4" fill={tratto} />
      {/* i due tiranti, della stessa lunghezza */}
      <rect x="23" y="20" width="3" height="26" fill={tratto} />
      <rect x="94" y="20" width="3" height="26" fill={tratto} />
      {/* i due piatti, alla stessa altezza */}
      <path d="M6 46h37c0 10-8 16-18.5 16S6 56 6 46z" fill="#fbbf24" />
      <path d="M77 46h37c0 10-8 16-18.5 16S77 56 77 46z" fill="#fbbf24" />
    </svg>
  );
}

/** Quali attrezzi sa tenere Bob. */
export type TipoAttrezzo =
  | "chiave"
  | "pennello"
  | "scatolone"
  | "cacciavite";

/**
 * Gli attrezzi che Bob puo' tenere in mano, disegnati attorno alla sua mano
 * destra, che nel viewBox sta a (135.5, 206).
 *
 * STANNO QUI E NON DENTRO LA SCALA. La scala e' il primo posto che li ha
 * usati, non il loro proprietario: un attrezzo serve ovunque Bob faccia un
 * mestiere, e l'eroe della pagina per i professionisti e' il secondo posto.
 *
 * Partono da x=140 e non da 135: il corpo arriva a x=134, e un attrezzo
 * disegnato sulla mano finirebbe per meta' dietro la camicia. A 140 la mano ne
 * copre il manico — sembra impugnato — e il resto si vede.
 *
 * Niente testo: le misure scalano, le parole no.
 */
export function Attrezzo({ tipo }: { tipo: TipoAttrezzo }) {
  if (tipo === "chiave") {
    return (
      <g transform="rotate(12 150 210)">
        <rect x="144" y="196" width="13" height="56" rx="6.5" fill="#8f98ad" />
        <path
          d="M150.5 168a16 16 0 1 1 0 32 16 16 0 0 1 0-32zm0 9a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"
          fill="#8f98ad"
        />
      </g>
    );
  }
  if (tipo === "pennello") {
    return (
      <g transform="rotate(-10 150 210)">
        <rect x="145" y="174" width="11" height="42" rx="5.5" fill="#c8a179" />
        <rect x="141" y="214" width="19" height="11" rx="2.5" fill="#8f98ad" />
        <path d="M141 225h19v20a9.5 9.5 0 0 1-19 0z" fill="#3730a3" />
      </g>
    );
  }
  if (tipo === "scatolone") {
    return (
      <g>
        <rect x="138" y="190" width="56" height="48" rx="5" fill="#c8a179" />
        <rect x="138" y="207" width="56" height="9" fill="#a8845c" />
        <rect x="161" y="190" width="9" height="48" fill="#a8845c" />
      </g>
    );
  }
  return (
    <g transform="rotate(20 150 210)">
      <rect x="143" y="166" width="15" height="34" rx="7" fill="#fbbf24" />
      <rect x="147" y="198" width="7" height="48" rx="3" fill="#8f98ad" />
      <rect x="145" y="196" width="11" height="7" rx="2" fill="#eaa50c" />
    </g>
  );
}
