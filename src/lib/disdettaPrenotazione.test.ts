import { describe, expect, it } from "vitest";
import { disdicibileFinoA, statoDisdetta } from "./disdettaPrenotazione";

const presto = new Date("2026-10-01T00:00:00.000Z");

const base = {
  starts_at: "2026-10-10T10:00:00.000Z",
  status: "confirmed",
  request_id: "r1",
  cancellation_window_hours: 24,
};

describe("annullare un appuntamento con un cliente", () => {
  it("si annulla dal sito fino all'istante esatto, poi si chiama", () => {
    const limite = new Date("2026-10-09T10:00:00.000Z");
    expect(disdicibileFinoA(base)?.toISOString()).toBe(limite.toISOString());
    expect(statoDisdetta(base, limite).tipo).toBe("si");
    expect(statoDisdetta(base, new Date(limite.getTime() + 1000)).tipo).toBe(
      "scaduta"
    );
  });

  it("vale per ogni appuntamento con un cliente, non solo la prenotazione diretta", () => {
    expect(statoDisdetta({ ...base, source: "pro" } as typeof base, presto).tipo).toBe("si");
  });

  it("senza preavviso fotografato vale quello di base, 48 ore", () => {
    const a = { ...base, cancellation_window_hours: null };
    expect(disdicibileFinoA(a)?.toISOString()).toBe("2026-10-08T10:00:00.000Z");
  });

  it("l'agenda privata del pro non passa da qui", () => {
    expect(statoDisdetta({ ...base, request_id: null }, presto).tipo).toBe("no");
  });

  it("solo un appuntamento confermato e non ancora cominciato", () => {
    expect(statoDisdetta({ ...base, status: "cancelled" }, presto).tipo).toBe("no");
    expect(statoDisdetta({ ...base, status: "proposed" }, presto).tipo).toBe("no");
    expect(
      statoDisdetta(base, new Date("2026-10-10T10:00:01.000Z")).tipo
    ).toBe("no");
  });

  it("preavviso zero: dal sito fino all'ora d'inizio", () => {
    const a = { ...base, cancellation_window_hours: 0 };
    expect(statoDisdetta(a, new Date("2026-10-10T09:59:59.000Z")).tipo).toBe("si");
  });
});
