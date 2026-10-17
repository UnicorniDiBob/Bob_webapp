import { BobApe } from "./BobApe";

/**
 * Le tre scene illustrate dei passi della home (e di /come-funziona).
 *
 * Un cerchio in CSS con dentro l'ape e un oggetto, posizionati in
 * percentuale: la scena e' un quadrato che si adatta alla colonna, e su un
 * telefono si rimpicciolisce tutta insieme.
 *
 * DAL 17/10 C'E' L'APE (PR 2 del brief docs/BRIEF_logo_mascotte_bee.md) al
 * posto di Bob disegnato. Restano il cerchio, la sua misura e gli oggetti del
 * passo (la richiesta sul telefono, le tre schede, il messaggio con la
 * spunta): non erano attrezzi in mano a Bob, raccontano il passo, e accanto
 * all'ape si leggono uguale. Le pose «benvenuto» e «successo» sono carte su
 * fondo bianco: dentro il cerchio colorato vanno in tondo (vedi BobApe).
 * «sceglie-strumento» e' trasparente e sta sul cerchio come stava Bob.
 *
 * Quanto e' larga l'ape sullo schermo, per `sizes`: il cerchio arriva a 320px
 * e l'ape ne prende la meta' circa, quindi 170px bastano a ogni misura.
 */

/**
 * Il tondo su cui poggiano le scene.
 *
 * Esportato perche' serve anche fuori da qui: nell'eroe di /servizi, su una
 * fascia indaco, e' il tondo chiaro che da' un fondo alla mascotte. Nato
 * quando Bob aveva la salopette dello stesso indaco della fascia e senza
 * tondo spariva; con l'ape resta per lo stesso motivo di misura e di fondo.
 */
export function Cerchio({
  tinta,
  appoggio = "bg-black/[0.06]",
  children,
  testid,
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
  testid?: string;
}) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]" data-testid={testid}>
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
    <Cerchio tinta="bg-bob-indigo-100" testid="scena-richiesta">
      <BobApe
        posa="benvenuto"
        alt="Bob, l'ape di BOB BEE, ti dà il benvenuto"
        sizes="170px"
        className="absolute bottom-[7%] left-[3%] w-[52%] rounded-full"
      />
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
    <Cerchio tinta="bg-bob-yellow/25" testid="scena-confronto">
      <BobApe
        posa="sceglie-strumento"
        alt="Bob, l'ape di BOB BEE, sceglie lo strumento giusto"
        sizes="170px"
        className="absolute bottom-[7%] left-[1%] w-[50%]"
      />
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
    <Cerchio tinta="bg-bob-indigo-100" testid="scena-messaggio">
      <BobApe
        posa="successo"
        alt="Bob, l'ape di BOB BEE, festeggia il lavoro partito"
        sizes="170px"
        className="absolute bottom-[7%] left-[3%] w-[52%] rounded-full"
      />
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
