import { describe, expect, it } from "vitest";
import { passoCorrente, rigaStatoLavoro, type AppuntamentoBox } from "./boxLavoro";
import { passiRichiesta } from "./passiRichiesta";

// Venerdi' 9 ottobre 2026, 12:00 a Roma.
const adesso = new Date("2026-10-09T10:00:00.000Z");

const mcs = { id: "p1", name: "Milano Clean Squad" };
const nessuno = new Set<string>();
const rossi = { id: "p2", name: "Idraulica Rossi" };

function appt(extra: Partial<AppuntamentoBox>): AppuntamentoBox {
  return {
    id: "a1",
    request_id: "r1",
    status: "proposed",
    proposed_by: "professional",
    // Martedi' 13 ottobre, 09:00 a Roma.
    starts_at: "2026-10-13T07:00:00.000Z",
    duration_minutes: 60,
    professional_id: "p1",
    ...extra,
  };
}

describe("la riga di stato del box: un caso per regola", () => {
  it("1. il pro propone un orario", () => {
    expect(rigaStatoLavoro({ status: "matched", rispondenti: nessuno, appuntamenti: [appt({})], pros: [mcs] }, adesso)).toBe(
      "Milano Clean Squad propone mar 13 alle 09:00"
    );
  });

  it("2. appuntamento confermato, con oggi e domani", () => {
    // Sabato 10 ottobre, 10:00 a Roma.
    const domani = appt({ status: "confirmed", starts_at: "2026-10-10T08:00:00.000Z" });
    expect(rigaStatoLavoro({ status: "matched", rispondenti: nessuno, appuntamenti: [domani], pros: [mcs] }, adesso)).toBe(
      "Appuntamento domani alle 10:00 con Milano Clean Squad"
    );
    // Cominciato da mezz'ora, dura un'ora: non e' finito.
    const inCorso = appt({ status: "confirmed", starts_at: "2026-10-09T09:30:00.000Z" });
    expect(rigaStatoLavoro({ status: "matched", rispondenti: nessuno, appuntamenti: [inCorso], pros: [mcs] }, adesso)).toBe(
      "Appuntamento oggi alle 11:30 con Milano Clean Squad"
    );
  });

  it("3. il cliente ha proposto: aspetta il pro", () => {
    const mia = appt({ proposed_by: "customer", professional_id: "p2" });
    expect(rigaStatoLavoro({ status: "matched", rispondenti: nessuno, appuntamenti: [mia], pros: [mcs, rossi] }, adesso)).toBe(
      "In attesa che Idraulica Rossi confermi l'orario"
    );
  });

  it("nessun pro: «In attesa di risposte», qualunque sia lo stato", () => {
    for (const status of ["sent", "quote_request", "matched"]) {
      expect(rigaStatoLavoro({ status, rispondenti: nessuno, appuntamenti: [], pros: [] }, adesso)).toBe(
        "In attesa di risposte"
      );
    }
  });
});

// Dalle regole 4 in giu' la frase segue lo stato della richiesta, come i
// puntini (passiRichiesta): decisione di André del 15/10.
describe("la riga di stato del box: senza appuntamenti segue lo stato", () => {
  const vuoto = { appuntamenti: [] as AppuntamentoBox[] };

  it("matched, un pro: «In contatto con»", () => {
    expect(rigaStatoLavoro({ ...vuoto, rispondenti: nessuno, status: "matched", pros: [mcs] }, adesso)).toBe(
      "In contatto con Milano Clean Squad"
    );
  });

  it("matched da prima della 119, due pro e nessuno ha risposto: «Preventivo chiesto a 2 pro»", () => {
    expect(rigaStatoLavoro({ ...vuoto, rispondenti: nessuno, status: "matched", pros: [mcs, rossi] }, adesso)).toBe(
      "Preventivo chiesto a 2 pro"
    );
  });

  it("richiesta di preventivo con un pro: «Preventivo chiesto a»", () => {
    expect(
      rigaStatoLavoro({ ...vuoto, rispondenti: nessuno, status: "quote_request", pros: [{ id: "p3", name: "IdroMilano Express" }] }, adesso)
    ).toBe("Preventivo chiesto a IdroMilano Express");
  });

  it("richiesta di preventivo con due pro: «Preventivo chiesto a 2 pro»", () => {
    expect(rigaStatoLavoro({ ...vuoto, rispondenti: nessuno, status: "quote_request", pros: [mcs, rossi] }, adesso)).toBe(
      "Preventivo chiesto a 2 pro"
    );
  });

  it("l'Elettricista con un pro, non ancora matched: «Inviata a LuceChiara Impianti»", () => {
    expect(
      rigaStatoLavoro({ ...vuoto, rispondenti: nessuno, status: "sent", pros: [{ id: "p4", name: "LuceChiara Impianti" }] }, adesso)
    ).toBe("Inviata a LuceChiara Impianti");
  });

  it("inviata a due pro: «Inviata a 2 pro»", () => {
    expect(rigaStatoLavoro({ ...vuoto, rispondenti: nessuno, status: "sent", pros: [mcs, rossi] }, adesso)).toBe(
      "Inviata a 2 pro"
    );
  });

  it("le regole 1-3 vincono comunque sullo stato", () => {
    expect(
      rigaStatoLavoro({ status: "sent", rispondenti: nessuno, appuntamenti: [appt({})], pros: [mcs] }, adesso)
    ).toBe("Milano Clean Squad propone mar 13 alle 09:00");
    expect(
      rigaStatoLavoro(
        { status: "quote_request", rispondenti: nessuno, appuntamenti: [appt({ status: "confirmed" })], pros: [mcs, rossi] },
        adesso
      )
    ).toBe("Appuntamento mar 13 alle 09:00 con Milano Clean Squad");
  });
});

