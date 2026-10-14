import { describe, expect, it } from "vitest";
import { passiRichiesta } from "./passiRichiesta";

const riga = (p: ReturnType<typeof passiRichiesta>) =>
  p.map((x) => `${x.etichetta}:${x.stato}`).join(" | ");

describe("la barra di stato: le richieste aperte come prima", () => {
  it("inviata", () => {
    expect(riga(passiRichiesta({ status: "sent", appuntamento: null, quoteCount: 1 }))).toBe(
      "Inviata:adesso | In contatto:da-fare | Appuntamento:da-fare | Conclusa:da-fare"
    );
  });

  it("preventivo chiesto a piu' pro", () => {
    expect(riga(passiRichiesta({ status: "quote_request", appuntamento: null, quoteCount: 2 }))).toBe(
      "Inviata:fatto | 2 pro contattati:adesso | In contatto:da-fare | Appuntamento:da-fare | Conclusa:da-fare"
    );
    expect(
      passiRichiesta({ status: "quote_request", appuntamento: null, quoteCount: 1 })[1].etichetta
    ).toBe("Preventivo chiesto");
  });

  it("in contatto", () => {
    expect(riga(passiRichiesta({ status: "matched", appuntamento: null, quoteCount: 1 }))).toBe(
      "Inviata:fatto | In contatto:adesso | Appuntamento:da-fare | Conclusa:da-fare"
    );
  });

  it("appuntamento confermato o da confermare", () => {
    expect(riga(passiRichiesta({ status: "matched", appuntamento: "confermato", quoteCount: 1 }))).toBe(
      "Inviata:fatto | In contatto:fatto | Appuntamento:adesso | Conclusa:da-fare"
    );
    expect(
      riga(passiRichiesta({ status: "matched", appuntamento: "da-confermare", quoteCount: 1 }))
    ).toBe("Inviata:fatto | In contatto:fatto | Appuntamento da confermare:adesso | Conclusa:da-fare");
  });
});

describe("la barra di stato: le richieste chiuse", () => {
  it("chiusa: tutto fatto, «Conclusa» compresa (c3e331b5)", () => {
    expect(riga(passiRichiesta({ status: "closed", appuntamento: null, quoteCount: 1 }))).toBe(
      "Inviata:fatto | In contatto:fatto | Appuntamento:fatto | Conclusa:fatto"
    );
  });

  it("disdetta: l'ultimo passo dice «Disdetta», neutro (22818d7e)", () => {
    expect(
      riga(passiRichiesta({ status: "closed", closedReason: "disdetto", appuntamento: null, quoteCount: 1 }))
    ).toBe("Inviata:fatto | In contatto:fatto | Appuntamento:fatto | Disdetta:neutro");
  });

  it("«disdetto» su una richiesta aperta non cambia niente", () => {
    expect(
      passiRichiesta({ status: "matched", closedReason: "disdetto", appuntamento: null, quoteCount: 1 }).at(-1)
    ).toEqual({ etichetta: "Conclusa", stato: "da-fare" });
  });
});
