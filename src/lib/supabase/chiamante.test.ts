// LA STRADA BEARER DI chiamante() (16/10): il token lo giudica Supabase, e
// il client che ne esce parla SOLO con quel token. La strada cookie e' quella
// di punto-unico.test.ts e qui non si riprova.

import { describe, expect, it, vi } from "vitest";
import { riconosciDaToken, tokenBearer } from "./chiamante";

const URL_SB = "https://progettoprova.supabase.co";
const ANON = "chiave-anon-di-prova";
class WsFinta {}
const realtime = { transport: WsFinta as never };

function supabaseFinto(valido: string) {
  const chiamate: { url: string; auth: string | null }[] = [];
  const fetchFinta = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get("authorization");
    chiamate.push({ url, auth });
    if (url.includes("/auth/v1/user")) {
      if (auth === `Bearer ${valido}`) {
        return new Response(JSON.stringify({ id: "utente-a", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      // La risposta di GoTrue a un token scaduto (firma buona, exp passato).
      return new Response(JSON.stringify({ code: 403, error_code: "bad_jwt", msg: "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired" }), { status: 403, headers: { "content-type": "application/json" } });
    }
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  });
  return { fetchFinta: fetchFinta as unknown as typeof fetch, chiamate };
}

describe("tokenBearer", () => {
  it("legge solo lo schema Bearer, senza badare alle maiuscole", () => {
    expect(tokenBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(tokenBearer("bearer abc")).toBe("abc");
    expect(tokenBearer(null)).toBeNull();
    expect(tokenBearer("Basic dXNlcjpwdw==")).toBeNull();
    expect(tokenBearer("Bearer ")).toBeNull();
    expect(tokenBearer("Bearer a b")).toBeNull();
  });
});

describe("riconosciDaToken: decide Supabase, non la decodifica", () => {
  it("token valido: l'utente e' quello che risponde /auth/v1/user", async () => {
    const { fetchFinta, chiamate } = supabaseFinto("buono");
    const c = await riconosciDaToken(URL_SB, ANON, "buono", { fetch: fetchFinta, realtime });
    expect(c.user?.id).toBe("utente-a");
    expect(c.tokenRifiutato).toBe(false);
    expect(chiamate.some((x) => x.url.includes("/auth/v1/user"))).toBe(true);
  });

  it("token scaduto: Supabase risponde bad_jwt, il chiamante e' nessuno e lo dice", async () => {
    const { fetchFinta, chiamate } = supabaseFinto("buono");
    const c = await riconosciDaToken(URL_SB, ANON, "scaduto", { fetch: fetchFinta, realtime });
    expect(c.user).toBeNull();
    expect(c.tokenRifiutato).toBe(true);
    expect(c.via).toBe("bearer");
    // Il giudizio e' arrivato da /auth/v1/user, non da una decodifica locale.
    expect(chiamate.find((x) => x.url.includes("/auth/v1/user"))?.auth).toBe("Bearer scaduto");
  });

  it("le query sotto RLS partono col token del chiamante, mai con la chiave anon", async () => {
    const { fetchFinta, chiamate } = supabaseFinto("buono");
    const c = await riconosciDaToken(URL_SB, ANON, "buono", { fetch: fetchFinta, realtime });
    await c.supabase.from("requests").select("id");
    const dati = chiamate.filter((x) => x.url.includes("/rest/v1/"));
    expect(dati).toHaveLength(1);
    expect(dati[0].auth).toBe("Bearer buono");
  });
});
