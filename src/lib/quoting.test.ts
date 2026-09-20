import { describe, expect, it } from "vitest";
import {
  resolveQuoteMode,
  resolveQuoteLevel,
  resolveQuoteModeFromScope,
  type QuoteResolverInput,
  type ScopeQuoteModeInput,
} from "./quoting";

// Un default innocuo, sovrascritto caso per caso, cosi' ogni test dichiara
// solo quello che gli serve davvero (spec §2.1, una riga della tabella).
function baseInput(overrides: Partial<QuoteResolverInput>): QuoteResolverInput {
  return {
    subtaskSlug: "presa-interruttore",
    defaultQuoteLevel: "assisted",
    ...overrides,
  };
}

describe("pre-check emergenza — bypassa la scala, spec §2", () => {
  it("red_flags con danno_in_corso -> dispatch, qualunque livello", () => {
    expect(
      resolveQuoteMode(
        baseInput({ defaultQuoteLevel: "bookable", redFlags: ["danno_in_corso"] })
      )
    ).toBe("dispatch");
  });

  it("red_flags con rischio_sicurezza -> dispatch", () => {
    expect(
      resolveQuoteMode(baseInput({ redFlags: ["rischio_sicurezza"] }))
    ).toBe("dispatch");
  });

  it("urgency 'emergenza' -> dispatch anche senza red_flags", () => {
    expect(resolveQuoteMode(baseInput({ urgency: "emergenza" }))).toBe("dispatch");
  });

  it("un red_flag non riconosciuto non scatena il dispatch", () => {
    expect(
      resolveQuoteMode(baseInput({ redFlags: ["qualcos_altro"] }))
    ).not.toBe("dispatch");
  });

  it("il pre-check vince anche su un default altrimenti bookable", () => {
    expect(
      resolveQuoteMode(
        baseInput({ defaultQuoteLevel: "bookable", urgency: "emergenza" })
      )
    ).toBe("dispatch");
  });
});

describe("tinteggiatura-interni — spec §2.1", () => {
  it("mold_present=true abbassa a survey", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          subtaskSlug: "tinteggiatura-interni",
          defaultQuoteLevel: "range",
          moldPresent: true,
        })
      )
    ).toBe("survey");
  });

  it("mq_approx sconosciuto E nessuna foto abbassa a survey", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          subtaskSlug: "tinteggiatura-interni",
          defaultQuoteLevel: "range",
          mqApproxKnown: false,
          hasPhoto: false,
        })
      )
    ).toBe("survey");
  });

  it("mq_approx sconosciuto MA con foto non abbassa (la foto e' la via d'uscita)", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          subtaskSlug: "tinteggiatura-interni",
          defaultQuoteLevel: "range",
          mqApproxKnown: false,
          hasPhoto: true,
        })
      )
    ).toBe("range");
  });

  it("mq_approx conosciuto e nessuna muffa: resta al default", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          subtaskSlug: "tinteggiatura-interni",
          defaultQuoteLevel: "range",
          moldPresent: false,
          mqApproxKnown: true,
        })
      )
    ).toBe("range");
  });
});

describe("sotto-servizi sempre a survey — spec §2.1", () => {
  const sempreSurvey = [
    "tinteggiatura-esterni-facciata",
    "perdita-tubatura-infiltrazione",
    "corto-salvavita-scatta",
    "quadro-elettrico",
    "impianto-nuovo-rifacimento",
    "messa-a-norma-certificazione",
    "rifacimento-impianto-bagno",
  ];

  it.each(sempreSurvey)("%s e' sempre survey anche se il catalogo dicesse altro", (slug) => {
    expect(
      resolveQuoteLevel(baseInput({ subtaskSlug: slug, defaultQuoteLevel: "assisted" }))
    ).toBe("survey");
  });
});

describe("caldaia-scaldabagno — spec §2.1", () => {
  it("sostituzione con modello sconosciuto abbassa a survey", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          subtaskSlug: "caldaia-scaldabagno",
          defaultQuoteLevel: "assisted",
          intervento: "sostituzione",
          boilerModelKnown: false,
        })
      )
    ).toBe("survey");
  });

  it("sostituzione con modello conosciuto resta al default", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          subtaskSlug: "caldaia-scaldabagno",
          defaultQuoteLevel: "assisted",
          intervento: "sostituzione",
          boilerModelKnown: true,
        })
      )
    ).toBe("assisted");
  });

  it("manutenzione (non sostituzione) con modello sconosciuto resta al default: la condizione è congiunta", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          subtaskSlug: "caldaia-scaldabagno",
          defaultQuoteLevel: "assisted",
          intervento: "manutenzione",
          boilerModelKnown: false,
        })
      )
    ).toBe("assisted");
  });
});