// Dalla 119 (15/10) contano i pro che hanno scritto davvero, non quelli
// collegati alla richiesta.
describe("la riga di stato del box: chi ha risposto davvero", () => {
  const verdi = { id: "p3", name: "Verdi Impianti" };
  const vuoto = { appuntamenti: [] as AppuntamentoBox[] };

  it("due risposte su due: «2 risposte da confrontare»", () => {
    expect(
      rigaStatoLavoro({ ...vuoto, status: "matched", pros: [mcs, rossi], rispondenti: new Set(["p1", "p2"]) }, adesso)
    ).toBe("2 risposte da confrontare");
  });

  it("N conta chi ha risposto, non chi e' collegato: 2 su 3", () => {
    expect(
      rigaStatoLavoro(
        { ...vuoto, status: "matched", pros: [mcs, rossi, verdi], rispondenti: new Set(["p1", "p3"]) },
        adesso
      )
    ).toBe("2 risposte da confrontare");
  });

  it("uno, ed e' l'unico collegato: «In contatto con»", () => {
    expect(
      rigaStatoLavoro({ ...vuoto, status: "matched", pros: [mcs], rispondenti: new Set(["p1"]) }, adesso)
    ).toBe("In contatto con Milano Clean Squad");
  });

  it("1 su 2: «Ha risposto <Pro>, in attesa di 1»", () => {
    expect(
      rigaStatoLavoro({ ...vuoto, status: "matched", pros: [mcs, rossi], rispondenti: new Set(["p2"]) }, adesso)
    ).toBe("Ha risposto Idraulica Rossi, in attesa di 1");
  });

  it("1 su 3: «… in attesa di 2»", () => {
    expect(
      rigaStatoLavoro(
        { ...vuoto, status: "matched", pros: [mcs, rossi, verdi], rispondenti: new Set(["p1"]) },
        adesso
      )
    ).toBe("Ha risposto Milano Clean Squad, in attesa di 2");
  });

  it("le risposte valgono anche se lo stato e' rimasto indietro", () => {
    expect(
      rigaStatoLavoro({ ...vuoto, status: "quote_request", pros: [mcs], rispondenti: new Set(["p1"]) }, adesso)
    ).toBe("In contatto con Milano Clean Squad");
  });

  it("un messaggio di un pro non collegato non conta", () => {
    expect(
      rigaStatoLavoro({ ...vuoto, status: "quote_request", pros: [mcs], rispondenti: new Set(["x"]) }, adesso)
    ).toBe("Preventivo chiesto a Milano Clean Squad");
  });

  it("le regole 1-3 vincono anche sulle risposte", () => {
    expect(
      rigaStatoLavoro(
        { status: "matched", appuntamenti: [appt({})], pros: [mcs, rossi], rispondenti: new Set(["p1", "p2"]) },
        adesso
      )
    ).toBe("Milano Clean Squad propone mar 13 alle 09:00");
  });
});

// PR 7 (15/10): la scelta, e i pro archiviati che non contano piu'.
describe("la riga di stato del box: scelto e archiviati", () => {
  const vuoto = { appuntamenti: [] as AppuntamentoBox[] };

  it("con un pro scelto e niente appuntamenti: «Hai scelto <Pro>»", () => {
    expect(
      rigaStatoLavoro(
        { ...vuoto, status: "matched", pros: [mcs, rossi], rispondenti: new Set(["p1", "p2"]), scelto: "p2" },
        adesso
      )
    ).toBe("Hai scelto Idraulica Rossi");
  });

  it("la proposta del pro scelto vince sulla scelta (regola 1)", () => {
    expect(
      rigaStatoLavoro(
        { status: "matched", appuntamenti: [appt({})], pros: [mcs], rispondenti: new Set(["p1"]), scelto: "p1" },
        adesso
      )
    ).toBe("Milano Clean Squad propone mar 13 alle 09:00");
  });

  it("l'appuntamento confermato vince sulla scelta (regola 2)", () => {
    expect(
      rigaStatoLavoro(
        {
          status: "matched",
          appuntamenti: [appt({ status: "confirmed" })],
          pros: [mcs],
          rispondenti: new Set(["p1"]),
          scelto: "p1",
        },
        adesso
      )
    ).toBe("Appuntamento mar 13 alle 09:00 con Milano Clean Squad");
  });

  it("un archiviato non conta fra le risposte: due hanno scritto, uno e' fuori da `pros`", () => {
    expect(
      rigaStatoLavoro(
        { ...vuoto, status: "matched", pros: [mcs], rispondenti: new Set(["p1", "p2"]) },
        adesso
      )
    ).toBe("In contatto con Milano Clean Squad");
  });

  it("uno scelto che non e' piu' fra i pro (archiviato dopo) non da' «Hai scelto»", () => {
    expect(
      rigaStatoLavoro(
        { ...vuoto, status: "matched", pros: [mcs], rispondenti: new Set(["p1"]), scelto: "p2" },
        adesso
      )
    ).toBe("In contatto con Milano Clean Squad");
  });
});

