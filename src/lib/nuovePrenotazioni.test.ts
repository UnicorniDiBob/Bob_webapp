import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHIAVE_PRENOTAZIONI_APERTE,
  aperteDaSalvare,
  dividiInVista,
  leggiAperte,
  leggiElenco,
  nuovePrenotazioni,
  segnaAperta,
} from "./nuovePrenotazioni";

const ORA = new Date("2026-10-08T10:00:00Z");

const appt = (over: Record<string, unknown>) => ({
  id: "a1",
  status: "confirmed" as const,
  starts_at: "2026-10-09T08:00:00Z",
  source: "direct" as const,
  ...over,
});

describe("quali prenotazioni dirette mostrare", () => {
  it("una prenotazione diretta confermata e futura, mai aperta: si mostra", () => {
    expect(nuovePrenotazioni([appt({})], new Set(), ORA).map((a) => a.id)).toEqual(["a1"]);
  });

  it("aperta dal pro: non si mostra piu'", () => {
    expect(nuovePrenotazioni([appt({})], new Set(["a1"]), ORA)).toEqual([]);
  });

  it("l'orario e' passato: non si mostra", () => {
    expect(
      nuovePrenotazioni([appt({ starts_at: "2026-10-08T09:59:00Z" })], new Set(), ORA)
    ).toEqual([]);
  });

  it("disdetta, rifiutata, di nuovo da confermare o conclusa: non si mostra", () => {
    for (const status of ["cancelled", "declined", "proposed", "completed"]) {
      expect(nuovePrenotazioni([appt({ status })], new Set(), ORA)).toEqual([]);
    }
  });

  it("un appuntamento fissato dal pro non e' una prenotazione diretta", () => {
    expect(nuovePrenotazioni([appt({ source: "pro" })], new Set(), ORA)).toEqual([]);
    expect(nuovePrenotazioni([appt({ source: undefined })], new Set(), ORA)).toEqual([]);
  });

  it("la piu' vicina per prima", () => {
    const lista = [
      appt({ id: "tardi", starts_at: "2026-10-20T08:00:00Z" }),
      appt({ id: "presto", starts_at: "2026-10-09T08:00:00Z" }),
    ];
    expect(nuovePrenotazioni(lista, new Set(), ORA).map((a) => a.id)).toEqual([
      "presto",
      "tardi",
    ]);
  });
});

describe("le prime due in vista, le altre dietro «Vedi tutte»", () => {
  it("fino a due: tutte in vista", () => {
    expect(dividiInVista([1, 2], false)).toEqual({ visibili: [1, 2], nascoste: 0 });
  });

  it("tre: due in vista, una nascosta; espanso: tutte", () => {
    expect(dividiInVista([1, 2, 3], false)).toEqual({ visibili: [1, 2], nascoste: 1 });
    expect(dividiInVista([1, 2, 3], true)).toEqual({ visibili: [1, 2, 3], nascoste: 0 });
  });
});

describe("l'elenco delle aperte", () => {
  it("aggiunge l'id e scarta quelle che non sono piu' candidate", () => {
    expect(aperteDaSalvare(new Set(["vecchia", "b"]), "a", ["a", "b"])).toEqual(["b", "a"]);
  });

  it("un valore rovinato vale come elenco vuoto", () => {
    expect(leggiElenco(null).size).toBe(0);
    expect(leggiElenco("non json").size).toBe(0);
    expect(leggiElenco('{"a":1}').size).toBe(0);
    expect(Array.from(leggiElenco('["a",2,"b"]'))).toEqual(["a", "b"]);
  });
});

describe("nel browser", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("segna e rilegge, con la chiave per account", () => {
    const mem = new Map<string, string>();
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, v),
        removeItem: (k: string) => void mem.delete(k),
      },
    });
    expect(Array.from(segnaAperta("a1", ["a1"]))).toEqual(["a1"]);
    expect(Array.from(leggiAperte())).toEqual(["a1"]);
    expect(Array.from(mem.keys()).every((k) => k.startsWith(`${CHIAVE_PRENOTAZIONI_APERTE}:`))).toBe(true);
  });

  it("storage negato: nessun errore, la scheda sparisce solo per ora", () => {
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("negato");
        },
        setItem: () => {
          throw new Error("negato");
        },
        removeItem: () => {
          throw new Error("negato");
        },
      },
    });
    expect(leggiAperte().size).toBe(0);
    expect(Array.from(segnaAperta("a1", ["a1"]))).toEqual(["a1"]);
  });
});
