import { createServerClient } from "@supabase/ssr";

// LA COSTRUZIONE DEL CLIENT SERVER, IN UN POSTO SOLO (29/09, sessioni multiple).
//
// E' il PUNTO UNICO che dice «chi sta guardando» lato server: createClient()
// di ./server.ts la usa sui cookie della richiesta, e il test
// ./punto-unico.test.ts la usa con cookie finti. Con due sessioni nello stesso
// browser, una route che ricavasse l'utente in un altro modo agirebbe
// sull'account sbagliato con un token valido, e la RLS non la fermerebbe:
// per lei quell'utente e' legittimo. Chi deve sapere chi chiama passa di qui.
//
// @supabase/ssr legge SOLO i cookie sb-<ref>-auth-token: bob-attesa (l'account
// in attesa, lib/sessioni/attesa.ts) non viene mai letto da questo client.

export interface BarattoloCookie {
  getAll(): { name: string; value: string }[];
  setAll(c: { name: string; value: string; options?: Record<string, unknown> }[]): void;
}

export function creaClientServer(
  url: string,
  chiaveAnon: string,
  cookie: BarattoloCookie,
  extra: { fetch?: typeof fetch; realtime?: { transport: never } } = {}
) {
  return createServerClient(url, chiaveAnon, {
    cookies: {
      getAll: () => cookie.getAll(),
      setAll: (c: { name: string; value: string; options?: Record<string, unknown> }[]) => cookie.setAll(c),
    },
    ...(extra.fetch ? { global: { fetch: extra.fetch } } : {}),
    ...(extra.realtime ? { realtime: extra.realtime } : {}),
  });
}
