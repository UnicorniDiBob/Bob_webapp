import { createClient as createSupabaseJs, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createClientDaCookie } from "./server";

// CHI CHIAMA UNA ROUTE: il cookie del sito, oppure un token Bearer (16/10).
//
// Resta IL PUNTO UNICO di ./fabbrica.ts: una route che deve sapere chi chiama
// passa di qui, e da nessun'altra parte. Le strade sono due, mai mescolate:
//
// - Nessun header Authorization Bearer: e' la strada del sito, IDENTICA a
//   prima — createClient() di ./server.ts sui cookie e getUser(). Il sito non
//   manda mai quell'header, quindi per lui non cambia niente.
// - Authorization: Bearer <jwt>: conta SOLO il token. Lo valida Supabase
//   (getUser(jwt) chiama /auth/v1/user: firma, scadenza, sessione non
//   revocata), non lo decodifichiamo noi. Se Supabase lo rifiuta il chiamante
//   e' nessuno, e i cookie NON vengono letti: ripiegare sul cookie farebbe
//   agire la richiesta con un'identita' diversa da quella che ha presentato
//   (lo stesso guaio delle sessioni multiple del 29/09).
//
// Il client restituito porta il token del chiamante: le query sotto RLS
// vedono lo stesso utente che getUser() ha riconosciuto.

export type Via = "cookie" | "bearer";

export interface Chiamante {
  supabase: SupabaseClient;
  user: User | null;
  via: Via;
  /** C'era un Bearer e Supabase l'ha rifiutato (scaduto, revocato, falso). */
  tokenRifiutato: boolean;
}

/** Il token di un header Authorization "Bearer <jwt>"; null se non e' Bearer. */
export function tokenBearer(header: string | null): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return m ? m[1] : null;
}

/** Un client senza cookie e senza memoria, che parla col token del chiamante. */
export function clientDaToken(
  url: string,
  chiaveAnon: string,
  jwt: string,
  extra: { fetch?: typeof fetch; realtime?: { transport: never } } = {}
): SupabaseClient {
  return createSupabaseJs(url, chiaveAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
      ...(extra.fetch ? { fetch: extra.fetch } : {}),
    },
    ...(extra.realtime ? { realtime: extra.realtime } : {}),
  });
}

/** La strada Bearer da sola, senza next/headers: e' quella che prova il test. */
export async function riconosciDaToken(
  url: string,
  chiaveAnon: string,
  jwt: string,
  extra: { fetch?: typeof fetch; realtime?: { transport: never } } = {}
): Promise<Chiamante> {
  const supabase = clientDaToken(url, chiaveAnon, jwt, extra);
  const { data, error } = await supabase.auth.getUser(jwt);
  const user = !error && data.user ? data.user : null;
  return { supabase, user, via: "bearer", tokenRifiutato: !user };
}

export async function chiamante(request: Request): Promise<Chiamante> {
  // Un header Authorization che c'e' ma non e' un Bearer leggibile ("Bearer"
  // senza token, "Bearer a b") e' una credenziale presentata male: rifiutata,
  // non ignorata in favore del cookie.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const chiaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const header = request.headers.get("authorization");
  const jwt = tokenBearer(header);
  if (jwt) return riconosciDaToken(url, chiaveAnon, jwt);
  if (/^Bearer\b/i.test(header ?? "")) {
    const supabase = createSupabaseJs(url, chiaveAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return { supabase, user: null, via: "bearer", tokenRifiutato: true };
  }

  const supabase = createClientDaCookie();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase: supabase as unknown as SupabaseClient, user, via: "cookie", tokenRifiutato: false };
}
