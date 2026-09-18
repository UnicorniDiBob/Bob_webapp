import { describe, expect, it } from "vitest";
import { validateScope, fieldsForSubtask, mergeBrief, EMPTY_BRIEF } from "./bob";
import type { QuoteField } from "./supabase/types";

const FIXTURE_FIELDS: QuoteField[] = [
  {
    key: "fixture",
    type: "select",
    label: "Cosa perde?",
    required: true,
    is_billable_unit: false,
    pro_visible: true,
    unknown_ok: true,
    options: ["rubinetto", "sifone sotto il lavello", "non lo so"],
  },
  {
    key: "leak_active",
    type: "bool",
    label: "L'acqua esce adesso?",
    required: true,
    is_billable_unit: false,
    pro_visible: true,
    unknown_ok: false,
  },
  {
    key: "floor",
    type: "number",
    label: "A che piano?",
    required: false,
    is_billable_unit: false,
    pro_visible: true,
    unknown_ok: true,
  },
  {
    key: "notes",
    type: "text",
    label: "Altro da dire?",
    required: false,
    is_billable_unit: false,
    pro_visible: true,
    unknown_ok: true,
  },
];

describe("validateScope — spec §3.1", () => {
  it("scarta una chiave che non è nell'elenco del sotto-servizio", () => {
    expect(
      validateScope({ fixture: "rubinetto", chiave_inventata: "qualcosa" }, FIXTURE_FIELDS)
    ).toEqual({ fixture: "rubinetto" });
  });

  it("accetta un numero, e lo scarta se negativo o assurdamente grande", () => {
    expect(validateScope({ floor: 3 }, FIXTURE_FIELDS)).toEqual({ floor: 3 });
    expect(validateScope({ floor: -1 }, FIXTURE_FIELDS)).toEqual({});
    expect(validateScope({ floor: 999_999 }, FIXTURE_FIELDS)).toEqual({});
  });

  it("coerce una stringa numerica pulita, ma non una stringa qualunque", () => {
    expect(validateScope({ floor: "4" }, FIXTURE_FIELDS)).toEqual({ floor: 4 });
    expect(validateScope({ floor: "quarto piano" }, FIXTURE_FIELDS)).toEqual({});
  });

  it("accetta solo un booleano vero per un campo bool", () => {
    expect(validateScope({ leak_active: true }, FIXTURE_FIELDS)).toEqual({
      leak_active: true,
    });
    expect(validateScope({ leak_active: "true" }, FIXTURE_FIELDS)).toEqual({});
  });

  it("accetta solo un'opzione dichiarata per un campo select", () => {
    expect(validateScope({ fixture: "rubinetto" }, FIXTURE_FIELDS)).toEqual({
      fixture: "rubinetto",
    });
    expect(validateScope({ fixture: "doccia" }, FIXTURE_FIELDS)).toEqual({});
  });

  it("accetta un testo libero pulito", () => {
    expect(validateScope({ notes: "Il pezzo è già stato comprato" }, FIXTURE_FIELDS)).toEqual({
      notes: "Il pezzo è già stato comprato",
    });
  });

  it("scarta un testo che sembra un'email — mai un bypass della 044", () => {
    expect(validateScope({ notes: "scrivimi a mario@esempio.it" }, FIXTURE_FIELDS)).toEqual({});
  });

  it("scarta un testo che sembra un numero di telefono", () => {
    expect(validateScope({ notes: "chiamami al 3331234567" }, FIXTURE_FIELDS)).toEqual({});
  });

  it("scarta un testo che sembra un indirizzo", () => {
    expect(validateScope({ notes: "sono in via Roma 12" }, FIXTURE_FIELDS)).toEqual({});
  });

  it("non scarta un testo che menziona una via senza numero, o un numero senza via", () => {
    expect(validateScope({ notes: "abito in una via tranquilla" }, FIXTURE_FIELDS)).toEqual({
      notes: "abito in una via tranquilla",
    });
    expect(validateScope({ notes: "ho 3 gatti" }, FIXTURE_FIELDS)).toEqual({
      notes: "ho 3 gatti",
    });
  });

  it("con nessun campo (sotto-servizio non ancora noto) scarta tutto", () => {
    expect(validateScope({ fixture: "rubinetto" }, [])).toEqual({});
  });
});

describe("fieldsForSubtask", () => {
  const subservices = [
    { serviceSlug: "idraulico", slug: "perdita-rubinetto-sifone", name: "x", quoteFields: FIXTURE_FIELDS },
    { serviceSlug: "idraulico", slug: "scarico-otturato", name: "y" },
  ];

  it("torna le quoteFields del sotto-servizio scelto", () => {
    expect(fieldsForSubtask("perdita-rubinetto-sifone", subservices)).toBe(FIXTURE_FIELDS);
  });

  it("torna [] se il sotto-servizio non ha quoteFields", () => {
    expect(fieldsForSubtask("scarico-otturato", subservices)).toEqual([]);
  });

  it("torna [] se il sotto-servizio non è ancora noto", () => {
    expect(fieldsForSubtask(null, subservices)).toEqual([]);
  });
});

describe("mergeBrief — scope si valida contro il subtaskSlug appena risolto", () => {
  const services = [{ slug: "idraulico", name: "Idraulico" }];
  const subservices = [
    {
      serviceSlug: "idraulico",
      slug: "perdita-rubinetto-sifone",
      name: "Perdita rubinetto o sifone",
      quoteFields: FIXTURE_FIELDS,
    },
  ];

  it("una chiave valida per il subtaskSlug scelto NELLO STESSO turno viene accettata", () => {
    const result = mergeBrief(
      EMPTY_BRIEF,
      { serviceSlug: "idraulico", subtaskSlug: "perdita-rubinetto-sifone", scope: { fixture: "rubinetto" } },
      services,
      subservices
    );
    expect(result.subtaskSlug).toBe("perdita-rubinetto-sifone");
    expect(result.scope).toEqual({ fixture: "rubinetto" });
  });

  it("una chiave già valorizzata non regredisce a null in un turno che non la ripete", () => {
    const withFixture = mergeBrief(
      EMPTY_BRIEF,
      { serviceSlug: "idraulico", subtaskSlug: "perdita-rubinetto-sifone", scope: { fixture: "rubinetto" } },
      services,
      subservices
    );
    const next = mergeBrief(
      withFixture,
      { scope: { leak_active: true } },
      services,
      subservices
    );
    expect(next.scope).toEqual({ fixture: "rubinetto", leak_active: true });
  });

  it("uno scope con una chiave fuori catalogo non porta quella chiave nel brief", () => {
    const result = mergeBrief(
      EMPTY_BRIEF,
      {
        serviceSlug: "idraulico",
        subtaskSlug: "perdita-rubinetto-sifone",
        scope: { fixture: "rubinetto", indirizzo_cliente: "via Roma 12" },
      },
      services,
      subservices
    );
    expect(result.scope).toEqual({ fixture: "rubinetto" });
  });
});
