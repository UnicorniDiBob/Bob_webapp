import { describe, expect, it } from "vitest";
import {
  campi,
  leggiCsv,
  leggiData,
  leggiImporto,
  MAX_RIGHE_CSV,
  prossimoCodice,
  trovaServizio,
} from "./csvRicavi";

describe("date e importi all'italiana", () => {
  it("legge le date nei formati che escono da Excel", () => {
    expect(leggiData("03/06/2026")).toBe("2026-06-03");
    expect(leggiData("3-6-26")).toBe("2026-06-03");
    expect(leggiData("2026-06-03")).toBe("2026-06-03");
    expect(leggiData("03.06.2026")).toBe("2026-06-03");
    expect(leggiData("31/02/2026")).toBeNull();
    expect(leggiData("ieri")).toBeNull();
  });

  it("legge gli importi con la virgola, con il punto e con l'euro", () => {
    expect(leggiImporto("1.250,50")).toBe(125050);
    expect(leggiImporto("1250.50")).toBe(125050);
    expect(leggiImporto("1,250.50")).toBe(125050);
    expect(leggiImporto("€ 120")).toBe(12000);
    expect(leggiImporto("120 €")).toBe(12000);
    expect(leggiImporto("1.250")).toBe(125000);
    expect(leggiImporto("12,5")).toBe(1250);
    expect(leggiImporto("dodici")).toBeNull();
    expect(leggiImporto("-50")).toBeNull();
  });
});

describe("il file", () => {
  it("riconosce il separatore e le virgolette", () => {
    expect(campi('a;"b;c";d', ";")).toEqual(["a", "b;c", "d"]);
    expect(campi('"lui ha detto ""ciao""",2', ",")).toEqual(['lui ha detto "ciao"', "2"]);
  });

  it("legge, scarta con il motivo e segnala i doppioni", () => {
    const csv = [
      "Data;Importo (€);Servizio;Comune;CAP;Codice cliente;Note",
      '03/06/2026;"1.250,50";Idraulica;Milano;20121;C1;caldaia',
      "04/06/2026;dieci euro;Pulizie;;;;",
      "31/02/2026;100;;;;;",
      '03/06/2026;"1.250,50";Idraulica;Milano;20121;C1;di nuovo',
      "",
    ].join("\n");
    const e = leggiCsv(csv);
    expect(e.errore).toBeNull();
    expect(e.righe).toHaveLength(2);
    expect(e.righe[0]).toMatchObject({
      riga: 2,
      data: "2026-06-03",
      importoCent: 125050,
      servizio: "Idraulica",
      cap: "20121",
      cliente: "C1",
      doppione: false,
    });
    expect(e.righe[1].doppione).toBe(true);
    expect(e.scartate.map((s) => s.riga)).toEqual([3, 4]);
  });

  it("senza data o importo nell'intestazione si ferma", () => {
    expect(leggiCsv("giorno;cliente\n03/06/2026;C1").errore).toMatch(/data.*importo/);
    expect(leggiCsv("data,euro\n03/06/2026,10").errore).toBeNull();
  });

  it("oltre il massimo di righe si ferma prima di leggere", () => {
    const molte = ["data;importo", ...Array(MAX_RIGHE_CSV + 1).fill("01/01/2026;1")].join("\n");
    expect(leggiCsv(molte).errore).toMatch(/massimo/);
  });
});

describe("servizio e codice cliente", () => {
  const catalogo = [
    { id: "1", name: "Idraulico" },
    { id: "2", name: "Imbianchino" },
    { id: "3", name: "Pulizie" },
  ];

  it("trova il servizio uguale o con la stessa radice, mai uno a caso", () => {
    expect(trovaServizio("pulizie", catalogo)).toBe("3");
    expect(trovaServizio("Idraulica", catalogo)).toBe("1");
    expect(trovaServizio("Imbi", catalogo)).toBeNull();
    expect(trovaServizio("Giardino", catalogo)).toBeNull();
  });

  it("propone il codice dopo il più alto", () => {
    expect(prossimoCodice([])).toBe("C1");
    expect(prossimoCodice(["C2", "c13", "Condominio Monza", null, "C9"])).toBe("C14");
  });
});
