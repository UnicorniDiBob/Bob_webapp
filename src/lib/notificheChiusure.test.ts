import { describe, expect, it } from "vitest";
import { notificheDaNoteDiBob, type NotaDiBob } from "./notificheChiusure";
import { BOB_CHIUSA, BOB_RIAPERTA } from "./scelta";

function nota(id: string, message: string, created_at: string, extra: Partial<NotaDiBob> = {}): NotaDiBob {
  return {
    id,
    request_id: "r1",
    professional_id: "p1",
    message,
    created_at,
    servizio: "Imbianchino",
    ...extra,
  };
}

describe("la campanella del pro: richiesta chiusa e riaperta", () => {
  it("archivia → riapri → archivia: tre voci, una per evento, con id diversi", () => {
    const voci = notificheDaNoteDiBob([
      nota("n3", BOB_CHIUSA, "2026-10-15T12:00:00Z"),
      nota("n2", BOB_RIAPERTA, "2026-10-15T11:00:00Z"),
      nota("n1", BOB_CHIUSA, "2026-10-15T10:00:00Z"),
    ]);
    expect(voci.map((v) => v.titolo)).toEqual([
      "Il cliente ha chiuso la richiesta · Imbianchino",
      "Il cliente ha riaperto la richiesta · Imbianchino",
      "Il cliente ha chiuso la richiesta · Imbianchino",
    ]);
    expect(new Set(voci.map((v) => v.id)).size).toBe(3);
    expect(voci.map((v) => v.quando)).toEqual([
      "2026-10-15T12:00:00Z",
      "2026-10-15T11:00:00Z",
      "2026-10-15T10:00:00Z",
    ]);
  });

  it("l'id e' stabile: la stessa nota da' sempre la stessa voce («letto» regge)", () => {
    const a = notificheDaNoteDiBob([nota("n1", BOB_CHIUSA, "2026-10-15T10:00:00Z")]);
    const b = notificheDaNoteDiBob([nota("n1", BOB_CHIUSA, "2026-10-15T10:00:00Z")]);
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].id).toBe("richiesta-chiusa:n1");
  });

  it("quieta, con il link alla conversazione e senza email", () => {
    const [v] = notificheDaNoteDiBob([nota("n1", BOB_CHIUSA, "2026-10-15T10:00:00Z")]);
    expect(v.livello).toBe("fatto");
    expect(v.href).toBe("/messaggi?r=r1&p=p1");
    expect(v.mittente).toBe("Bob");
  });

  it("non dice mai chi e' stato scelto: niente nomi di altri pro, niente «scelto»", () => {
    const voci = notificheDaNoteDiBob([
      nota("n1", BOB_CHIUSA, "2026-10-15T10:00:00Z"),
      nota("n2", BOB_RIAPERTA, "2026-10-15T11:00:00Z"),
    ]);
    for (const v of voci) {
      expect(`${v.titolo} ${v.testo}`).not.toMatch(/scelt|altro professionista|preferit/i);
    }
  });

  it("altre note di Bob, se un giorno ce ne saranno, non diventano «chiusa»", () => {
    expect(notificheDaNoteDiBob([nota("n1", "Benvenuto su Bob", "2026-10-15T10:00:00Z")])).toEqual([]);
  });

  it("senza il nome del servizio dice «la tua richiesta»", () => {
    const [v] = notificheDaNoteDiBob([nota("n1", BOB_CHIUSA, "2026-10-15T10:00:00Z", { servizio: null })]);
    expect(v.titolo).toBe("Il cliente ha chiuso la richiesta · la tua richiesta");
  });
});
