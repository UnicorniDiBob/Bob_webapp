"use client";

// IL SEGNAPOSTO DELLA GUIDA.
//
// La guida non finisce piu' sulla dashboard: manda a sistemare la cosa che
// manca e riprende quando si torna. Fra l'una e l'altra c'e' un cambio di
// pagina, quindi lo stato del giro deve sopravvivere al cambio di pagina.
//
// PERCHE' localStorage E NON UN CAMPO SUL SERVER. E' una preferenza di
// interfaccia, non un dato sul professionista: dura minuti, vale su questo
// browser e non deve finire in nessuna tabella ne' in nessun registro dei
// trattamenti. Uso strettamente tecnico, quindi nessun consenso richiesto
// (e' la stessa logica per cui non serve un banner: non profila nessuno).
//
// Ogni accesso e' protetto: in navigazione privata, con lo storage pieno o
// disabilitato, leggere o scrivere LANCIA. Una guida che rompe la pagina
// perche' non riesce a ricordarsi a che punto era sarebbe un pessimo scambio.

export const CHIAVE_GUIDA = "bob.guida.pro.v1";
export const EVENTO_GUIDA = "bob:guida-cambiata";

export interface ProgressoGuida {
  /** Il giro e' in corso: al ritorno sulla dashboard riprende da solo. */
  attiva: boolean;
  /** La spiegazione della pagina e' gia' stata vista: si riparte dalle cose. */
  spiegazioneVista: boolean;
  /** Cosa e' andato a sistemare: lo dice la barra sulle impostazioni. */
  etichetta?: string;
}

export function leggiProgresso(): ProgressoGuida | null {
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_GUIDA);
    if (!grezzo) return null;
    const p = JSON.parse(grezzo) as ProgressoGuida;
    return typeof p?.attiva === "boolean" ? p : null;
  } catch {
    return null;
  }
}

/** Passare null cancella il segnaposto: il giro e' finito o abbandonato. */
export function scriviProgresso(p: ProgressoGuida | null) {
  try {
    if (p) window.localStorage.setItem(CHIAVE_GUIDA, JSON.stringify(p));
    else window.localStorage.removeItem(CHIAVE_GUIDA);
  } catch {
    // Senza memoria la guida funziona lo stesso: non riprende da sola, e
    // basta. Non e' un errore da mostrare a nessuno.
  }
  try {
    window.dispatchEvent(new Event(EVENTO_GUIDA));
  } catch {
    // Nessun listener, nessun problema.
  }
}
