// UNA LETTURA ANDATA MALE NON E' UNA LISTA VUOTA (17/10).
//
// supabase-js non lancia: restituisce { error } e data null. Chi scrive
// `data ?? []` trasforma un guasto in «Nessuna richiesta ancora», e il
// cliente crede di aver perso i suoi lavori. Qui l'errore diventa
// un'eccezione con il testo da mostrare, lo stesso dell'app
// (Bob_app, src/lib/casaCliente.ts): rete o server.

export class ErroreLettura extends Error {
  constructor(
    readonly tipo: "rete" | "server",
    message: string
  ) {
    super(message);
    this.name = "ErroreLettura";
  }
}

export const TESTO_RETE = "Non riesco a raggiungere Bob. Controlla la connessione e riprova.";
export const TESTO_SERVER = "Non riesco a leggere i tuoi lavori. Riprova fra poco.";

/** Quando la risposta non arriva, l'errore non ha codice e il messaggio e' quello di fetch. */
export function erroreDaPostgrest(error: { code?: string; message?: string }): ErroreLettura {
  const rete = !error.code && /network|fetch|abort|timed? ?out|offline/i.test(error.message ?? "");
  return rete ? new ErroreLettura("rete", TESTO_RETE) : new ErroreLettura("server", TESTO_SERVER);
}

/** Lancia se la lettura e' andata male. Niente error.details nei log: puo' contenere dati della riga. */
export function controlla(error: { code?: string; message?: string } | null | undefined): void {
  if (error) throw erroreDaPostgrest(error);
}

/** Qualunque cosa sia stata lanciata, il testo da mostrare. */
export function testoErrore(e: unknown): string {
  if (e instanceof ErroreLettura) return e.message;
  // fetch che fallisce davvero (offline) lancia TypeError.
  if (e instanceof TypeError) return TESTO_RETE;
  return TESTO_SERVER;
}
