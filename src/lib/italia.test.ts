import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  leggiProvince,
  provinceNelRiquadro,
  siToccano,
  unisciForme,
  type FormaProvincia,
} from "./italia";
import { leggiConfini } from "./confini";

// Come per i confini delle province: queste prove guardano il file vero. È
// generato e committato, e se il generatore un giorno taglia troppo o cambia
// fonte, si vede qui e non su una mappa che disegna il nulla.

const italia = leggiProvince(
  JSON.parse(readFileSync(join(process.cwd(), "public", "geo", "italia.geojson"), "utf8"))
);

function sigla(s: string): FormaProvincia {
  const p = italia.find((x) => x.sigla === s);
  if (!p) throw new Error(`manca ${s}`);
  return p;
}

describe("il file dell'Italia", () => {
  it("ha tutte le province", () => {
    // 107 sigle di adesso; le forme sono 110 perché la fonte ha ancora le
    // quattro province sarde soppresse nel 2016, rietichettate con la sigla
    // buona (CI e VS finiscono in SU, OG in NU, OT in SS).
    expect(italia.length).toBe(110);
    expect(new Set(italia.map((p) => p.sigla)).size).toBe(107);
  });

  it("non ha sigle senza il loro file di comuni", () => {
    for (const s of new Set(italia.map((p) => p.sigla))) {
      const percorso = join(process.cwd(), "public", "geo", "province", `${s}.geojson`);
      expect(() => readFileSync(percorso, "utf8"), `manca il file di ${s}`).not.toThrow();
    }
  });

  it("copre l'Italia da Lampedusa a Vipiteno", () => {
    const ovest = Math.min(...italia.map((p) => p.riquadro[0]));
    const est = Math.max(...italia.map((p) => p.riquadro[2]));
    const sud = Math.min(...italia.map((p) => p.riquadro[1]));
    const nord = Math.max(...italia.map((p) => p.riquadro[3]));
    expect(ovest).toBeLessThan(7); // il Piemonte occidentale
    expect(est).toBeGreaterThan(18); // il Salento
    expect(sud).toBeLessThan(36); // Lampedusa, in provincia di Agrigento
    expect(nord).toBeGreaterThan(46.9); // il Brennero
  });

  it("dà a Milano il riquadro giusto", () => {
    const mi = sigla("MI");
    expect(mi.nome).toBe("Milano");
    expect(mi.regione).toBe("Lombardia");
    const [ovest, sud, est, nord] = mi.riquadro;
    expect(ovest).toBeLessThan(9.19);
    expect(est).toBeGreaterThan(9.19);
    expect(sud).toBeLessThan(45.4642);
    expect(nord).toBeGreaterThan(45.4642);
  });

  it("il riquadro di una provincia contiene i suoi comuni", () => {
    // La prova che conta davvero: il riquadro serve a decidere quale file
    // chiedere, e se fosse più stretto della provincia dei comuni sparirebbero
    // dal disegno. Sud Sardegna è il caso limite — la sua forma nella fonte
    // non esiste nemmeno.
    for (const s of ["MI", "MB", "SU", "SS", "NU"]) {
      const p = italia.filter((x) => x.sigla === s);
      const comuni = leggiConfini(
        JSON.parse(
          readFileSync(join(process.cwd(), "public", "geo", "province", `${s}.geojson`), "utf8")
        )
      );
      expect(comuni.length).toBeGreaterThan(0);
      for (const c of comuni) {
        const [lng, lat] = c.anelli[0][0];
        const dentro = p.some(
          (x) =>
            lng >= x.riquadro[0] - 0.01 &&
            lng <= x.riquadro[2] + 0.01 &&
            lat >= x.riquadro[1] - 0.01 &&
            lat <= x.riquadro[3] + 0.01
        );
        expect(dentro, `${c.nome} (${s}) è fuori dal riquadro della sua provincia`).toBe(true);
      }
    }
  });
});

describe("quali province caricare", () => {
  const vistaMilano = { ovest: 9.05, sud: 45.38, est: 9.33, nord: 45.55 };

  it("prende Milano guardando Milano", () => {
    const scelte = provinceNelRiquadro(italia, vistaMilano);
    expect(scelte[0]).toBe("MI");
  });

  it("guardando Milano prende anche i vicini, non la Sicilia", () => {
    const scelte = provinceNelRiquadro(italia, vistaMilano);
    expect(scelte).not.toContain("PA");
    expect(scelte.length).toBeLessThanOrEqual(6);
  });

  it("non supera il tetto", () => {
    const tuttaItalia = { ovest: 6, sud: 35, est: 19, nord: 47.5 };
    expect(provinceNelRiquadro(italia, tuttaItalia, 6).length).toBe(6);
  });

  it("tiene le sigle fisse anche se sono fuori dall'inquadratura", () => {
    // Il professionista ha la base a Milano e guarda la Sicilia: le sue forme
    // non devono sparire dall'elenco caricato.
    const sicilia = { ovest: 13, sud: 37.4, est: 13.6, nord: 38.2 };
    const scelte = provinceNelRiquadro(italia, sicilia, 6, ["MI"]);
    expect(scelte[0]).toBe("MI");
    expect(scelte).toContain("PA");
  });

  it("non ripete una sigla che è già fissa", () => {
    const scelte = provinceNelRiquadro(italia, vistaMilano, 6, ["MI"]);
    expect(scelte.filter((s) => s === "MI").length).toBe(1);
  });
});

describe("i riquadri che si toccano", () => {
  it("dice di sì quando si sovrappongono e di no quando no", () => {
    const vista = { ovest: 9, sud: 45, est: 10, nord: 46 };
    expect(siToccano(vista, [9.5, 45.5, 9.6, 45.6])).toBe(true);
    expect(siToccano(vista, [8, 44, 9.0, 45.0])).toBe(true); // si sfiorano
    expect(siToccano(vista, [11, 45, 12, 46])).toBe(false);
    expect(siToccano(vista, [9, 47, 10, 48])).toBe(false);
  });
});

describe("unire le forme caricate", () => {
  it("mette insieme le province e non ripete un comune", () => {
    const a = leggiConfini(
      JSON.parse(
        readFileSync(join(process.cwd(), "public", "geo", "province", "MI.geojson"), "utf8")
      )
    );
    const b = leggiConfini(
      JSON.parse(
        readFileSync(join(process.cwd(), "public", "geo", "province", "MB.geojson"), "utf8")
      )
    );
    const mappa = new Map([
      ["MI", a],
      ["MB", b],
    ]);
    const insieme = unisciForme(mappa, ["MI", "MB", "MI"]);
    expect(insieme.length).toBe(a.length + b.length);
    expect(new Set(insieme.map((f) => f.istat)).size).toBe(insieme.length);
  });

  it("ignora una sigla non ancora caricata", () => {
    expect(unisciForme(new Map(), ["MI"])).toEqual([]);
  });
});
