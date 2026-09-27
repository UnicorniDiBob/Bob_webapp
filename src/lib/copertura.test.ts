import { describe, expect, it } from "vitest";
import {
  comuniNelCerchio,
  descriviCopertura,
  gettoniRichiesta,
  RANGO_GETTONE,
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

  it("una richiesta col CAP di Sesto incontra chi copre Sesto", () => {
    // È il punto di tutta la 088: la città di Bob resta Milano — è lì che il
    // cliente ha cercato — ma il CAP dice Sesto, e chi copre Sesto deve
    // comparire. Senza il terzo gettone non comparirebbe mai nessuno fuori
    // dalle tre città.
    const citta = { slug: "milano", coverage_keys: ["city:milano", "comune:015146", "prov:milano", "it:*"] };
    const daSesto = gettoniRichiesta(citta, null, "015209");
    expect(daSesto).toContain("comune:015209");

    const proDiSesto = { keys: ["comune:015209"], citySlug: "milano" };
    expect(trovaPerRichiesta(proDiSesto, daSesto, "milano")).toBe(true);
  });

  it("non ripete il comune quando è già quello della città", () => {
    const citta = { slug: "milano", coverage_keys: ["city:milano", "comune:015146", "it:*"] };
    const chiavi = gettoniRichiesta(citta, null, "015146");
    expect(chiavi.filter((k) => k === "comune:015146")).toHaveLength(1);
  });

  it("senza comune la richiesta è quella di prima", () => {
    const citta = { slug: "milano", coverage_keys: ["city:milano", "it:*"] };
    expect(gettoniRichiesta(citta, "isola")).toEqual([
      "zone:milano/isola",
      "city:milano",
      "it:*",
    ]);
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

describe("098: il filtro con esclusioni è un no-op a esclusioni vuote", () => {
  // COPIA CONGELATA della regola PRIMA della 098 — non importata da
  // copertura.ts di proposito: se qualcuno la "semplifica" per farla
  // combaciare col codice nuovo, il test smette di dimostrare quello che
  // deve dimostrare. È la stessa regola vecchia, lasciata immobile qui.
  function trovaPerRichiestaVecchia(
    pro: { keys: string[]; citySlug: string },
    gettoniRichiesta: string[],
    cittaRichiesta: string
  ): boolean {
    if (pro.keys.length === 0) return pro.citySlug === cittaRichiesta;
    if (pro.keys.some((k) => gettoniRichiesta.includes(k))) return true;
    const richiestaSenzaZona = !gettoniRichiesta.some((k) => k.startsWith("zone:"));
    if (richiestaSenzaZona) {
      const prefisso = `zone:${cittaRichiesta}/`;
      return pro.keys.some((k) => k.startsWith(prefisso));
    }
    return false;
  }

  function rangoCoperturaVecchia(
    pro: { keys: string[] },
    gettoniRichiesta: string[]
  ): number {
    if (pro.keys.length === 0) return RANGO_GETTONE.city;
    let migliore = -1;
    for (const k of pro.keys) {
      if (!gettoniRichiesta.includes(k)) continue;
      const r = RANGO_GETTONE[k.split(":")[0]] ?? 0;
      if (r > migliore) migliore = r;
    }
    if (migliore >= 0) return migliore;
    const richiestaSenzaZona = !gettoniRichiesta.some((k) => k.startsWith("zone:"));
    if (richiestaSenzaZona && pro.keys.some((k) => k.startsWith("zone:"))) {
      return RANGO_GETTONE.city;
    }
    return migliore;
  }

  // OGNI FORMA DI COPERTURA CHE ESISTE OGGI IN PRODUZIONE, per scope: niente
  // dichiarato, un quartiere solo, più quartieri, un comune, la città
  // intera, la provincia, la regione, la macro-regione, l'Italia — più due
  // città diverse, per esercitare anche la regola di compatibilità.
  const CITTA_PRO = ["milano", "bergamo"];
  const FORME_COPERTURA: Array<{ nome: string; keys: string[] }> = [
    { nome: "niente dichiarato", keys: [] },
    { nome: "un quartiere", keys: ["zone:milano/isola"] },
    { nome: "tre quartieri", keys: ["zone:milano/isola", "zone:milano/brera", "zone:milano/navigli"] },
    { nome: "un comune", keys: ["comune:015146"] },
    { nome: "due comuni", keys: ["comune:015146", "comune:015209"] },
    { nome: "tutta la città", keys: ["city:milano"] },
    { nome: "tutta la provincia", keys: ["prov:milano"] },
    { nome: "tutta la regione", keys: ["reg:lombardia"] },
    { nome: "macroregione", keys: ["macro:nord"] },
    { nome: "tutta Italia", keys: ["it:*"] },
    { nome: "remoto più zona", keys: ["remote:*", "zone:milano/isola"] },
  ];

  // OGNI FORMA DI RICHIESTA: con zona, senza zona, con comune diverso dalla
  // città, senza comune — sulle due città sopra.
  const FORME_RICHIESTA: Array<{ nome: string; gettoni: string[]; citta: string }> = [
    {
      nome: "Milano, con zona Isola",
      gettoni: ["zone:milano/isola", "comune:015146", "city:milano", "prov:milano", "reg:lombardia", "macro:nord", "it:*"],
      citta: "milano",
    },
    {
      nome: "Milano, senza zona",
      gettoni: ["comune:015146", "city:milano", "prov:milano", "reg:lombardia", "macro:nord", "it:*"],
      citta: "milano",
    },
    {
      nome: "Milano, comune di Sesto (fuori città di Bob)",
      gettoni: ["comune:015209", "city:milano", "prov:milano", "reg:lombardia", "macro:nord", "it:*"],
      citta: "milano",
    },
    {
      nome: "Milano, nessun gettone di comune",
      gettoni: ["city:milano", "prov:milano", "reg:lombardia", "macro:nord", "it:*"],
      citta: "milano",
    },
    {
      nome: "Bergamo, con zona (ipotetica)",
      gettoni: ["zone:bergamo/centro", "comune:016024", "city:bergamo", "prov:bergamo", "reg:lombardia", "macro:nord", "it:*"],
      citta: "bergamo",
    },
  ];

  it("trovaPerRichiesta: stesso risultato di prima della 098, su ogni combinazione, con esclusioni vuote", () => {
    let confrontate = 0;
    for (const forma of FORME_COPERTURA) {
      for (const citySlug of CITTA_PRO) {
        for (const richiesta of FORME_RICHIESTA) {
          const proVecchio = { keys: forma.keys, citySlug };
          // Le due forme di "nessuna esclusione" che la 098 può incontrare in
          // produzione: la colonna non ancora letta (undefined) e la colonna
          // letta ma vuota ('{}' → []). Devono comportarsi allo stesso modo.
          for (const excludedKeys of [undefined, []] as (string[] | undefined)[]) {
            const proNuovo = { keys: forma.keys, citySlug, excludedKeys };
            expect(
              trovaPerRichiesta(proNuovo, richiesta.gettoni, richiesta.citta),
              `${forma.nome} / ${citySlug} / ${richiesta.nome} / excludedKeys=${JSON.stringify(excludedKeys)}`
            ).toBe(trovaPerRichiestaVecchia(proVecchio, richiesta.gettoni, richiesta.citta));
            confrontate += 1;
          }
        }
      }
    }
    // Non deve passare per caso su un elenco vuoto: qui si contano le
    // combinazioni davvero confrontate.
    expect(confrontate).toBe(FORME_COPERTURA.length * CITTA_PRO.length * FORME_RICHIESTA.length * 2);
  });

  it("rangoCopertura: stesso risultato di prima della 098, su ogni combinazione, con esclusioni vuote", () => {
    for (const forma of FORME_COPERTURA) {
      for (const richiesta of FORME_RICHIESTA) {
        for (const excludedKeys of [undefined, []] as (string[] | undefined)[]) {
          const proNuovo = { keys: forma.keys, citySlug: richiesta.citta, excludedKeys };
          expect(
            rangoCopertura(proNuovo, richiesta.gettoni, richiesta.citta),
            `${forma.nome} / ${richiesta.nome} / excludedKeys=${JSON.stringify(excludedKeys)}`
          ).toBe(rangoCoperturaVecchia({ keys: forma.keys }, richiesta.gettoni));
        }
      }
    }
  });

  it("rangoCopertura senza cittaRichiesta (il chiamante di prima della 098) resta invariato", () => {
    // ordinaSenzaPunteggio non passava un terzo argomento prima della 098:
    // deve continuare a funzionare esattamente come prima per chi non è
    // ancora stato aggiornato a passarlo.
    for (const forma of FORME_COPERTURA) {
      for (const richiesta of FORME_RICHIESTA) {
        const proNuovo = { keys: forma.keys, citySlug: richiesta.citta };
        expect(rangoCopertura(proNuovo, richiesta.gettoni)).toBe(
          rangoCoperturaVecchia({ keys: forma.keys }, richiesta.gettoni)
        );
      }
    }
  });

  // LA PROVA CHE L'ESCLUSIONE NON È UN CODICE MORTO: lo stesso test sopra,
  // ma con un'esclusione vera, deve invece CAMBIARE il risultato. Senza
  // questa prova il no-op qui sopra sarebbe vero anche per una funzione che
  // ignora `excludedKeys` sempre — un no-op che non potrebbe mai fallire non
  // dimostra niente.
  it("un'esclusione vera invece CAMBIA il risultato (altrimenti il test qui sopra sarebbe vuoto)", () => {
    const proNazionaleMenoMilano = {
      keys: ["it:*"],
      citySlug: "milano",
      excludedKeys: ["comune:015146"],
    };
    const richiestaDaMilano = FORME_RICHIESTA[1]; // "Milano, senza zona"
    expect(
      trovaPerRichiesta(proNazionaleMenoMilano, richiestaDaMilano.gettoni, richiestaDaMilano.citta)
    ).toBe(false);
    // Ma la stessa copertura, su una richiesta di un'altra città, resta ammessa:
    // l'esclusione è mirata, non un interruttore generale.
    const richiestaDaBergamo = FORME_RICHIESTA[4];
    expect(
      trovaPerRichiesta(proNazionaleMenoMilano, richiestaDaBergamo.gettoni, richiestaDaBergamo.citta)
    ).toBe(true);

    const proCittaMenoIsola = {
      keys: ["city:milano"],
      citySlug: "milano",
      excludedKeys: ["zone:milano/isola"],
    };
    const richiestaDaIsola = FORME_RICHIESTA[0];
    expect(
      trovaPerRichiesta(proCittaMenoIsola, richiestaDaIsola.gettoni, richiestaDaIsola.citta)
    ).toBe(false);
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
