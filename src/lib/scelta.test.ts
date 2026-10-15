import { describe, expect, it } from "vitest";
import {
  chiaveCoppia,
  ordineConfronto,
  senzaArchiviati,
  sceglibili,
  sceltaBloccata,
  statoRifiuto,
  testoRifiuto,
} from "./scelta";

const base = {
  chiusa: false,
  collegati: ["a", "b", "c"],
  rispondenti: new Set(["a", "b"]),
  archiviati: new Set<string>(),
  scelto: null as string | null,
  appuntamenti: [] as { professional_id: string; status: string }[],
};
const ids = (s: Set<string>) => Array.from(s).sort();

describe("dove compare «Scegli»", () => {
  it("solo su chi ha risposto (decisione 6)", () => {
    expect(ids(sceglibili(base))).toEqual(["a", "b"]);
  });

  it("con un pro solo, mai (decisione 7)", () => {
    expect(ids(sceglibili({ ...base, collegati: ["a"], rispondenti: new Set(["a"]) }))).toEqual([]);
  });

  it("i pro collegati contano anche se archiviati: due collegati, uno archiviato, «Scegli» resta sull'altro", () => {
    expect(
      ids(sceglibili({ ...base, collegati: ["a", "b"], archiviati: new Set(["b"]), scelto: null }))
    ).toEqual(["a"]);
  });

  it("non sul pro gia' scelto ne' sugli archiviati", () => {
    expect(ids(sceglibili({ ...base, scelto: "a", archiviati: new Set(["b"]) }))).toEqual([]);
    expect(
      ids(sceglibili({ ...base, rispondenti: new Set(["a", "b", "c"]), scelto: "a", archiviati: new Set(["c"]) }))
    ).toEqual(["b"]);
  });

  it("si cambia finche' col pro scelto non c'e' un appuntamento confermato (decisione 5)", () => {
    const riaperto = { ...base, scelto: "a" };
    expect(ids(sceglibili(riaperto))).toEqual(["b"]);
    expect(ids(sceglibili({ ...riaperto, appuntamenti: [{ professional_id: "a", status: "proposed" }] }))).toEqual([
      "b",
    ]);
    expect(ids(sceglibili({ ...riaperto, appuntamenti: [{ professional_id: "a", status: "confirmed" }] }))).toEqual(
      []
    );
    expect(ids(sceglibili({ ...riaperto, appuntamenti: [{ professional_id: "a", status: "completed" }] }))).toEqual(
      []
    );
  });

  it("un confermato con un pro NON scelto non blocca: lo dice la route, con il nome", () => {
    expect(ids(sceglibili({ ...base, appuntamenti: [{ professional_id: "a", status: "confirmed" }] }))).toEqual([
      "a",
      "b",
    ]);
  });

  it("richiesta chiusa: niente", () => {
    expect(ids(sceglibili({ ...base, chiusa: true }))).toEqual([]);
  });

  it("la scelta bloccata, da sola", () => {
    expect(sceltaBloccata(null, [{ professional_id: "a", status: "confirmed" }])).toBe(false);
    expect(sceltaBloccata("a", [{ professional_id: "b", status: "confirmed" }])).toBe(false);
    expect(sceltaBloccata("a", [{ professional_id: "a", status: "cancelled" }])).toBe(false);
  });
});

describe("l'ordine del confronto", () => {
  const pros = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("lo scelto per primo, gli archiviati fuori", () => {
    expect(ordineConfronto(pros, "c", new Set(["a"])).map((p) => p.id)).toEqual(["c", "b"]);
  });

  it("senza scelta, l'ordine di sempre", () => {
    expect(ordineConfronto(pros, null, new Set()).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("i rifiuti della route", () => {
  it("il nome del pro nell'appuntamento che blocca", () => {
    expect(testoRifiuto("appuntamento_altro", "Milano Clean Squad")).toBe(
      "C'è un appuntamento confermato con Milano Clean Squad: disdicilo prima di scegliere un altro professionista."
    );
  });

  it("404 per quello che non c'e', 409 per il resto", () => {
    expect(statoRifiuto("non_trovata")).toBe(404);
    expect(statoRifiuto("non_collegato")).toBe(404);
    expect(statoRifiuto("non_ha_risposto")).toBe(409);
    expect(statoRifiuto("scelta_bloccata")).toBe(409);
  });

  it("un motivo sconosciuto non mostra codici", () => {
    expect(testoRifiuto("boh")).toBe("Non è andata. Riprova fra poco.");
  });
});

describe("chi conta nella dashboard", () => {
  const righe = [
    { request_id: "r1", professional_id: "a" },
    { request_id: "r1", professional_id: "b" },
    { request_id: "r2", professional_id: "b" },
  ];

  it("via le coppie archiviate, non il pro ovunque", () => {
    const fuori = new Set([chiaveCoppia("r1", "b")]);
    expect(senzaArchiviati(righe, fuori)).toEqual([
      { request_id: "r1", professional_id: "a" },
      { request_id: "r2", professional_id: "b" },
    ]);
  });

  it("senza archiviati, tutto come prima", () => {
    expect(senzaArchiviati(righe, new Set())).toHaveLength(3);
  });
});
