// Le sessioni multiple. La cosa che conta, e che questi test provano: con due
// sessioni vive, una richiesta fatta mentre e' attivo A non legge e non scrive
// MAI per conto di B — nemmeno se B e' scaduto, nemmeno se il refresh di B e'
// gia' stato usato.

import { describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import {
  COOKIE_ATTESA,
  OPZIONI_COOKIE_ATTESA,
  chiaveSupabase,
  cookieSessioneSupabase,
  decidiPromozione,
  decidiScambio,
  leggiAttesa,
  leggiSessioneSupabase,
  serializzaAttesa,
  type Cookie,
  type SessioneSupabase,
} from "./attesa";

const URL_SB = "https://progettoprova.supabase.co";
const ANON = "chiave-anon-di-prova";
const futuro = Math.floor(Date.now() / 1000) + 3600;

// Un JWT finto ma ben formato: supabase-js ne legge solo la scadenza.
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

// Node 20 non ha WebSocket: il client realtime di supabase-js ne vuole uno anche
// se nessun test si iscrive a un canale. Un trasporto finto basta.
class WsFinta {}
const realtime = { transport: WsFinta as never };

const A = sessione("utente-a", "a@esempio.it");
const B = sessione("utente-b", "b@esempio.it");

/** I cookie di un browser con A attivo e B in attesa. */
function barattolo(attivo: SessioneSupabase | null, attesaB = true): Cookie[] {
  const sb = cookieSessioneSupabase([], URL_SB, attivo).map(({ name, value }) => ({ name, value }));
  const attesa = attesaB
    ? [{ name: COOKIE_ATTESA, value: serializzaAttesa({ refreshToken: B.refresh_token, userId: B.user.id, email: "b@esempio.it" }) }]
    : [];
  return [...sb, ...attesa];
}

describe("bob-attesa: solo refresh token, id ed email", () => {
  it("andata e ritorno", () => {
    const a = { refreshToken: "rt", userId: "u", email: "e@x.it" };
    expect(leggiAttesa(serializzaAttesa(a))).toEqual(a);
  });
  it("scrive i soli tre campi, anche se riceve di piu'", () => {
    const sporco = { refreshToken: "rt", userId: "u", email: "e", nome: "Mario", role: "professional" } as never;
    const letto = JSON.parse(Buffer.from(serializzaAttesa(sporco), "base64url").toString());
    expect(Object.keys(letto).sort()).toEqual(["email", "refreshToken", "userId"]);
  });
  it("rifiuta un cookie con campi in piu', tipi sbagliati o malformato", () => {
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    expect(leggiAttesa(enc({ refreshToken: "r", userId: "u", email: "e", role: "admin" }))).toBeNull();
    expect(leggiAttesa(enc({ refreshToken: 3, userId: "u", email: "e" }))).toBeNull();
    expect(leggiAttesa(enc({ refreshToken: "r", userId: "", email: "e" }))).toBeNull();
    expect(leggiAttesa("non-json")).toBeNull();
    expect(leggiAttesa(undefined)).toBeNull();
  });
  it("refreshToken null vuol dire «da riconnettere», ed e' valido", () => {
    expect(leggiAttesa(serializzaAttesa({ refreshToken: null, userId: "u", email: "e" }))).toEqual({
      refreshToken: null,
      userId: "u",
      email: "e",
    });
  });
  it("il cookie e' httpOnly, Secure, SameSite=Lax, path=/, e non dura piu' di quello di Supabase", () => {
    expect(OPZIONI_COOKIE_ATTESA).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(OPZIONI_COOKIE_ATTESA.maxAge).toBeLessThanOrEqual(400 * 24 * 60 * 60);
    expect(COOKIE_ATTESA.startsWith("sb-")).toBe(false);
  });
});

describe("i cookie sb- nel formato di @supabase/ssr", () => {
  it("la chiave e' quella di supabase-js", () => {
    expect(chiaveSupabase(URL_SB)).toBe("sb-progettoprova-auth-token");
  });
  it("andata e ritorno, anche quando la sessione va divisa in pezzi", async () => {
    const grande = { ...A, user: { ...A.user, user_metadata: { nota: "x".repeat(6000) } } };
    const cookie = cookieSessioneSupabase([], URL_SB, grande);
    expect(cookie.length).toBeGreaterThan(1);
    expect(await leggiSessioneSupabase(cookie, URL_SB)).toEqual(grande);
  });
  it("sostituendo una sessione grande con una piccola, i pezzi vecchi si cancellano", () => {
    const grande = cookieSessioneSupabase([], URL_SB, { ...A, user: { ...A.user, user_metadata: { n: "x".repeat(6000) } } });
    const piccola = cookieSessioneSupabase(grande, URL_SB, B);
    const cancellati = piccola.filter((c) => c.value === "").map((c) => c.name);
    const scritti = piccola.filter((c) => c.value !== "").map((c) => c.name);
    expect(new Set([...cancellati, ...scritti])).toEqual(new Set([...grande.map((c) => c.name), ...scritti]));
    expect(cancellati.every((n) => !scritti.includes(n))).toBe(true);
  });
  it("LA VERA createServerClient legge quello che scriviamo: se la libreria cambia formato, qui si vede", async () => {
    const cookie = cookieSessioneSupabase([], URL_SB, A);
    const client = createServerClient(URL_SB, ANON, {
      cookies: { getAll: () => cookie.map(({ name, value }) => ({ name, value })), setAll: () => {} },
      realtime,
    });
    const { data } = await client.auth.getSession();
    expect(data.session?.user.id).toBe("utente-a");
    expect(data.session?.refresh_token).toBe(A.refresh_token);
  });
});

describe("decidiScambio: l'attivo non si tocca mai", () => {
  const attesaB = { refreshToken: B.refresh_token, userId: B.user.id, email: "b@esempio.it" };

  it("B si rinnova: diventa attivo, A va in attesa col SUO refresh token intatto", async () => {
    const rinnova = vi.fn(async () => ({ ...B, refresh_token: "refresh-b-nuovo" }));
    const esito = await decidiScambio(A, attesaB, rinnova);
    expect(esito.tipo).toBe("scambiato");
    if (esito.tipo !== "scambiato") return;
    expect(esito.nuovoAttivo.user.id).toBe("utente-b");
    expect(esito.nuovaAttesa).toEqual({ refreshToken: A.refresh_token, userId: "utente-a", email: "a@esempio.it" });
    expect(rinnova).toHaveBeenCalledTimes(1);
    expect(rinnova).toHaveBeenCalledWith(B.refresh_token);
  });

  it("B scaduto: «da riconnettere», e nessuna scrittura della sessione attiva", async () => {
    const esito = await decidiScambio(A, attesaB, async () => null);
    expect(esito).toEqual({ tipo: "da_riconnettere", nuovaAttesa: { ...attesaB, refreshToken: null } });
    expect("nuovoAttivo" in esito).toBe(false);
  });

  it("B con un refresh gia' usato (Supabase lancia): stesso esito, A intatto", async () => {
    const esito = await decidiScambio(A, attesaB, async () => {
      throw new Error("Invalid Refresh Token: Already Used");
    });
    expect(esito.tipo).toBe("da_riconnettere");
    expect("nuovoAttivo" in esito).toBe(false);
  });

  it("il refresh token di A non viene MAI passato al rinnovo, in nessun ramo", async () => {
    const casi: ((rt: string) => Promise<SessioneSupabase | null>)[] = [
      async () => B,
      async () => null,
      async () => {
        throw new Error("x");
      },
    ];
    for (const r of casi) {
      const rinnova = vi.fn(r);
      await decidiScambio(A, attesaB, rinnova);
      for (const call of rinnova.mock.calls) expect(call[0]).not.toBe(A.refresh_token);
    }
  });

  it("B gia' «da riconnettere»: nessuna chiamata di rete", async () => {
    const rinnova = vi.fn(async () => B);
    const esito = await decidiScambio(A, { ...attesaB, refreshToken: null }, rinnova);
    expect(esito.tipo).toBe("da_riconnettere");
    expect(rinnova).not.toHaveBeenCalled();
  });

  it("se il rinnovo restituisce A stesso (cookie manomesso), non si scambia niente", async () => {
    const esito = await decidiScambio(A, attesaB, async () => A);
    expect(esito.tipo).toBe("stesso_account");
  });

  it("senza account in attesa non c'e' niente da fare", async () => {
    expect(await decidiScambio(A, null, async () => B)).toEqual({ tipo: "nessuna_attesa" });
  });
});

describe("decidiPromozione: dopo «esci da questo», l'altro diventa attivo", () => {
  it("si rinnova: promosso", async () => {
    const e = await decidiPromozione({ refreshToken: "rt", userId: "utente-b", email: "b" }, async () => B);
    expect(e.tipo).toBe("promosso");
  });
  it("non si rinnova: resta «da riconnettere», e nessuno e' attivo", async () => {
    const e = await decidiPromozione({ refreshToken: "rt", userId: "utente-b", email: "b" }, async () => null);
    expect(e).toEqual({ tipo: "da_riconnettere", nuovaAttesa: { refreshToken: null, userId: "utente-b", email: "b" } });
  });
});
