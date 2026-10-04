import { describe, expect, it } from "vitest";
import {
  meseDiOggi,
  nomePeriodo,
  periodoContro,
  periodoDaUrl,
  quantiMesi,
  quota,
  scorciatoia,
  sposta,
  variazione,
} from "./analisi";

describe("sposta", () => {
  it("attraversa gli anni in avanti e indietro", () => {
    expect(sposta("2026-01", -1)).toBe("2025-12");
    expect(sposta("2026-12", 1)).toBe("2027-01");
    expect(sposta("2026-10", -12)).toBe("2025-10");
    expect(sposta("2026-03", -15)).toBe("2024-12");
  });
});

describe("periodi", () => {
  it("conta i mesi estremi compresi", () => {
    expect(quantiMesi({ da: "2026-01", a: "2026-10" })).toBe(10);
    expect(quantiMesi({ da: "2025-11", a: "2026-02" })).toBe(4);
  });

  it("le scorciatoie partono dal mese di oggi", () => {
    expect(scorciatoia("anno-finora", "2026-10")).toEqual({ da: "2026-01", a: "2026-10" });
    expect(scorciatoia("ultimi-12", "2026-10")).toEqual({ da: "2025-11", a: "2026-10" });
    expect(scorciatoia("mese-scorso", "2026-01")).toEqual({ da: "2025-12", a: "2025-12" });
    expect(scorciatoia("anno-scorso", "2026-10")).toEqual({ da: "2025-01", a: "2025-12" });
  });

  it("l'anno prima sono gli stessi mesi, il periodo precedente la stessa lunghezza", () => {
    const p = { da: "2026-01", a: "2026-10" };
    expect(periodoContro(p, "anno")).toEqual({ da: "2025-01", a: "2025-10" });
    expect(periodoContro(p, "prec")).toEqual({ da: "2025-03", a: "2025-12" });
    expect(periodoContro(p, "no")).toBeNull();
  });

  it("l'URL sbagliato vale anno finora, e non si va oltre oggi", () => {
    expect(periodoDaUrl({}, "2026-10")).toEqual({
      periodo: { da: "2026-01", a: "2026-10" },
      confronto: "anno",
    });
    expect(periodoDaUrl({ da: "2026-13", a: "2026-02" }, "2026-10").periodo).toEqual({
      da: "2026-01",
      a: "2026-10",
    });
    expect(periodoDaUrl({ da: "2026-09", a: "2026-03", contro: "prec" }, "2026-10")).toEqual({
      periodo: { da: "2026-03", a: "2026-09" },
      confronto: "prec",
    });
    expect(periodoDaUrl({ da: "2026-08", a: "2027-05" }, "2026-10").periodo.a).toBe("2026-10");
  });

  it("il mese di oggi si legge a Roma, non in UTC", () => {
    // 31 ottobre, 23:30 UTC = 1 novembre a Roma.
    expect(meseDiOggi(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
  });

  it("i nomi dei periodi", () => {
    expect(nomePeriodo({ da: "2025-01", a: "2025-12" })).toBe("2025");
    expect(nomePeriodo({ da: "2026-09", a: "2026-09" })).toBe("Settembre 2026");
  });
});

describe("quota e variazione", () => {
  it("sotto 10 si danno i conteggi, non la percentuale", () => {
    expect(quota(3, 7)).toBe("3 su 7");
    expect(quota(5, 13)).toBe("38%");
    expect(quota(0, 0)).toBe("—");
  });

  it("niente variazione contro zero o senza confronto", () => {
    expect(variazione(150, 100)).toBe(50);
    expect(variazione(80, 100)).toBe(-20);
    expect(variazione(80, 0)).toBeNull();
    expect(variazione(80, null)).toBeNull();
  });
});
