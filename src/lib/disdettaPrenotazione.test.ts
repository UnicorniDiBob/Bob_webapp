import { describe, expect, it } from "vitest";
import { disdicibileFinoA, statoDisdetta } from "./disdettaPrenotazione";

const base = {
  starts_at: "2026-10-10T10:00:00.000Z",
  status: "confirmed",
  source: "direct",
  cancellation_window_hours: 24,
};

describe("disdetta di una prenotazione diretta", () => {
  it("si disdice fino all'istante esatto, non un secondo dopo", () => {
    const limite = new Date("2026-10-09T10:00:00.000Z");
    expect(disdicibileFinoA(base)?.toISOString()).toBe(limite.toISOString());
    expect(statoDisdetta(base, limite).tipo).toBe("si");
    expect(statoDisdetta(base, new Date(limite.getTime() + 1000)).tipo).toBe(
      "scaduta"
    );
  });

  it("senza finestra o fuori dalla prenotazione diretta non si disdice da qui", () => {
    expect(statoDisdetta({ ...base, cancellation_window_hours: null }).tipo).toBe("no");
    expect(statoDisdetta({ ...base, source: "pro" }).tipo).toBe("no");
  });

  it("solo un appuntamento confermato", () => {
    const presto = new Date("2026-10-01T00:00:00.000Z");
    expect(statoDisdetta({ ...base, status: "cancelled" }, presto).tipo).toBe("no");
    expect(statoDisdetta({ ...base, status: "completed" }, presto).tipo).toBe("no");
  });

  it("finestra zero: fino all'ora d'inizio", () => {
    const a = { ...base, cancellation_window_hours: 0 };
    expect(statoDisdetta(a, new Date("2026-10-10T10:00:00.000Z")).tipo).toBe("si");
  });
});
