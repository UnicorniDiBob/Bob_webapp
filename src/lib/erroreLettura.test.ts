import { describe, expect, it } from "vitest";
import {
  ErroreLettura,
  TESTO_RETE,
  TESTO_SERVER,
  controlla,
  erroreDaPostgrest,
  testoErrore,
} from "./erroreLettura";

describe("erroreLettura", () => {
  it("una risposta che non arriva e' un errore di rete", () => {
    const e = erroreDaPostgrest({ message: "TypeError: Failed to fetch" });
    expect(e.tipo).toBe("rete");
    expect(e.message).toBe(TESTO_RETE);
  });

  it("un errore con codice e' del server, anche se parla di fetch", () => {
    expect(erroreDaPostgrest({ code: "42501", message: "fetch denied" }).tipo).toBe("server");
    expect(erroreDaPostgrest({ code: "PGRST301", message: "JWT expired" }).message).toBe(TESTO_SERVER);
  });

  it("controlla lancia solo se c'e' un errore", () => {
    expect(() => controlla(null)).not.toThrow();
    expect(() => controlla(undefined)).not.toThrow();
    expect(() => controlla({ code: "500", message: "x" })).toThrow(ErroreLettura);
  });

  it("testoErrore: il testo giusto per ogni cosa lanciata", () => {
    expect(testoErrore(new ErroreLettura("rete", TESTO_RETE))).toBe(TESTO_RETE);
    expect(testoErrore(new TypeError("Failed to fetch"))).toBe(TESTO_RETE);
    expect(testoErrore(new Error("boh"))).toBe(TESTO_SERVER);
  });
});
