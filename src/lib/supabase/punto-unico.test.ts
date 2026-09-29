// IL PUNTO UNICO LATO SERVER (29/09, sessioni multiple).
//
// Chi sta guardando lo dice UNA funzione: createClient() di
// src/lib/supabase/server.ts, cioe' createServerClient di @supabase/ssr sui
// cookie della richiesta. Il 29/09 nessuna route ricavava l'utente per conto
// suo — ma «oggi e' cosi'» non e' una rete. Questi test lo sono: con A attivo
// e B in attesa (bob-attesa), il server vede solo A, e niente di B esce mai.
// La prossima route che provasse a leggere l'utente altrove deve passare di qui.

import { describe, expect, it, vi } from "vitest";
import { creaClientServer } from "./fabbrica";
import {
  COOKIE_ATTESA,
  cookieSessioneSupabase,
  serializzaAttesa,
  type Cookie,
  type SessioneSupabase,
} from "../sessioni/attesa";

const URL_SB = "https://progettoprova.supabase.co";
const ANON = "chiave-anon-di-prova";
const futuro = Math.floor(Date.now() / 1000) + 3600;
const jwt = (sub: string) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub, exp: futuro, role: "authenticated" })).toString("base64url"),
    "firma",
  ].join(".");
const sessione = (id: string, email: string): SessioneSupabase => ({
  access_token: jwt(id),
  refresh_token: `refresh-${id}`,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: futuro,
  user: { id, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
});
class WsFinta {}
const realtime = { transport: WsFinta as never };
const A = sessione("utente-a", "a@esempio.it");
const B = sessione("utente-b", "b@esempio.it");

function barattolo(attivo: SessioneSupabase | null): Cookie[] {
  const sb = cookieSessioneSupabase([], URL_SB, attivo).map(({ name, value }) => ({ name, value }));
  return [
    ...sb,
    { name: COOKIE_ATTESA, value: serializzaAttesa({ refreshToken: B.refresh_token, userId: B.user.id, email: "b@esempio.it" }) },
  ];
}

describe("IL PUNTO UNICO: con A attivo e B in attesa, il server vede solo A", () => {
  // La fetch finta registra ogni chiamata che il client fa.
  function clientServer(cookie: Cookie[]) {
    const chiamate: { url: string; auth: string | null; corpo: string }[] = [];
    const fetchFinta = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const h = new Headers(init?.headers);
      chiamate.push({ url, auth: h.get("authorization"), corpo: typeof init?.body === "string" ? init.body : "" });
      if (url.includes("/auth/v1/user")) {
        return new Response(JSON.stringify(A.user), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    });
    // La STESSA costruzione di createClient() in ./server.ts.
    const client = creaClientServer(
      URL_SB,
      ANON,
      { getAll: () => cookie, setAll: () => {} },
      { fetch: fetchFinta as unknown as typeof fetch, realtime }
    );
    return { client, chiamate };
  }
  const tuttoIlTraffico = (c: { url: string; auth: string | null; corpo: string }[]) =>
    c.map((x) => `${x.url} ${x.auth ?? ""} ${x.corpo}`).join("\n");

  it("chi sta guardando e' A", async () => {
    const { client, chiamate } = clientServer(barattolo(A));
    const { data } = await client.auth.getUser();
    expect(data.user?.id).toBe("utente-a");
    expect(chiamate.find((c) => c.url.includes("/auth/v1/user"))?.auth).toBe(`Bearer ${A.access_token}`);
  });

  it("una lettura e una scrittura sotto RLS partono col token di A, mai con B", async () => {
    const { client, chiamate } = clientServer(barattolo(A));
    await client.from("requests").select("id");
    await client.from("request_messages").insert({ body: "ciao" });
    const dati = chiamate.filter((c) => c.url.includes("/rest/v1/"));
    expect(dati).toHaveLength(2);
    for (const c of dati) expect(c.auth).toBe(`Bearer ${A.access_token}`);
  });

  it("niente di B esce mai dal server: ne' il suo refresh, ne' il suo token", async () => {
    const { client, chiamate } = clientServer(barattolo(A));
    await client.auth.getUser();
    await client.from("requests").select("id");
    const t = tuttoIlTraffico(chiamate);
    expect(t).not.toContain(B.refresh_token);
    expect(t).not.toContain(B.access_token);
    expect(t).not.toContain("utente-b");
  });

  it("senza account attivo, B in attesa NON diventa chi guarda: il server vede nessuno", async () => {
    const { client, chiamate } = clientServer(barattolo(null));
    const { data } = await client.auth.getSession();
    expect(data.session).toBeNull();
    expect(tuttoIlTraffico(chiamate)).not.toContain(B.refresh_token);
  });
});

