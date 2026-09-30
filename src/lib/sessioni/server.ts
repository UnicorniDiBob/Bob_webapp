// Il lato server delle sessioni multiple: esegue quello che attesa.ts decide.
// Solo per le route in src/app/api/sessioni/, che il middleware NON attraversa
// (vedi il matcher in src/middleware.ts): se lo attraversassero, il middleware
// rinnoverebbe la sessione attiva nella stessa richiesta dello scambio e i
// cookie di A e di B si contenderebbero la risposta.

import { cookies } from "next/headers";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import {
  COOKIE_ATTESA,
  OPZIONI_COOKIE_ATTESA,
  cookieSessioneSupabase,
  leggiAttesa,
  leggiSessioneSupabase,
  serializzaAttesa,
  type Attesa,
  type Rinnova,
  type SessioneSupabase,
} from "./attesa";

const URL_SB = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Un client senza cookie e senza memoria: non tocca la sessione di nessuno. */
function clientIsolato() {
  return createSupabaseJs(URL_SB(), ANON(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Rinnova un refresh token dell'account IN ATTESA, al momento del ritorno
 * (decisione 3: nessun rinnovo in sottofondo). null se Supabase lo rifiuta
 * (scaduto, gia' usato, revocato). Il motivo non si registra: basta sapere che
 * l'account va riconnesso.
 */
export const rinnovaSulServer: Rinnova = async (refreshToken) => {
  const { data, error } = await clientIsolato().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return null;
  return data.session as unknown as SessioneSupabase;
};

/**
 * Chiude una sessione SOLO in questo browser (scope local): revoca i suoi
 * refresh token su Supabase senza toccare gli altri dispositivi dello stesso
 * utente. Prima si usava lo scope predefinito, che e' globale (vedi
 * docs/NOTE_E_DECISIONI.md, 29/09).
 */
export async function revocaLocale(accessToken: string): Promise<boolean> {
  try {
    const r = await fetch(`${URL_SB()}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: ANON(), authorization: `Bearer ${accessToken}` },
    });
    return r.ok || r.status === 204;
  } catch {
    return false;
  }
}

/** Chiude una sessione in questo browser, anche se il suo access token e' scaduto. */
export async function chiudiSessione(s: { access_token: string; refresh_token: string | null }): Promise<boolean> {
  if (await revocaLocale(s.access_token)) return true;
  // Access token scaduto: per revocarla serve un token valido. Si rinnova
  // SOLO per chiuderla subito dopo.
  if (!s.refresh_token) return false;
  const nuova = await rinnovaSulServer(s.refresh_token);
  return nuova ? revocaLocale(nuova.access_token) : false;
}

/** I cookie della richiesta, per chi li deve leggere e scrivere nello scambio. */
export function barattolo() {
  const jar = cookies();
  return {
    tutti: () => jar.getAll().map(({ name, value }) => ({ name, value })),
    attivo: () => leggiSessioneSupabase(jar.getAll(), URL_SB()),
    attesa: (): Attesa | null => leggiAttesa(jar.get(COOKIE_ATTESA)?.value),
    scriviAttivo: (s: SessioneSupabase | null) => {
      for (const c of cookieSessioneSupabase(jar.getAll(), URL_SB(), s)) {
        jar.set(c.name, c.value, c.options);
      }
    },
    scriviAttesa: (a: Attesa | null) => {
      if (a) jar.set(COOKIE_ATTESA, serializzaAttesa(a), OPZIONI_COOKIE_ATTESA);
      else jar.set(COOKIE_ATTESA, "", { ...OPZIONI_COOKIE_ATTESA, maxAge: 0 });
    },
  };
}

/**
 * Le route delle sessioni accettano solo richieste dal sito stesso. SameSite=Lax
 * gia' tiene fuori i POST da altri siti; questo controllo e' la seconda rete.
 */
export function stessaOrigine(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * Login con email e password su un client isolato: la sessione che nasce non
 * tocca i cookie di nessuno, e chi chiama decide se tenerla (in bob-attesa) o
 * revocarla. null per QUALUNQUE rifiuto di Supabase, senza distinguere: la
 * route non deve dire se l'email esiste. Ne' la password ne' l'email finiscono
 * in un log.
 */
export async function accediIsolato(email: string, password: string): Promise<SessioneSupabase | null> {
  try {
    const { data, error } = await clientIsolato().auth.signInWithPassword({ email, password });
    if (error || !data.session) return null;
    return data.session as unknown as SessioneSupabase;
  } catch {
    return null;
  }
}
