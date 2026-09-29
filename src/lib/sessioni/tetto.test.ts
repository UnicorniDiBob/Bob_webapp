// Il tetto per email: un HMAC con una chiave segreta, mai l'indirizzo e mai un
// hash nudo che si inverte provando indirizzi.

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chiaveEmail, chiaveIp, normalizzaEmail, segretoValido } from "./tetto";

const SEGRETO = "s".repeat(40);

describe("chiaveEmail", () => {
  it("non contiene l'indirizzo, in nessuna forma", () => {
    const k = chiaveEmail("Mario.Rossi@Esempio.it", SEGRETO);
    expect(k.startsWith("email:")).toBe(true);
    expect(k.toLowerCase()).not.toContain("mario");
    expect(k.toLowerCase()).not.toContain("esempio");
  });
  it("non e' uno SHA-256 nudo dell'indirizzo (che si invertirebbe)", () => {
    const nudo = createHash("sha256").update("mario.rossi@esempio.it").digest("hex");
    expect(chiaveEmail("mario.rossi@esempio.it", SEGRETO)).not.toBe(`email:${nudo}`);
  });
  it("cambia con la chiave: senza la chiave non si ricostruisce", () => {
    expect(chiaveEmail("a@b.it", SEGRETO)).not.toBe(chiaveEmail("a@b.it", "t".repeat(40)));
  });
  it("e' la stessa per lo stesso indirizzo scritto in modi diversi", () => {
    expect(chiaveEmail("  A@B.it ", SEGRETO)).toBe(chiaveEmail("a@b.it", SEGRETO));
    expect(normalizzaEmail("  A@B.it ")).toBe("a@b.it");
  });
});

describe("segretoValido", () => {
  it("almeno 32 caratteri, altrimenti la route rifiuta invece di ripiegare", () => {
    expect(segretoValido(undefined)).toBe(false);
    expect(segretoValido("corto")).toBe(false);
    expect(segretoValido("x".repeat(32))).toBe(true);
  });
});

describe("chiaveIp", () => {
  it("come per chat e brief", () => {
    expect(chiaveIp("1.2.3.4")).toBe("ip:1.2.3.4");
  });
});
