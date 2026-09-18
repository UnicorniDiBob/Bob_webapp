import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dentroForma, leggiConfini, percorsoProvincia } from "./confini";

// I file dei confini sono generati e committati: queste prove guardano il file
// vero, non un finto. Se un giorno il generatore cambia fonte o taglia troppo,
// è qui che si vede — non su una mappa che disegna il nulla.

function provincia(sigla: string) {
  const percorso = join(process.cwd(), "public", "geo", "province", `${sigla}.geojson`);
  return JSON.parse(readFileSync(percorso, "utf8"));
}

describe("il percorso del file", () => {
  it("normalizza la sigla", () => {
    expect(percorsoProvincia("mi")).toBe("/geo/province/MI.geojson");
    expect(percorsoProvincia(" bg ")).toBe("/geo/province/BG.geojson");
  });
});

describe("la provincia di Milano", () => {
  const dati = provincia("MI");

  it("ha tutti i suoi 133 comuni", () => {
    expect(dati.features).toHaveLength(133);
  });

  it("porta scritta la fonte, che è un obbligo della licenza", () => {
    expect(dati.fonte).toContain("ISTAT");
    expect(dati.fonte).toContain("CC BY");
  });

  it("contiene Milano e Sesto San Giovanni, con il loro codice ISTAT", () => {
    const forme = leggiConfini(dati);
    expect(forme.find((f) => f.istat === "015146")?.nome).toBe("Milano");
    expect(forme.find((f) => f.istat === "015209")?.nome).toBe("Sesto San Giovanni");
  });

  it("gli anelli sono chiusi: un anello aperto disegna una macchia", () => {
    for (const forma of leggiConfini(dati)) {
      for (const anello of forma.anelli) {
        expect(anello.length).toBeGreaterThanOrEqual(4);
        expect(anello[0]).toEqual(anello[anello.length - 1]);
      }
    }
  });

  it("le coordinate stanno in Italia, e in quest'ordine", () => {
    // [lng, lat] e non [lat, lng]: invertirli è l'errore che sposta Milano in
    // Somalia, e non se ne accorge nessuno finché non si guarda la mappa.
    for (const forma of leggiConfini(dati)) {
      for (const [lng, lat] of forma.anelli[0]) {
        expect(lng).toBeGreaterThan(8.5);
        expect(lng).toBeLessThan(9.8);
        expect(lat).toBeGreaterThan(45.0);
        expect(lat).toBeLessThan(45.8);
      }
    }
  });

  it("è semplificata abbastanza da viaggiare in rete", () => {
    const forme = leggiConfini(dati);
    const vertici = forme.reduce(
      (n, f) => n + f.anelli.reduce((m, a) => m + a.length, 0),
      0
    );
    // Il dato originale ne ha decine di migliaia: qui devono essere migliaia.
    expect(vertici).toBeLessThan(20000);
    expect(vertici).toBeGreaterThan(1000);
  });
});

describe("la Sardegna, che è il caso difficile", () => {
  // I codici ISTAT sardi non combaciano fra i due elenchi: le province sono
  // state rifatte e il codice del comune comincia col codice della provincia.
  // Il generatore li appaia per nome e regione — se quel pezzo si rompe, qui
  // restano file quasi vuoti, che è esattamente come sparirebbe mezza isola.
  it("Cagliari ha i suoi 17 comuni, quelli rimasti dopo la riforma", () => {
    const forme = leggiConfini(provincia("CA"));
    expect(forme).toHaveLength(17);
    expect(forme.some((f) => f.nome === "Cagliari")).toBe(true);
  });

  it("e il Sud Sardegna, dove sono finiti gli altri, non è vuoto", () => {
    const forme = leggiConfini(provincia("SU"));
    expect(forme.length).toBeGreaterThan(90);
  });
});

describe("cliccare su un'area", () => {
  // È il conto che sostituisce il bersaglio: il click resta della mappa, e
  // questo dice quale comune è stato toccato. Se sbaglia, il professionista
  // clicca su Sesto e gli si accende Milano.
  const forme = leggiConfini(provincia("MI"));
  const milano = forme.find((f) => f.istat === "015146")!;
  const sesto = forme.find((f) => f.istat === "015209")!;

  it("il Duomo è dentro Milano e non dentro Sesto", () => {
    const duomo = { lng: 9.1895, lat: 45.4642 };
    expect(dentroForma(duomo, milano.anelli)).toBe(true);
    expect(dentroForma(duomo, sesto.anelli)).toBe(false);
  });

  it("il centro di Sesto è dentro Sesto e non dentro Milano", () => {
    const punto = { lng: 9.2333, lat: 45.5333 };
    expect(dentroForma(punto, sesto.anelli)).toBe(true);
    expect(dentroForma(punto, milano.anelli)).toBe(false);
  });

  it("un punto in mezzo al mare non è dentro niente", () => {
    const mare = { lng: 12.5, lat: 43.0 };
    expect(forme.some((f) => dentroForma(mare, f.anelli))).toBe(false);
  });

  it("ogni comune della provincia riconosce un punto vicino al proprio centro", () => {
    // Prova grossolana ma utile: se il ray casting fosse rotto (o le
    // coordinate invertite) qui passerebbe quasi nessuno.
    let dentro = 0;
    for (const f of forme) {
      const [lng, lat] = f.anelli[0][0];
      // Un vertice sta sul bordo: si entra di un soffio verso l'interno
      // muovendosi verso il vertice opposto dell'anello.
      const [lng2, lat2] = f.anelli[0][Math.floor(f.anelli[0].length / 2)];
      const punto = { lng: lng + (lng2 - lng) * 0.5, lat: lat + (lat2 - lat) * 0.5 };
      if (dentroForma(punto, f.anelli)) dentro++;
    }
    expect(dentro).toBeGreaterThan(forme.length * 0.8);
  });
});
