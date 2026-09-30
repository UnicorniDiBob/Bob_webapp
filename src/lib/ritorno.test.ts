import { describe, expect, it } from "vitest";
import { ritornoInterno } from "./ritorno";

describe("ritornoInterno", () => {
  it("tiene i percorsi interni, con query e ancora", () => {
    expect(ritornoInterno("/impostazioni", "/")).toBe("/impostazioni");
    expect(ritornoInterno("/impostazioni/accesso?x=1#y", "/")).toBe("/impostazioni/accesso?x=1#y");
  });

  it("rifiuta quello che /login rifiutava gia'", () => {
    for (const p of [null, undefined, "", "impostazioni", "//evil.com", "https://evil.com"]) {
      expect(ritornoInterno(p, "/riserva")).toBe("/riserva");
    }
  });

  it("rifiuta i percorsi che il browser porta fuori dal sito", () => {
    for (const p of ["/\\evil.com", "/\\/evil.com", "/\t/evil.com", "/\n/evil.com", "/%09/x\\y"]) {
      expect(ritornoInterno(p, "/riserva")).toBe("/riserva");
    }
  });

  it("un backslash codificato resta un percorso interno", () => {
    expect(ritornoInterno("/%5Cevil.com", "/")).toBe("/%5Cevil.com");
  });
});
