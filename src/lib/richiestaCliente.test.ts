import { describe, expect, it } from "vitest";
import {
  appuntamentoVero,
  codiceBreve,
  cosaMostraComEAndata,
  prezzoPerRichiesta,
  riassuntoChat,
  sembraUnId,
  prezzoPrenotato,
  testoPrenotato,
  testoPrezzo,
  type RigaPrezzo,
} from "./richiestaCliente";

const riga = (extra: Partial<RigaPrezzo>): RigaPrezzo => ({
  service_id: "imbianchino",
  subservice_id: null,
  min_price: null,
  max_price: null,
  price_note: null,
  ...extra,
});

describe("il prezzo per questa richiesta", () => {
  it("con l'intervento prezzato vale quella riga", () => {
    const righe = [
      riga({ subservice_id: "pareti", min_price: 20, max_price: 28, price_note: "al m²" }),
      riga({ subservice_id: "soffitti", min_price: 10, max_price: 50 }),
    ];
    expect(prezzoPerRichiesta(righe, "imbianchino", "pareti")).toEqual({
      min: 20,
      max: 28,
      nota: "al m²",
    });
  });

  it("senza l'intervento prezzato vale la fascia del servizio", () => {
    const righe = [
      riga({ subservice_id: "pareti", min_price: 20, max_price: 28 }),
      riga({ subservice_id: "soffitti", min_price: 15, max_price: 40, price_note: "materiali esclusi" }),
      riga({ subservice_id: "senza-prezzo" }),
    ];
    expect(prezzoPerRichiesta(righe, "imbianchino", "senza-prezzo")).toEqual({
      min: 15,
      max: 40,
      nota: "materiali esclusi",
    });
    expect(prezzoPerRichiesta(righe, "imbianchino", null)?.min).toBe(15);
  });

  it("non legge i prezzi di un altro servizio", () => {
    const righe = [riga({ service_id: "idraulico", min_price: 50 })];
    expect(prezzoPerRichiesta(righe, "imbianchino", null)).toBeNull();
  });

  it("senza prezzi: null, cioe' «Prezzo da concordare»", () => {
    expect(prezzoPerRichiesta([riga({})], "imbianchino", null)).toBeNull();
    expect(prezzoPerRichiesta([], "imbianchino", null)).toBeNull();
  });

  it("ignora le righe legacy sostituite (090)", () => {
    const righe = [
      riga({ min_price: 5, subservices: { superseded_by: "nuovo" } }),
      riga({ min_price: 20 }),
    ];
    expect(prezzoPerRichiesta(righe, "imbianchino", null)?.min).toBe(20);
  });

  it("si scrive «da», «–», «fino a»", () => {
    expect(testoPrezzo({ min: 20, max: null, nota: null })).toBe("da 20 €");
    expect(testoPrezzo({ min: 20, max: 28, nota: null })).toBe("20–28 €");
    expect(testoPrezzo({ min: null, max: 40, nota: null })).toBe("fino a 40 €");
    expect(testoPrezzo({ min: 30, max: 30, nota: null })).toBe("30 €");
    expect(testoPrezzo({ min: 15000, max: null, nota: null })).toBe("da 15.000 €");
  });
});

describe("cosa mostra «Com'è andata?»", () => {
  const base = {
    status: "matched",
    closed_reason: null,
    proIds: ["a", "b"],
    recensiti: new Set<string>(),
    haAppuntamento: false,
  };

  it("richiesta aperta con un pro in contatto: si chiede se e' concluso", () => {
    expect(cosaMostraComEAndata(base)).toBe("chiudi");
  });

  it("aperta, nessuno in contatto e nessun appuntamento: niente (DEMO-MULTI)", () => {
    expect(cosaMostraComEAndata({ ...base, status: "quote_request" })).toBeNull();
    expect(cosaMostraComEAndata({ ...base, status: "sent" })).toBeNull();
  });

  it("aperta ma con un appuntamento vero: si chiede, anche senza «matched»", () => {
    expect(cosaMostraComEAndata({ ...base, status: "sent", haAppuntamento: true })).toBe("chiudi");
  });

  it("le regole delle chiuse non dipendono dall'appuntamento", () => {
    expect(cosaMostraComEAndata({ ...base, status: "closed" })).toBe("recensisci");
  });

  it("chiusa con pro da recensire: il modulo", () => {
    expect(cosaMostraComEAndata({ ...base, status: "closed", recensiti: new Set(["a"]) })).toBe(
      "recensisci"
    );
  });

  it("chiusa e tutto recensito: il grazie", () => {
    expect(
      cosaMostraComEAndata({ ...base, status: "closed", recensiti: new Set(["a", "b"]) })
    ).toBe("grazie");
  });

  it("disdetta o senza pro: niente", () => {
    expect(cosaMostraComEAndata({ ...base, status: "closed", closed_reason: "disdetto" })).toBeNull();
    expect(cosaMostraComEAndata({ ...base, closed_reason: "disdetto" })).toBeNull();
    expect(cosaMostraComEAndata({ ...base, proIds: [] })).toBeNull();
  });
});

