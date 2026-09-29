// «Aggiungi account» e «riconnetti»: il login fallito non tocca niente, ogni
// rifiuto ha lo stesso messaggio, e una sessione appena nata che non si puo'
// tenere viene revocata invece di restare orfana.

import { describe, expect, it } from "vitest";
import { ERRORE_CREDENZIALI, decidiDopoLogin, puoTentare } from "./aggiungi";
import type { SessioneSupabase } from "./attesa";

const s = (id: string): SessioneSupabase => ({
  access_token: `access-${id}`,
  refresh_token: `refresh-${id}`,
  user: { id, email: `${id}@x.it` },
});

describe("puoTentare: prima del login, senza rete", () => {
  it("serve un account attivo", () => {
    expect(puoTentare(null, null)).toEqual({ ok: false, motivo: "nessun_attivo" });
  });
  it("con un secondo account gia' vivo, no: prima si esce da quello", () => {
    expect(puoTentare("a", { refreshToken: "rt", userId: "b", email: "b" })).toEqual({ ok: false, motivo: "gia_due" });
  });
  it("con nessun altro account, o con uno da riconnettere, si'", () => {
    expect(puoTentare("a", null)).toEqual({ ok: true });
    expect(puoTentare("a", { refreshToken: null, userId: "b", email: "b" })).toEqual({ ok: true });
  });
});

describe("decidiDopoLogin", () => {
  it("login rifiutato: esito «credenziali», niente da scrivere e niente da revocare", () => {
    const e = decidiDopoLogin("a", null, null);
    expect(e).toEqual({ tipo: "credenziali" });
    expect("attesa" in e).toBe(false);
    expect("daRevocare" in e).toBe(false);
  });
  it("un messaggio solo, uguale per email sbagliata e password sbagliata", () => {
    // La route non distingue: qualunque rifiuto di Supabase diventa sessione
    // null, e sessione null diventa questo messaggio. Qui si fissa il testo.
    expect(ERRORE_CREDENZIALI).toBe("Email o password non corrette.");
  });
  it("login riuscito: bob-attesa con i soli tre campi", () => {
    const e = decidiDopoLogin("a", null, s("b"));
    expect(e).toEqual({ tipo: "aggiunto", attesa: { refreshToken: "refresh-b", userId: "b", email: "b@x.it" } });
  });
  it("lo stesso account gia' attivo: non si tiene, e la sessione nuova si revoca", () => {
    expect(decidiDopoLogin("a", null, s("a"))).toEqual({ tipo: "stesso_account", daRevocare: "access-a" });
  });
  it("riconnettere: lo slot «da riconnettere» lo riprende lo stesso account", () => {
    expect(decidiDopoLogin("a", { refreshToken: null, userId: "b", email: "b" }, s("b")).tipo).toBe("aggiunto");
  });
  it("un account DIVERSO non sostituisce in silenzio quello da riconnettere", () => {
    expect(decidiDopoLogin("a", { refreshToken: null, userId: "b", email: "b" }, s("c"))).toEqual({
      tipo: "altro_da_riconnettere",
      daRevocare: "access-c",
    });
  });
});
