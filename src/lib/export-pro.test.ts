// Le regole su cosa di un cliente esce dall'export del professionista: sono
// le stesse che glielo mostrano nel prodotto, e qui si fissano una per una.

import { describe, expect, it } from "vitest";
import { briefVisibile, indirizzoVisibile, nellaCartella, richiestaPerPro } from "./export-pro";

const PRO = "pro-1";
const CLIENTE = "cliente-1";

describe("indirizzoVisibile (private.can_see_request_address)", () => {
  it("solo con un appuntamento confermato o completato della richiesta", () => {
    expect(indirizzoVisibile([{ request_id: "r1", status: "confirmed" }], "r1")).toBe(true);
    expect(indirizzoVisibile([{ request_id: "r1", status: "completed" }], "r1")).toBe(true);
    for (const status of ["proposed", "cancelled", "declined"]) {
      expect(indirizzoVisibile([{ request_id: "r1", status }], "r1")).toBe(false);
    }
    expect(indirizzoVisibile([{ request_id: "r2", status: "confirmed" }], "r1")).toBe(false);
  });
});

describe("briefVisibile (le condizioni di request-summary)", () => {
  const aperta = { status: "contacted", archived_at: null };
  const richiesta = { id: "r1", status: "sent", customer_id: CLIENTE };
  const brief = { id: "b1", user_id: CLIENTE };

  it("assegnazione aperta, richiesta aperta, brief del cliente: si'", () => {
    expect(briefVisibile(aperta, richiesta, brief)).toBe(true);
    expect(briefVisibile(aperta, richiesta, { id: "b1", user_id: null })).toBe(true);
  });
  it("brief di un altro account: no (requests.brief_id lo scrive il browser)", () => {
    expect(briefVisibile(aperta, richiesta, { id: "b1", user_id: "altro" })).toBe(false);
  });
  it("richiesta chiusa, assegnazione archiviata o in uno stato finale: no", () => {
    expect(briefVisibile(aperta, { ...richiesta, status: "closed" }, brief)).toBe(false);
    expect(briefVisibile({ ...aperta, archived_at: "2026-10-01" }, richiesta, brief)).toBe(false);
    expect(briefVisibile({ status: "declined", archived_at: null }, richiesta, brief)).toBe(false);
    expect(briefVisibile(undefined, richiesta, brief)).toBe(false);
  });
});

describe("richiestaPerPro", () => {
  it("niente id del cliente ne' di un altro pro, e via e civico tolti", () => {
    const r = richiestaPerPro(
      {
        id: "r1",
        customer_id: CLIENTE,
        brief_id: "b1",
        chosen_professional_id: "pro-2",
        closed_reason: "scelto altro",
        problem_description: "Perdita in cucina, indirizzo: Via Roma 12",
        services: { name: "Idraulico" },
      },
      PRO
    );
    const testo = JSON.stringify(r);
    expect(testo).not.toContain(CLIENTE);
    expect(testo).not.toContain("pro-2");
    expect(testo).not.toContain("Roma 12");
    expect(r.scelta_del_cliente).toBe("un altro professionista");
    expect(richiestaPerPro({ id: "r1", chosen_professional_id: PRO }, PRO).scelta_del_cliente).toBe("te");
  });
});

describe("nellaCartella", () => {
  it("solo percorsi dentro <user_id>/, senza salti", () => {
    expect(nellaCartella("u1/a.pdf", "u1")).toBe(true);
    expect(nellaCartella("u2/a.pdf", "u1")).toBe(false);
    expect(nellaCartella("u1/../u2/a.pdf", "u1")).toBe(false);
    expect(nellaCartella("u10/a.pdf", "u1")).toBe(false);
    expect(nellaCartella(null, "u1")).toBe(false);
  });
});