describe("il riassunto di ogni chat", () => {
  it("ultimo messaggio e non letti del pro, per pro", () => {
    const m = riassuntoChat([
      { professional_id: "a", sender_type: "professional", message: "1", created_at: "2026-10-01T10:00:00Z", read_at: null },
      { professional_id: "a", sender_type: "customer", message: "2", created_at: "2026-10-02T10:00:00Z", read_at: null },
      { professional_id: "a", sender_type: "professional", message: "0", created_at: "2026-09-30T10:00:00Z", read_at: "2026-09-30T11:00:00Z" },
      { professional_id: "b", sender_type: "professional", message: "x", created_at: "2026-10-03T10:00:00Z", read_at: null },
      { professional_id: null, sender_type: "system", message: "s", created_at: "2026-10-04T10:00:00Z", read_at: null },
    ]);
    expect(m.get("a")?.ultimo?.message).toBe("2");
    expect(m.get("a")?.nonLetti).toBe(1);
    expect(m.get("b")?.nonLetti).toBe(1);
    expect(m.size).toBe(2);
  });
});

describe("id e codice", () => {
  it("solo un uuid e' un id da cercare", () => {
    expect(sembraUnId("6a1f0c2e-1b2c-4d5e-8f90-123456789abc")).toBe(true);
    expect(sembraUnId("123")).toBe(false);
    expect(sembraUnId("6a1f0c2e-1b2c-4d5e-8f90-123456789abc' or 1=1")).toBe(false);
  });

  it("il codice breve sono le prime 8 cifre", () => {
    expect(codiceBreve("6a1f0c2e-1b2c-4d5e-8f90-123456789abc")).toBe("6A1F0C2E");
  });
});

describe("l'appuntamento che conta e il prezzo prenotato", () => {
  it("annullato, rifiutato e proposta scaduta non sono appuntamenti veri", () => {
    const adesso = new Date("2026-10-15T10:00:00Z").getTime();
    const futuro = "2026-10-20T08:00:00Z";
    const passato = "2026-10-10T08:00:00Z";
    for (const status of ["confirmed", "completed"]) {
      expect(appuntamentoVero({ status, starts_at: futuro }, adesso)).toBe(true);
      expect(appuntamentoVero({ status, starts_at: passato }, adesso)).toBe(true);
    }
    expect(appuntamentoVero({ status: "proposed", starts_at: futuro }, adesso)).toBe(true);
    expect(appuntamentoVero({ status: "proposed", starts_at: passato }, adesso)).toBe(false);
    expect(appuntamentoVero({ status: "cancelled", starts_at: futuro }, adesso)).toBe(false);
    expect(appuntamentoVero({ status: "declined", starts_at: futuro }, adesso)).toBe(false);
  });

  it("la prenotazione diretta disdetta tiene il suo prezzo (22818d7e)", () => {
    const appts = [
      { professional_id: "p", status: "cancelled", starts_at: "2026-10-20T08:00:00Z", price: "40", created_at: "2026-10-13T10:00:00Z" },
    ];
    expect(prezzoPrenotato(appts, "p")).toBe(40);
    expect(testoPrenotato(40)).toBe("Prenotato a 40 €");
  });

  it("vale il piu' recente, e solo quello di quel pro", () => {
    const appts = [
      { professional_id: "p", status: "cancelled", starts_at: "2026-10-20T08:00:00Z", price: 40, created_at: "2026-10-01T10:00:00Z" },
      { professional_id: "p", status: "confirmed", starts_at: "2026-10-20T08:00:00Z", price: 55, created_at: "2026-10-10T10:00:00Z" },
      { professional_id: "q", status: "confirmed", starts_at: "2026-10-20T08:00:00Z", price: 90, created_at: "2026-10-12T10:00:00Z" },
      { professional_id: "p", status: "confirmed", starts_at: "2026-10-20T08:00:00Z", price: null, created_at: "2026-10-14T10:00:00Z" },
    ];
    expect(prezzoPrenotato(appts, "p")).toBe(55);
    expect(prezzoPrenotato(appts, "q")).toBe(90);
    expect(prezzoPrenotato(appts, "nessuno")).toBeNull();
  });
});

