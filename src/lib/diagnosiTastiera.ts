// DIAGNOSI DELLA TASTIERA DELL'IPHONE — TEMPORANEA (15/10).
//
// La correzione della #165 su un iPhone vero non funziona, e la tastiera di
// iOS non si emula in Chrome. Questo registro raccoglie, solo quando la
// pagina /messaggi ha `?diagnosi=tastiera`, gli ultimi eventi e cosa ha
// deciso il codice della tastiera, per mostrarli nel pannello
// DiagnosiTastiera. Non manda niente da nessuna parte. Spento (il caso di
// sempre) non fa niente. Va tolto con la correzione vera.

export interface VoceTastiera {
  t: number;
  evento: string;
  decisione: string;
  volte: number;
}

let accesa = false;
const voci: VoceTastiera[] = [];
const ascoltatori = new Set<() => void>();

/** La accende il pannello quando c'e'; la funzione restituita la spegne. */
export function accendiDiagnosiTastiera(): () => void {
  accesa = true;
  return () => {
    accesa = false;
    voci.length = 0;
  };
}

/** Segna un evento e cosa si e' deciso. Spenta, non fa niente. */
export function segnaTastiera(evento: string, decisione: string): void {
  if (!accesa) return;
  const t = Math.round(performance.now());
  const ultima = voci[voci.length - 1];
  // Lo stesso evento con la stessa decisione si conta, non si ripete: lo
  // scroll da solo riempirebbe le otto righe in un attimo.
  if (ultima && ultima.evento === evento && ultima.decisione === decisione) {
    ultima.volte += 1;
    ultima.t = t;
  } else {
    voci.push({ t, evento, decisione, volte: 1 });
    if (voci.length > 8) voci.shift();
  }
  ascoltatori.forEach((f) => f());
}

export function vociTastiera(): VoceTastiera[] {
  return voci.map((v) => ({ ...v }));
}

export function ascoltaTastiera(f: () => void): () => void {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}
