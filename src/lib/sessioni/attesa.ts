// LE SESSIONI MULTIPLE: DUE ACCOUNT NELLO STESSO BROWSER (29/09, Lucio).
//
// Decisioni di Lucio del 29/09 (docs/Bob_Doppio_Cappello_Design_Spike.md §10):
//   1. un account ATTIVO alla volta, per browser; l'altro resta vivo, IN ATTESA;
//   2. la sessione in attesa sta in un cookie httpOnly (bob-attesa), mai
//      leggibile dal JavaScript della pagina;
//   3. nessun rinnovo in sottofondo dell'account in attesa: si rinnova quando ci
//      si torna sopra; se il refresh non va piu', quell'account e' «da
//      riconnettere». L'account attivo non si tocca mai.
//
// QUESTO FILE E' PURO: niente next/headers, niente rete. Legge e scrive i
// cookie come stringhe e decide cosa fare; chi chiama (le route in
// src/app/api/sessioni/) esegue. Cosi' si prova tutto con vitest.
//
// PERCHE' bob-attesa NON E' CIFRATO (decisione di Lucio, 29/09, scritta in
// docs/NOTE_E_DECISIONI.md). Il refresh token dell'account ATTIVO sta gia' in
// chiaro nei cookie sb-, messi li' da @supabase/ssr. Cifrare solo quello in
// attesa aggiungerebbe una variabile d'ambiente, una chiave da ruotare e un
// modo nuovo di rompersi, per proteggere la sessione secondaria meglio della
// principale: una protezione disomogenea, cioe' una che sembra esserci. Il
// giorno in cui si cifra, si cifrano tutti e due insieme.

import {
  DEFAULT_COOKIE_OPTIONS,
  combineChunks,
  createChunks,
  stringFromBase64URL,
  stringToBase64URL,
} from "@supabase/ssr";

/** Il cookie dell'account in attesa. Non comincia per «sb-»: @supabase/ssr non lo legge mai. */
export const COOKIE_ATTESA = "bob-attesa";

/**
 * httpOnly, Secure, SameSite=Lax, path=/ (decisione di Lucio). La scadenza e'
 * QUELLA del cookie di sessione di @supabase/ssr (400 giorni): sul piano Free
 * il refresh di Supabase non scade a tempo, quindi il limite vero e' quello
 * del cookie dell'account attivo, e il secondario non deve durare di piu'.
 */
export const OPZIONI_COOKIE_ATTESA = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: DEFAULT_COOKIE_OPTIONS.maxAge as number,
};

/**
 * Dentro bob-attesa SOLO questi tre campi (decisione di Lucio): niente nome,
 * niente ruolo, niente livello. refreshToken null = «da riconnettere».
 */
export interface Attesa {
  refreshToken: string | null;
  userId: string;
  email: string;
}

/** La sessione come la conserva supabase-js: ci servono token e identita'. */
export interface SessioneSupabase {
  access_token: string;
  refresh_token: string;
  user: { id: string; email?: string | null; [altro: string]: unknown };
  [altro: string]: unknown;
}

export interface Cookie {
  name: string;
  value: string;
}

const PREFISSO_BASE64 = "base64-";

// ---------------------------------------------------------------------------
// bob-attesa: lettura rigida, scrittura minima
// ---------------------------------------------------------------------------

/**
 * Legge bob-attesa. Rigida di proposito: un campo in piu', un tipo sbagliato o
 * un valore malformato valgono «nessun account in attesa», non un tentativo di
 * interpretazione.
 */
export function leggiAttesa(valore: string | undefined | null): Attesa | null {
  if (!valore) return null;
  let grezzo: unknown;
  try {
    grezzo = JSON.parse(stringFromBase64URL(valore));
  } catch {
    return null;
  }
  if (!grezzo || typeof grezzo !== "object" || Array.isArray(grezzo)) return null;
  const o = grezzo as Record<string, unknown>;
  const chiavi = Object.keys(o).sort().join(",");
  if (chiavi !== "email,refreshToken,userId") return null;
  if (typeof o.userId !== "string" || !o.userId) return null;
  if (typeof o.email !== "string") return null;
  if (o.refreshToken !== null && (typeof o.refreshToken !== "string" || !o.refreshToken)) return null;
  return { refreshToken: o.refreshToken as string | null, userId: o.userId, email: o.email };
}

/** Scrive bob-attesa con i soli tre campi, qualunque cosa riceva. */
export function serializzaAttesa(a: Attesa): string {
  return stringToBase64URL(
    JSON.stringify({ refreshToken: a.refreshToken, userId: a.userId, email: a.email })
  );
}

// ---------------------------------------------------------------------------
// I cookie sb- di @supabase/ssr: stesso formato, stessi helper della libreria
// ---------------------------------------------------------------------------

/** La chiave dei cookie di sessione di supabase-js: sb-<ref del progetto>-auth-token. */
export function chiaveSupabase(url: string): string {
  return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
}

function eChiaveOPezzo(nome: string, chiave: string): boolean {
  return nome === chiave || new RegExp(`^${chiave.replace(/[-.]/g, "\\$&")}\\.\\d+$`).test(nome);
}

/**
 * Legge la sessione ATTIVA dai cookie sb-, SENZA rinnovarla (decisione 3:
 * l'attivo non si tocca). Serve solo allo scambio, per mettere in attesa il
 * refresh token cosi' com'e'. Chi sta guardando lo dice sempre
 * createClient() di src/lib/supabase/server.ts, non questa funzione.
 */