describe("locale commerciale senza quantita' — regola trasversale, spec §2.1", () => {
  it("abbassa di un livello quando la quantita' non e' dichiarata", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          defaultQuoteLevel: "range",
          propertyType: "ufficio_commerciale",
          quantityKnown: false,
        })
      )
    ).toBe("assisted");
  });

  it("non abbassa se la quantita' e' dichiarata", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          defaultQuoteLevel: "range",
          propertyType: "ufficio_commerciale",
          quantityKnown: true,
        })
      )
    ).toBe("range");
  });

  it("non abbassa per un immobile non commerciale", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          defaultQuoteLevel: "range",
          propertyType: "abitazione",
          quantityKnown: false,
        })
      )
    ).toBe("range");
  });

  it("non scende oltre survey quando il default e' gia' il fondo della scala", () => {
    expect(
      resolveQuoteLevel(
        baseInput({
          defaultQuoteLevel: "survey",
          propertyType: "ufficio_commerciale",
          quantityKnown: false,
        })
      )
    ).toBe("survey");
  });
});

describe("vincoli edilizi — regola trasversale, spec §2.1", () => {
  it("ponteggio/demolizione/amianto abbassa sempre a survey, da qualunque default", () => {
    expect(
      resolveQuoteLevel(baseInput({ defaultQuoteLevel: "range", buildingConstraint: true }))
    ).toBe("survey");
    expect(
      resolveQuoteLevel(baseInput({ defaultQuoteLevel: "bookable", buildingConstraint: true }))
    ).toBe("survey");
  });
});

describe("'bookable' degrada sempre a 'range' a runtime — spec §2, instant booking rotta (C16)", () => {
  it("un default bookable senza nessuna regola di aggravamento risolve a range", () => {
    expect(
      resolveQuoteMode(baseInput({ subtaskSlug: "montaggio-mobili", defaultQuoteLevel: "bookable" }))
    ).toBe("range");
  });

  it("resolveQuoteLevel (senza il degrado) restituisce ancora bookable: il degrado è un passo separato", () => {
    expect(
      resolveQuoteLevel(baseInput({ subtaskSlug: "montaggio-mobili", defaultQuoteLevel: "bookable" }))
    ).toBe("bookable");
  });

  it("il degrado viene dopo le regole sui dati: un vincolo edilizio abbassa comunque a survey, non solo a range", () => {
    expect(
      resolveQuoteMode(
        baseInput({ defaultQuoteLevel: "bookable", buildingConstraint: true })
      )
    ).toBe("survey");
  });
});

describe("nessuna regola scatta — la scala non si tocca", () => {
  it("un sotto-servizio qualunque senza condizioni resta al default del catalogo", () => {
    expect(
      resolveQuoteMode(baseInput({ subtaskSlug: "wc-sanitari", defaultQuoteLevel: "assisted" }))
    ).toBe("assisted");
  });
});

describe("resolveQuoteModeFromScope — il ponte fra scope e i nomi del risolutore", () => {
  function baseScopeInput(overrides: Partial<ScopeQuoteModeInput>): ScopeQuoteModeInput {
    return {
      subtaskSlug: "perdita-rubinetto-sifone",
      defaultQuoteLevel: "assisted",
      quoteFields: [
        { key: "fixture", is_billable_unit: false },
        { key: "item_count", is_billable_unit: true },
      ],
      scope: {},
      ...overrides,
    };
  }

  it("individua la chiave is_billable_unit per la regola locale commerciale", () => {
    expect(
      resolveQuoteModeFromScope(
        baseScopeInput({
          subtaskSlug: "wc-sanitari",
          defaultQuoteLevel: "range",
          propertyType: "ufficio_commerciale",
          scope: {}, // item_count non dichiarato
        })
      )
    ).toBe("assisted");
  });

  it("non abbassa se la quantità è nello scope", () => {
    expect(
      resolveQuoteModeFromScope(
        baseScopeInput({
          subtaskSlug: "wc-sanitari",
          defaultQuoteLevel: "range",
          propertyType: "ufficio_commerciale",
          scope: { item_count: 2 },
        })
      )
    ).toBe("range");
  });

  it("legge mold_present e mq_approx dallo scope per tinteggiatura-interni", () => {
    expect(
      resolveQuoteModeFromScope(
        baseScopeInput({
          subtaskSlug: "tinteggiatura-interni",
          defaultQuoteLevel: "range",
          scope: { mold_present: true },
        })
      )
    ).toBe("survey");
  });

  it("passa attraverso il pre-check emergenza", () => {
    expect(
      resolveQuoteModeFromScope(
        baseScopeInput({ redFlags: ["danno_in_corso"] })
      )
    ).toBe("dispatch");
  });

  it("un campo di scope non numerico/non booleano nel posto sbagliato non fa scattare la regola", () => {
    expect(
      resolveQuoteModeFromScope(
        baseScopeInput({
          subtaskSlug: "tinteggiatura-interni",
          defaultQuoteLevel: "range",
          // mq_approx dichiarato apposta: isola il caso da testare (mold_present
          // di tipo sbagliato) dall'altra regola di tinteggiatura-interni
          // (mq_approx sconosciuto e nessuna foto), che altrimenti scatterebbe
          // comunque e renderebbe il test un falso positivo.
          scope: { mold_present: "forse", mq_approx: 40 },
        })
      )
    ).toBe("range");
  });
});
