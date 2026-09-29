// LE CHIAVI DEL BROWSER, UNA PER ACCOUNT (29/09, sessioni multiple).
//
// Con due account nello stesso browser, una chiave di localStorage senza
// l'utente dentro e' condivisa: la bozza della chat di Bob (il testo di una
// richiesta) scritta da A la ritroverebbe B. Qui ogni chiave diventa
// «<base>:<id utente>», con l'utente preso AL MOMENTO DELLA LETTURA dal cookie
// della sessione attiva — lo stesso che usa il client Supabase del browser.
// Cosi' la chiave e' giusta anche prima che AuthProvider abbia caricato, e
// dopo uno scambio (che ricarica la pagina). Serve solo a separare i dati del
// browser: non decide chi puo' fare cosa, quello lo dice il server.
//
// LE CHIAVI VECCHIE, senza utente, si CANCELLANO alla prima lettura invece di
// essere attribuite all'account attivo: prima del 29/09 potevano appartenere a
// chiunque avesse usato lo stesso browser. Costo, una volta sola: una bozza in
// corso, lo stato «letto» delle notifiche, il segno della guida e del
// promemoria ripartono da capo.

import { stringFromBase64URL } from "@supabase/ssr";

const PREFISSO_BASE64 = "base64-";

/** L'id dell'utente attivo, dai cookie sb- (formato di @supabase/ssr). Puro. */
export function idUtenteDaCookie(cookieHeader: string, url: string): string | null {
  const chiave = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const mappa = new Map<string, string>();
  for (const parte of cookieHeader.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    const nome = parte.slice(0, i).trim();
    let valore = parte.slice(i + 1).trim();
    try {
      valore = decodeURIComponent(valore);
    } catch {
      // valore gia' in chiaro
    }
    mappa.set(nome, valore);
  }
  let unito = mappa.get(chiave) ?? null;
  if (unito === null) {
    const pezzi: string[] = [];
    for (let n = 0; mappa.has(`${chiave}.${n}`); n++) pezzi.push(mappa.get(`${chiave}.${n}`)!);
    unito = pezzi.length ? pezzi.join("") : null;
  }
  if (!unito) return null;
  try {
    const testo = unito.startsWith(PREFISSO_BASE64)
      ? stringFromBase64URL(unito.slice(PREFISSO_BASE64.length))
      : unito;
    const id = (JSON.parse(testo) as { user?: { id?: unknown } })?.user?.id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

/** La chiave per l'account attivo; «anonimo» se non c'e' nessuno. Puro. */
export function chiaveConUtente(base: string, idUtente: string | null): string {
  return `${base}:${idUtente ?? "anonimo"}`;
}

/**
 * La chiave di localStorage di `base` per l'account attivo in questo browser.
 * Cancella la chiave vecchia senza utente, se c'e'. Solo nel browser.
 */
export function chiaveUtente(base: string): string {
  try {
    window.localStorage.removeItem(base);
  } catch {
    // storage negato: non c'e' niente da cancellare
  }
  let id: string | null = null;
  try {
    id = idUtenteDaCookie(document.cookie, process.env.NEXT_PUBLIC_SUPABASE_URL!);
  } catch {
    id = null;
  }
  return chiaveConUtente(base, id);
}

/**
 * Come chiaveUtente(), ma la bozza scritta da ANONIMO passa all'account che
 * entra, se lui non ne ha una sua. Serve alla bozza della chat di Bob, che
 * esiste proprio per sopravvivere al login (si scrive la richiesta, si entra,
 * si riprende): e' il comportamento di prima. Una bozza di un ALTRO account
 * non passa mai: sta sotto un'altra chiave.
 */
export function chiaveUtenteConAdozione(base: string): string {
  const mia = chiaveUtente(base);
  const anonima = chiaveConUtente(base, null);
  if (mia === anonima) return mia;
  try {
    const orfana = window.localStorage.getItem(anonima);
    if (orfana !== null) {
      if (window.localStorage.getItem(mia) === null) window.localStorage.setItem(mia, orfana);
      window.localStorage.removeItem(anonima);
    }
  } catch {
    // storage negato: nessuna bozza da adottare
  }
  return mia;
}