export async function leggiSessioneSupabase(
  cookies: readonly Cookie[],
  url: string
): Promise<SessioneSupabase | null> {
  const chiave = chiaveSupabase(url);
  const mappa = new Map(cookies.map((c) => [c.name, c.value]));
  const unito = await combineChunks(chiave, async (nome) => mappa.get(nome) ?? null);
  if (!unito) return null;
  let testo = unito;
  if (testo.startsWith(PREFISSO_BASE64)) {
    try {
      testo = stringFromBase64URL(testo.slice(PREFISSO_BASE64.length));
    } catch {
      return null;
    }
  }
  try {
    const s = JSON.parse(testo) as SessioneSupabase;
    if (typeof s?.access_token !== "string" || typeof s?.refresh_token !== "string") return null;
    if (typeof s?.user?.id !== "string") return null;
    return s;
  } catch {
    return null;
  }
}

/**
 * I cookie da scrivere perche' `sessione` diventi quella ATTIVA, nel formato di
 * @supabase/ssr (prefisso base64-, pezzi da MAX_CHUNK_SIZE), piu' la
 * cancellazione dei pezzi vecchi che non servono piu'. `sessione` null =
 * cancella la sessione attiva.
 */
export function cookieSessioneSupabase(
  esistenti: readonly Cookie[],
  url: string,
  sessione: SessioneSupabase | null
): { name: string; value: string; options: Record<string, unknown> }[] {
  const chiave = chiaveSupabase(url);
  const opzioni = { ...DEFAULT_COOKIE_OPTIONS } as Record<string, unknown>;
  const nuovi = sessione
    ? createChunks(chiave, PREFISSO_BASE64 + stringToBase64URL(JSON.stringify(sessione)))
    : [];
  const nomiNuovi = new Set(nuovi.map((c) => c.name));
  const daCancellare = esistenti
    .filter((c) => eChiaveOPezzo(c.name, chiave) && !nomiNuovi.has(c.name))
    .map((c) => ({ name: c.name, value: "", options: { ...opzioni, maxAge: 0 } }));
  return [...daCancellare, ...nuovi.map((c) => ({ name: c.name, value: c.value, options: opzioni }))];
}

// ---------------------------------------------------------------------------
// Lo scambio, deciso senza eseguire niente
// ---------------------------------------------------------------------------

/** Rinnova un refresh token. null se non va piu' (scaduto, gia' usato, revocato). */
export type Rinnova = (refreshToken: string) => Promise<SessioneSupabase | null>;

export type EsitoScambio =
  /** B diventa attivo; A (se c'era) va in attesa col suo refresh token intatto. */
  | { tipo: "scambiato"; nuovoAttivo: SessioneSupabase; nuovaAttesa: Attesa | null }
  /** B non si rinnova: resta in attesa «da riconnettere». L'attivo NON si tocca. */
  | { tipo: "da_riconnettere"; nuovaAttesa: Attesa }
  /** Non c'e' nessun account in attesa: niente da fare. */
  | { tipo: "nessuna_attesa" }
  /** Il refresh in attesa appartiene all'account gia' attivo: non si scambia niente. */
  | { tipo: "stesso_account" };

function attesaDa(s: SessioneSupabase): Attesa {
  return { refreshToken: s.refresh_token, userId: s.user.id, email: s.user.email ?? "" };
}

/**
 * Decide lo scambio. In NESSUN ramo il refresh token dell'account attivo viene
 * passato a `rinnova`: finisce in attesa cosi' com'e'. Se il rinnovo di B
 * fallisce, l'esito non contiene nessuna scrittura della sessione attiva.
 */
export async function decidiScambio(
  attivo: SessioneSupabase | null,
  attesa: Attesa | null,
  rinnova: Rinnova
): Promise<EsitoScambio> {
  if (!attesa) return { tipo: "nessuna_attesa" };
  if (attivo && attesa.userId === attivo.user.id) return { tipo: "stesso_account" };
  if (!attesa.refreshToken) return { tipo: "da_riconnettere", nuovaAttesa: { ...attesa, refreshToken: null } };

  let rinnovata: SessioneSupabase | null = null;
  try {
    rinnovata = await rinnova(attesa.refreshToken);
  } catch {
    rinnovata = null;
  }
  if (!rinnovata) return { tipo: "da_riconnettere", nuovaAttesa: { ...attesa, refreshToken: null } };
  // L'identita' vera e' quella che torna dal rinnovo, non quella scritta nel cookie.
  if (attivo && rinnovata.user.id === attivo.user.id) return { tipo: "stesso_account" };

  return {
    tipo: "scambiato",
    nuovoAttivo: rinnovata,
    nuovaAttesa: attivo ? attesaDa(attivo) : null,
  };
}

/** Dopo «esci da questo»: l'account in attesa diventa attivo, se si rinnova. */
export async function decidiPromozione(
  attesa: Attesa | null,
  rinnova: Rinnova
): Promise<
  | { tipo: "promosso"; nuovoAttivo: SessioneSupabase }
  | { tipo: "da_riconnettere"; nuovaAttesa: Attesa }
  | { tipo: "nessuna_attesa" }
> {
  if (!attesa) return { tipo: "nessuna_attesa" };
  if (!attesa.refreshToken) return { tipo: "da_riconnettere", nuovaAttesa: attesa };
  let r: SessioneSupabase | null = null;
  try {
    r = await rinnova(attesa.refreshToken);
  } catch {
    r = null;
  }
  return r
    ? { tipo: "promosso", nuovoAttivo: r }
    : { tipo: "da_riconnettere", nuovaAttesa: { ...attesa, refreshToken: null } };
}
