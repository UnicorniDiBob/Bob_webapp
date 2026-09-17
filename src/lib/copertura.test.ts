import { describe, expect, it } from "vitest";
import {
  comuniNelCerchio,
  descriviCopertura,
  gettoniRichiesta,
  rangoCopertura,
  trovaPerRichiesta,
  zoneNelCerchio,
  type ComuneRow,
  type Copertura,
} from "./copertura";

// La regola del match è pura di proposito — niente database — così si può
// provare qui invece che scoprendo in produzione chi non riceve richieste.

const SESTO = { lat: 45.5333, lng: 9.2333 };

const COMUNI: ComuneRow[] = [
  { istat: "015209", nome: "Sesto San Giovanni", sigla: "MI", provincia: "Milano", lat: 45.5333, lng: 9.2333 },
  { istat: "015096", nome: "Cologno Monzese", sigla: "MI", provincia: "Milano", lat: 45.5294, lng: 9.2783 },
  { istat: "015146", nome: "Milano", sigla: "MI", provincia: "Milano", lat: 45.4668, lng: 9.1903 },
  { istat: "108033", nome: "Monza", sigla: "MB", provincia: "Monza e della Brianza", lat: 45.5845, lng: 9.2744 },
  { istat: "018110", nome: "Pavia", sigla: "PV", provincia: "Pavia", lat: 45.1847, lng: 9.1582 },
  { istat: "099999", nome: "Comune senza coordinate", sigla: "XX", provincia: "Chissà", lat: null, lng: null },
];

describe("i comuni nel cerchio", () => {
  it("prende quelli vicini e lascia fuori quelli lontani", () => {
    const dentro = comuniNelCerchio(COMUNI, SESTO, 9000);
    expect(dentro).toContain("015096");
    expect(dentro).toContain("108033");
    expect(dentro).toContain("015146");
    expect(dentro).not.toContain("018110");
  });

  it("con tre chilometri resta solo la base", () => {
    expect(comuniNelCerchio(COMUNI, SESTO, 3000)).toEqual(["015209"]);
  });

  it("esclude le città di Bob che hanno i propri quartieri", () => {
    // È la regola delle due griglie: dentro Milano si copre a quartieri, e
    // dichiarare il comune intero vorrebbe dire prendersi mezza città che non
    // si gira. Il trigger della 087 fa lo stesso conto lato database.
    const dentro = comuniNelCerchio(COMUNI, SESTO, 9000, ["015146"]);
    expect(dentro).not.toContain("015146");
    expect(dentro).toContain("015096");
  });

  it("un comune senza coordinate non entra mai", () => {
    expect(comuniNelCerchio(COMUNI, SESTO, 500000)).not.toContain("099999");
  });

  it("l'anteprima in TypeScript e il conto in SQL usano la stessa formula", () => {
    // Stesso raggio, stessi comuni: se questa cambia senza che cambi
    // private.comuni_nel_cerchio, il professionista vede una cosa e ne salva
    // un'altra. La prova SQL gemella sta in scripts/prova_087_comuni_copertura.sql.
    expect(comuniNelCerchio(COMUNI, SESTO, 9000).length).toBe(4);
  });
});

describe("chi trova chi", () => {
  const richiestaDaCologno = ["comune:015096", "prov:milano", "reg:lombardia", "it:*"];

  it("il gettone del comune fa incontrare richiesta e professionista", () => {
    const pro = { keys: ["comune:015096", "zone:milano/bicocca"], citySlug: "milano" };
    expect(trovaPerRichiesta(pro, richiestaDaCologno, "milano")).toBe(true);
  });

  it("chi copre solo quartieri di Milano non finisce a Cologno", () => {
    const pro = { keys: ["zone:milano/bicocca"], citySlug: "milano" };
    expect(trovaPerRichiesta(pro, richiestaDaCologno, "cologno-monzese")).toBe(false);
  });

  it("il comune è più preciso della provincia e meno del quartiere", () => {
    const proComune = { keys: ["comune:015096"], citySlug: "milano" };
    const proProvincia = { keys: ["prov:milano"], citySlug: "milano" };
    expect(rangoCopertura(proComune, richiestaDaCologno)).toBeGreaterThan(
      rangoCopertura(proProvincia, richiestaDaCologno)
    );

    const richiestaDaIsola = ["zone:milano/isola", "comune:015146", "city:milano", "it:*"];
    const proQuartiere = { keys: ["zone:milano/isola"], citySlug: "milano" };
    const proCittaComune = { keys: ["comune:015146"], citySlug: "milano" };
    expect(rangoCopertura(proQuartiere, richiestaDaIsola)).toBeGreaterThan(
      rangoCopertura(proCittaComune, richiestaDaIsola)
    );
  });

  it("i gettoni della richiesta restano quelli del database, più la zona", () => {
    const citta = { slug: "milano", coverage_keys: ["city:milano", "comune:015146", "it:*"] };
    expect(gettoniRichiesta(citta, "isola")).toEqual([
      "zone:milano/isola",
      "city:milano",
      "comune:015146",
      "it:*",
    ]);
  });
});

describe("come si racconta una copertura", () => {
  const base: Copertura = {
    id: null,
    scope: "comuni",
    cityId: null,
    mode: "circle",
    zoneSlugs: [],
    comuniIstat: ["015096", "108033"],
    centerLat: null,
    centerLng: null,
    radiusM: null,
    worksRemote: false,
  };

  it("dice quanti comuni, al plurale giusto", () => {
    expect(descriviCopertura(base)).toBe("2 comuni");
    expect(descriviCopertura({ ...base, comuniIstat: ["015096"] })).toBe("1 comune");
    expect(descriviCopertura({ ...base, comuniIstat: [] })).toBe("Nessun comune scelto");
  });

  it("le zone continuano a raccontarsi come prima", () => {
    const aZone: Copertura = { ...base, scope: "zones", zoneSlugs: ["isola", "brera"] };
    expect(descriviCopertura(aZone)).toBe("2 zone");
  });
});

describe("le zone, che non devono essersi rotte", () => {
  it("il cerchio sulle zone funziona come prima", () => {
    const zone = [
      { slug: "isola", label: "Isola", lat: 45.4908, lng: 9.1896 },
      { slug: "baggio", label: "Baggio", lat: 45.4596, lng: 9.0872 },
    ];
    expect(zoneNelCerchio(zone, { lat: 45.4908, lng: 9.1896 }, 2000)).toEqual(["isola"]);
  });
});