describe("la riga di stato del box: la priorita'", () => {
  it("la proposta del pro batte l'appuntamento confermato", () => {
    const confermato = appt({ id: "a0", status: "confirmed", starts_at: "2026-10-10T08:00:00.000Z" });
    expect(
      rigaStatoLavoro({ status: "matched", rispondenti: nessuno, appuntamenti: [confermato, appt({})], pros: [mcs] }, adesso)
    ).toBe("Milano Clean Squad propone mar 13 alle 09:00");
  });

  it("l'appuntamento confermato batte «2 risposte» e la proposta del cliente", () => {
    const confermato = appt({ status: "confirmed", professional_id: "p2" });
    const mia = appt({ id: "a2", proposed_by: "customer", starts_at: "2026-10-10T08:00:00.000Z" });
    expect(
      rigaStatoLavoro({ status: "matched", rispondenti: nessuno, appuntamenti: [mia, confermato], pros: [mcs, rossi] }, adesso)
    ).toBe("Appuntamento mar 13 alle 09:00 con Idraulica Rossi");
  });

  it("la proposta del cliente batte «2 risposte»", () => {
    const mia = appt({ proposed_by: "customer" });
    expect(rigaStatoLavoro({ status: "matched", rispondenti: nessuno, appuntamenti: [mia], pros: [mcs, rossi] }, adesso)).toBe(
      "In attesa che Milano Clean Squad confermi l'orario"
    );
  });

  it("una proposta il cui orario e' passato non conta, di nessuno dei due", () => {
    const passata = appt({ starts_at: "2026-10-09T08:00:00.000Z" });
    const miaPassata = appt({ id: "a2", proposed_by: "customer", starts_at: "2026-10-09T08:00:00.000Z" });
    expect(
      rigaStatoLavoro(
        { status: "matched", rispondenti: new Set(["p1", "p2"]), appuntamenti: [passata, miaPassata], pros: [mcs, rossi] },
        adesso
      )
    ).toBe("2 risposte da confrontare");
  });

  it("un appuntamento confermato gia' finito non conta", () => {
    const ieri = appt({ status: "confirmed", starts_at: "2026-10-08T08:00:00.000Z" });
    expect(rigaStatoLavoro({ status: "matched", rispondenti: nessuno, appuntamenti: [ieri], pros: [mcs] }, adesso)).toBe(
      "In contatto con Milano Clean Squad"
    );
  });

  it("fra due proposte del pro vince la piu' vicina", () => {
    const lontana = appt({ id: "a1", starts_at: "2026-10-20T07:00:00.000Z" });
    const vicina = appt({ id: "a2", starts_at: "2026-10-10T15:00:00.000Z" });
    expect(
      rigaStatoLavoro({ status: "matched", rispondenti: nessuno, appuntamenti: [lontana, vicina], pros: [mcs] }, adesso)
    ).toBe("Milano Clean Squad propone domani alle 17:00");
  });

  it("un pro che non e' fra quelli della richiesta resta «Professionista»", () => {
    expect(
      rigaStatoLavoro({ status: "matched", rispondenti: nessuno, appuntamenti: [appt({ professional_id: "x" })], pros: [mcs] }, adesso)
    ).toBe("Professionista propone mar 13 alle 09:00");
  });
});

describe("il passo della barra, per chi non la vede", () => {
  it("il passo «adesso», contato da 1", () => {
    const passi = passiRichiesta({ status: "quote_request", appuntamento: null, quoteCount: 2 });
    expect(passoCorrente(passi)).toEqual({ numero: 2, di: 5, etichetta: "2 pro contattati" });
  });

  it("chiusa: nessun «adesso», l'ultimo passo", () => {
    const passi = passiRichiesta({ status: "closed", appuntamento: null, quoteCount: 1 });
    expect(passoCorrente(passi)).toEqual({ numero: 4, di: 4, etichetta: "Conclusa" });
  });
});
