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

function Cerchio({ tinta, children }: { tinta: string; children: React.ReactNode }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      <div className={`absolute inset-0 rounded-full ${tinta}`} />
      {/* La mezzaluna in basso: da' un appoggio a Bob, se no galleggia. */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden rounded-b-[999px] bg-black/[0.06]" />
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
