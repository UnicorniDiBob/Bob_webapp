// LA CHAT SI APRE DAL PUNTO IN CUI L'HAI TOCCATA (Lucio, 07/10).
//
// Un tasto «Apri la chat» che fa comparire la conversazione di colpo sembra
// un cambio di pagina; uno che la fa crescere dal dito sembra la stessa cosa
// che si apre. L'effetto e' una maschera circolare (clip-path: circle) che
// parte dalle coordinate del tocco e copre lo schermo, con il contenuto che
// sale da scala 0.98 a 1 e da opacita' 0.6 a 1. 280ms all'andata, 200 al
// ritorno, al contrario.
//
// COME. Dove c'e' l'API delle transizioni di vista
// (document.startViewTransition) il browser fotografa la pagina di prima e
// anima la nuova sopra: la chat e' gia' montata e utilizzabile mentre il
// cerchio cresce, i messaggi si caricano in parallelo. Dove non c'e', un
// ripiego in CSS puro: la chat si monta e la sua cornice fa la stessa
// animazione (classe .chat-apertura, globals.css). Nessuna libreria.
//
// SOLO transform, opacity e clip-path: stanno sulla scheda video. Niente
// width/height/top, niente blur: a 390px si vedrebbe scattare.
//
// CHI HA CHIESTO MENO ANIMAZIONI al sistema operativo non vede niente: la
// chat compare e basta. Lo controlla sia questo file (non parte nessuna
// transizione) sia il CSS (@media prefers-reduced-motion).

export const DURATA_APERTURA_MS = 280;
export const DURATA_CHIUSURA_MS = 200;

interface Origine {
  x: number;
  y: number;
  /** Il raggio che copre tutto lo schermo da quel punto. */
  r: number;
  quando: number;
}

// Il punto dell'ultimo tocco che ha aperto una chat. Vive nel modulo: con la
// navigazione del client il modulo resta lo stesso fra una pagina e l'altra.
let origine: Origine | null = null;
// Chi aspetta che la pagina della chat sia montata per far partire il cerchio.
let fineAttesa: (() => void) | null = null;
// Il ripiego CSS si usa una volta sola, sulla chat appena montata.
let ripiegoInSospeso = false;

type DocumentoConTransizioni = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished: Promise<void>;
  };
};

export function menoAnimazioni(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function raggioDa(x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y)));
}

function scriviOrigine(x: number, y: number) {
  origine = { x, y, r: raggioDa(x, y), quando: Date.now() };
  const s = document.documentElement.style;
  s.setProperty("--chat-x", `${x}px`);
  s.setProperty("--chat-y", `${y}px`);
  s.setProperty("--chat-r", `${origine.r}px`);
}

/** Il punto del tocco: il dito, o il centro del bottone se viene dalla tastiera. */
export function puntoDelTocco(e: {
  clientX: number;
  clientY: number;
  currentTarget: EventTarget | null;
}): { x: number; y: number } {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const el = e.currentTarget as HTMLElement | null;
  const b = el?.getBoundingClientRect();
  return b
    ? { x: b.left + b.width / 2, y: b.top + b.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function conClasse(classe: string, transizione: { finished: Promise<void> }) {
  const html = document.documentElement;
  html.classList.add(classe);
  transizione.finished.finally(() => html.classList.remove(classe));
}

/**
 * Apre la chat da un altro posto (calendario, area personale): naviga e fa
 * crescere la pagina nuova dal punto del tocco. `vai` e' la navigazione
 * (router.push). Il cerchio parte quando la chat e' montata
 * (chatMontata()), o dopo 400ms se la pagina tarda: non si aspetta mai il
 * caricamento dei messaggi.
 */
export function apriChatDa(punto: { x: number; y: number }, vai: () => void) {
  if (menoAnimazioni()) {
    origine = null;
    vai();
    return;
  }
  scriviOrigine(punto.x, punto.y);
  const doc = document as DocumentoConTransizioni;
  if (!doc.startViewTransition) {
    ripiegoInSospeso = true;
    vai();
    return;
  }
  const t = doc.startViewTransition(
    () =>
      new Promise<void>((risolvi) => {
        const fatto = () => {
          fineAttesa = null;
          risolvi();
        };
        fineAttesa = fatto;
        setTimeout(fatto, 400);
        vai();
      })
  );
  conClasse("vt-apri-chat", t);
}

/** La pagina della chat e' montata: il cerchio puo' partire. */
export function chatMontata() {
  fineAttesa?.();
}

/**
 * Il ripiego CSS, per la chat appena montata: true una volta sola dopo
 * un'apertura senza transizioni di vista.
 */
export function usaRipiego(): boolean {
  // Un'apertura di piu' di due secondi fa non e' questa: nessun effetto a
  // sorpresa su una chat aperta per altre strade.
  const recente = origine !== null && Date.now() - origine.quando < 2000;
  const si = ripiegoInSospeso && recente && !menoAnimazioni();
  ripiegoInSospeso = false;
  return si;
}

/**
 * Un cambio dentro la stessa pagina (elenco → conversazione, e ritorno):
 * `cambia` deve aggiornare il DOM in modo sincrono (flushSync).
 * verso = "apri": la conversazione cresce dal tocco; "chiudi": si stringe
 * verso il punto da cui si era aperta (o verso il tasto indietro).
 */
export function transizioneNellaPagina(
  verso: "apri" | "chiudi",
  punto: { x: number; y: number },
  cambia: () => void
) {
  const doc = document as DocumentoConTransizioni;
  if (menoAnimazioni()) {
    cambia();
    return;
  }
  if (verso === "apri") {
    scriviOrigine(punto.x, punto.y);
  } else if (!origine || Date.now() - origine.quando > 30 * 60_000) {
    // Entrati da un collegamento esterno: si chiude verso il tasto indietro.
    scriviOrigine(punto.x, punto.y);
  }
  if (!doc.startViewTransition) {
    ripiegoInSospeso = verso === "apri";
    cambia();
    return;
  }
  const t = doc.startViewTransition(cambia);
  conClasse(verso === "apri" ? "vt-apri-chat" : "vt-chiudi-chat", t);
}
