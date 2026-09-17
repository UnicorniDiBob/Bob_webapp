import { describe, expect, it } from "vitest";
import {
  capCoerente,
  cercaComuni,
  comunePerIstat,
  comuniPerCap,
  regioni,
} from "./comuni";

// L'elenco dei comuni è un file generato: queste prove non guardano il codice,
// guardano che il file serva davvero a compilare il campo dell'iscrizione.
// Se un giorno il generatore cambia fonte e Milano perde i suoi CAP, è qui che
// si vede — non in produzione, davanti al professionista.

describe("ricerca del comune", () => {
  it("mette il nome esatto davanti a quello che lo contiene", () => {
    expect(cercaComuni("forli")[0].nome).toBe("Forlì");
  });

  it("trova Milano scrivendo le prime lettere", () => {
    expect(cercaComuni("mila")[0].nome).toBe("Milano");
  });

  it("ignora gli accenti, in un verso e nell'altro", () => {
    expect(cercaComuni("forlì").some((c) => c.nome === "Forlì")).toBe(true);
    expect(cercaComuni("citta").length).toBeGreaterThan(0);
  });

  it("cerca anche in mezzo al nome", () => {
    // In tutta Italia i comuni che INIZIANO per «san giovanni» riempiono da
    // soli le venti righe, ed è giusto così; con la regione scelta, chi le ha
    // in mezzo torna a vedersi.
    expect(
      cercaComuni("san giovanni", { regione: "Lombardia" }).some(
        (c) => c.nome === "Sesto San Giovanni"
      )
    ).toBe(true);
  });

  it("la regione restringe davvero", () => {
    const trovati = cercaComuni("sesto", { regione: "Lombardia" });
    expect(trovati.length).toBeGreaterThan(0);
    expect(trovati.every((c) => c.regione === "Lombardia")).toBe(true);
  });

  it("non restituisce mai più del limite chiesto", () => {
    expect(cercaComuni("a", { limite: 5 }).length).toBeLessThanOrEqual(5);
  });
});

describe("CAP", () => {
  it("Milano ha molti CAP: il professionista deve poter scegliere", () => {
    const milano = comunePerIstat("015146");
    expect(milano?.nome).toBe("Milano");
    expect(milano!.cap.length).toBeGreaterThan(10);
    expect(milano!.cap).toContain("20159");
  });

  it("un comune piccolo ne ha uno solo, e glielo scriviamo noi", () => {
    const sesto = cercaComuni("Sesto San Giovanni")[0];
    expect(sesto.cap).toEqual(["20099"]);
  });

  it("dal CAP si torna al comune", () => {
    expect(comuniPerCap("20159").some((c) => c.nome === "Milano")).toBe(true);
  });

  it("un CAP che non è un CAP non trova niente", () => {
    expect(comuniPerCap("2015")).toEqual([]);
    expect(comuniPerCap("milano")).toEqual([]);
  });

  it("la coerenza col comune si sa dire quando la si sa", () => {
    expect(capCoerente("015146", "20159")).toBe(true);
    expect(capCoerente("015146", "10121")).toBe(false);
  });

  it("su un comune sconosciuto non si accusa nessuno", () => {
    // L'elenco dei CAP non è ufficiale: nel dubbio si lascia passare, perché
    // rifiutare un CAP vero è peggio che accettarne uno strano.
    expect(capCoerente("999999", "20159")).toBe(true);
  });
});

describe("il comune porta con sé quello che serve alla mappa", () => {
  it("Milano ha le coordinate, ed è a Milano", () => {
    const m = comunePerIstat("015146")!;
    expect(m.lat).toBeGreaterThan(45.3);
    expect(m.lat).toBeLessThan(45.6);
    expect(m.lng).toBeGreaterThan(9.0);
    expect(m.lng).toBeLessThan(9.4);
  });

  it("provincia e regione arrivano insieme al comune", () => {
    const m = comunePerIstat("015146")!;
    expect(m.provincia).toBe("Milano");
    expect(m.regione).toBe("Lombardia");
    expect(m.sigla).toBe("MI");
  });

  it("le regioni italiane sono venti", () => {
    expect(regioni()).toHaveLength(20);
  });
});
