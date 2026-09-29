// Le chiavi del browser per account: l'id si legge dal cookie della sessione
// attiva, nel formato di @supabase/ssr, anche quando e' diviso in pezzi.

import { describe, expect, it } from "vitest";
import { chiaveConUtente, idUtenteDaCookie } from "./chiavi";
import { cookieSessioneSupabase, type SessioneSupabase } from "./attesa";

const URL_SB = "https://progettoprova.supabase.co";
const sessione = (id: string, extra = ""): SessioneSupabase => ({
  access_token: "a",
  refresh_token: "r",
  user: { id, email: `${id}@x.it`, user_metadata: { extra } },
});
const header = (s: SessioneSupabase | null, altro = "bob-attesa=qualcosa; tema=scuro") =>
  [
    ...cookieSessioneSupabase([], URL_SB, s).map((c) => `${c.name}=${encodeURIComponent(c.value)}`),
    altro,
  ].join("; ");

describe("idUtenteDaCookie", () => {
  it("legge l'utente della sessione attiva", () => {
    expect(idUtenteDaCookie(header(sessione("utente-a")), URL_SB)).toBe("utente-a");
  });
  it("anche quando il cookie e' diviso in pezzi", () => {
    expect(idUtenteDaCookie(header(sessione("utente-a", "x".repeat(6000))), URL_SB)).toBe("utente-a");
  });
  it("non legge mai bob-attesa: senza sessione attiva, nessuno", () => {
    expect(idUtenteDaCookie(header(null), URL_SB)).toBeNull();
  });
  it("un cookie malformato vale nessuno, non un errore", () => {
    expect(idUtenteDaCookie("sb-progettoprova-auth-token=base64-!!!", URL_SB)).toBeNull();
    expect(idUtenteDaCookie("", URL_SB)).toBeNull();
  });
});

describe("chiaveConUtente", () => {
  it("una chiave per account, e una per chi non e' entrato", () => {
    expect(chiaveConUtente("bob-chat-draft-v1", "utente-a")).toBe("bob-chat-draft-v1:utente-a");
    expect(chiaveConUtente("bob-chat-draft-v1", "utente-b")).not.toBe(chiaveConUtente("bob-chat-draft-v1", "utente-a"));
    expect(chiaveConUtente("bob-chat-draft-v1", null)).toBe("bob-chat-draft-v1:anonimo");
  });
});
