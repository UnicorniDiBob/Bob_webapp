// DOVE SI TORNA DOPO UN ACCESSO, SENZA USCIRE DAL SITO (30/09).
//
// La regola di /login e' «inizia con "/" e non con "//"». Non basta: il browser
// tratta «\» come «/», quindi «/\evil.com» passa il controllo e porta su
// https://evil.com/. Provato dal vivo il 30/09 su www.meetonda.com: dopo
// l'accesso da /login?returnTo=/%5Cexample.com l'indirizzo era
// https://example.com/ (roadmap/findings.csv, «open redirect»).
//
// Qui la stessa regola, piu' la prova che conta: l'indirizzo lo risolve URL,
// come fara' il browser, e deve restare sulla stessa origine.

const BASE = "https://ritorno.invalid";

export function ritornoInterno(percorso: string | null | undefined, riserva: string): string {
  if (!percorso || !percorso.startsWith("/") || percorso.startsWith("//")) return riserva;
  // Backslash e caratteri di controllo: nessun percorso nostro li contiene, e
  // sono quelli che il browser riscrive prima di risolvere.
  if (/[\\\u0000-\u001f\u007f]/.test(percorso)) return riserva;
  try {
    const u = new URL(percorso, BASE);
    if (u.origin !== BASE) return riserva;
    return u.pathname + u.search + u.hash;
  } catch {
    return riserva;
  }
}
