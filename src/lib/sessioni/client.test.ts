// L'avviso fra schede: un segnale malformato non deve far niente, e i tre
// segnali validi arrivano uguali da BroadcastChannel e dall'evento «storage».

import { describe, expect, it } from "vitest";
import { interpretaSegnale } from "./client";

describe("interpretaSegnale", () => {
  it("riconosce i tre segnali, da BroadcastChannel (oggetto) e da storage (stringa)", () => {
    for (const s of ["inizio", "fatto", "annullato"] as const) {
      expect(interpretaSegnale({ s })).toBe(s);
      expect(interpretaSegnale(JSON.stringify({ s, t: 1 }))).toBe(s);
    }
  });
  it("tutto il resto vale nessun segnale", () => {
    for (const x of [null, undefined, 3, "boh", "{}", { s: "scambia" }, JSON.stringify({ s: "altro" })]) {
      expect(interpretaSegnale(x)).toBeNull();
    }
  });
});
