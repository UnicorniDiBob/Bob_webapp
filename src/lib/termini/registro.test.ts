import { describe, expect, it } from "vitest";
import {
  REGISTRO,
  ID_VERSIONI,
  inVigorePerGliIscritti,
  pubblicoPerRuolo,
  trovaPubblicata,
  ultimaPubblicata,
  versioniPubblicate,
  violazioniRegistro,
  type VersioneTermini,
} from "./registro";

const OGGI = new Date("2026-09-28T12:00:00+02:00");

describe("il registro vero", () => {
  it("rispetta tutte le proprie regole", () => {
    expect(violazioniRegistro()).toEqual([]);
  });

  it("ha ogni id per entrambi i pubblici", () => {
    for (const id of ID_VERSIONI) {
      expect(REGISTRO.filter((v) => v.versione === id).map((v) => v.pubblico).sort()).toEqual([
        "customer",
        "professional",
      ]);
    }
  });

  it("oggi mostra la v2 a tutti e due i pubblici", () => {
    expect(ultimaPubblicata("customer", OGGI).versione).toBe("2026-09-v2");
    expect(ultimaPubblicata("professional", OGGI).versione).toBe("2026-09-v2");
  });

  it("finche' la data della v2 non e' fissata, per gli iscritti vale la v1", () => {
    expect(inVigorePerGliIscritti("professional", OGGI)?.versione).toBe("2026-07-v1");
    expect(inVigorePerGliIscritti("customer", OGGI)?.versione).toBe("2026-07-v1");
  });

  it("il 19/09 la v2 non esisteva ancora", () => {
    const prima = new Date("2026-09-19T12:00:00+02:00");
    expect(ultimaPubblicata("professional", prima).versione).toBe("2026-07-v1");
    expect(trovaPubblicata("professional", "2026-09-v2", prima)).toBeNull();
  });
});

// Un registro finto per provare la pubblicazione programmata e le regole.
const v = (over: Partial<VersioneTermini>): VersioneTermini => ({
  versione: "2026-07-v1",
  pubblico: "professional",
  pubblicataIl: "2026-07-30T00:00:00+02:00",
  efficaceDal: "2026-07-30T00:00:00+02:00",
  aggiornamento: "Luglio 2026",
  sommario: ["prova"],
  commit: "0000000",
  ...over,
});

describe("le regole del registro", () => {
  it("rifiuta un'efficacia pro a meno di 15 giorni dalla pubblicazione", () => {
    const reg = [
      v({}),
      v({
        versione: "2026-09-v2",
        pubblicataIl: "2026-10-01T00:00:00+02:00",
        efficaceDal: "2026-10-10T00:00:00+02:00",
      }),
    ];
    expect(violazioniRegistro(reg)).toEqual([
      "professional/2026-09-v2: efficace meno di 15 giorni dopo la pubblicazione (art. 3(2) P2B)",
    ]);
  });

  it("accetta 15 giorni esatti, e un'efficacia non ancora fissata", () => {
    const reg = [
      v({}),
      v({
        versione: "2026-09-v2",
        pubblicataIl: "2026-10-01T00:00:00+02:00",
        efficaceDal: "2026-10-16T00:00:00+02:00",
      }),
    ];
    expect(violazioniRegistro(reg)).toEqual([]);
    expect(violazioniRegistro([v({}), v({ versione: "2026-09-v2", pubblicataIl: "2026-10-01T00:00:00+02:00", efficaceDal: null })])).toEqual([]);
  });

  it("i clienti non hanno il vincolo dei 15 giorni, ma nessuno e' efficace prima di essere pubblicato", () => {
    const reg = [
      v({ pubblico: "customer" }),
      v({
        pubblico: "customer",
        versione: "2026-09-v2",
        pubblicataIl: "2026-10-01T00:00:00+02:00",
        efficaceDal: "2026-09-30T00:00:00+02:00",
      }),
    ];
    expect(violazioniRegistro(reg)).toEqual([
      "customer/2026-09-v2: efficace prima di essere pubblicata",
    ]);
  });

  it("trova doppioni e numeri malformati", () => {
    expect(violazioniRegistro([v({}), v({})])).toContain("professional/2026-07-v1: doppione");
    expect(
      violazioniRegistro([v({ versione: "v3" as VersioneTermini["versione"] })])
    ).toContain("professional/v3: formato del numero");
  });
});

describe("pubblicazione programmata (funzioni)", () => {
  it("una versione futura non compare finche' non arriva il suo momento", () => {
    const futura = ultimaPubblicata("customer", new Date("2026-09-20T18:27:59+02:00"));
    const appena = ultimaPubblicata("customer", new Date("2026-09-20T18:28:00+02:00"));
    expect(futura.versione).toBe("2026-07-v1");
    expect(appena.versione).toBe("2026-09-v2");
  });

  it("l'elenco delle pubblicate va dalla piu' vecchia alla piu' nuova", () => {
    expect(versioniPubblicate("professional", OGGI).map((x) => x.versione)).toEqual([
      "2026-07-v1",
      "2026-09-v2",
    ]);
  });
});

describe("pubblicoPerRuolo", () => {
  it("lo staff non ha un pubblico: non accetta termini da qui", () => {
    expect(pubblicoPerRuolo("professional")).toBe("professional");
    expect(pubblicoPerRuolo("customer")).toBe("customer");
    expect(pubblicoPerRuolo("admin")).toBeNull();
    expect(pubblicoPerRuolo("cs")).toBeNull();
    expect(pubblicoPerRuolo(null)).toBeNull();
  });
});
