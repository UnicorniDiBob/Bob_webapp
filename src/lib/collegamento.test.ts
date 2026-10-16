import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_PRO_PER_RICHIESTA, rifiutoCollegamento } from "./collegamento";

describe("i rifiuti della 125, in parole", () => {
  it("il pro non pronto, il proprio profilo, il tetto: la frase del database", () => {
    for (const [code, message] of [
      ["42501", "Questo professionista non è disponibile per nuove richieste."],
      ["42501", "Non puoi contattare il tuo stesso profilo da professionista."],
      ["23514", "Puoi contattare al massimo 3 professionisti per richiesta."],
    ]) {
      expect(rifiutoCollegamento({ code, message })).toBe(message);
    }
  });

  it("il rifiuto generico delle policy non e' una frase per il cliente", () => {
    expect(
      rifiutoCollegamento({
        code: "42501",
        message: 'new row violates row-level security policy for table "request_professionals"',
      })
    ).toBeNull();
  });

  it("un errore qualunque, o niente, resta al messaggio generico", () => {
    expect(rifiutoCollegamento({ code: "08006", message: "connection failure" })).toBeNull();
    expect(rifiutoCollegamento(new Error("rete"))).toBeNull();
    expect(rifiutoCollegamento(null)).toBeNull();
  });

  it("lo stesso tetto della migrazione e gli stessi testi dei RAISE", () => {
    const sql = readFileSync("supabase/migrations/125_collegamento_pro_guardia.sql", "utf8");
    expect(sql).toContain(`having count(*) > ${MAX_PRO_PER_RICHIESTA}`);
    expect(sql).toContain(`'Puoi contattare al massimo ${MAX_PRO_PER_RICHIESTA} professionisti per richiesta.'`);
    expect(sql).toContain("'Questo professionista non è disponibile per nuove richieste.'");
    expect(sql).toContain("'Non puoi contattare il tuo stesso profilo da professionista.'");
  });
});
