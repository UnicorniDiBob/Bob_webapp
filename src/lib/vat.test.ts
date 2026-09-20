// Le regole di LETTURA della verifica (blocco 10), quelle che decidono cosa
// vede un cliente sulla scheda di un professionista.
//
// PERCHE' ESISTE QUESTO FILE. La caduta del badge e' viva dal 13/09 (mig 080) e
// non e' mai stata esercitata su dati veri: l'unico professionista verificato
// scade nel 2027, il giro notturno esamina zero righe ogni notte e finche' e'
// cosi' un errore qui non lo trova nessuno finche' non lo trova un cliente.
// Queste sono funzioni pure: si possono provare senza database, e il tetto
// della 094 non ha altro modo di essere provato prima del pilota.
//
// Le date: `new Date(...)` esplicite, mai `Date.now()` implicito, cosi' il test
// non cambia risultato a seconda del giorno in cui gira.

import { describe, expect, it } from "vitest";
import {
  FINESTRA_RICONTROLLO_GIORNI,
  SLA_VERIFICA_GIORNI_LAVORATIVI,
  TETTO_CESSAZIONE_GIORNI,
  aggiungiGiorniLavorativi,
  giorniLavorativiTra,
  livelloVisibile,
  publicVerificationLevel,
  scadenzaBadge,
  statoCoda,
  tettoRicontrollo,
  verificaScaduta,
} from "./vat";

const iso = (s: string) => new Date(s).toISOString();

// Lunedi' 7 settembre 2026, mattina.
const LUNEDI = new Date("2026-09-07T09:00:00.000Z");

describe("giorni lavorativi", () => {
  it("non conta sabato e domenica", () => {
    // Venerdi' -> lunedi' successivo: un solo giorno lavorativo in mezzo.
    expect(
      giorniLavorativiTra(
        new Date("2026-09-04T09:00:00.000Z"),
        new Date("2026-09-07T09:00:00.000Z")
      )
    ).toBe(1);
  });

  it("aggiunge saltando il fine settimana", () => {
    // Lunedi' + 5 giorni lavorativi = lunedi' successivo, non sabato.
    const dopo = aggiungiGiorniLavorativi(LUNEDI, SLA_VERIFICA_GIORNI_LAVORATIVI);
    expect(dopo.getUTCDate()).toBe(14);
  });

  it("una data uguale o precedente vale zero, non un numero negativo", () => {
    expect(giorniLavorativiTra(LUNEDI, LUNEDI)).toBe(0);
  });
});

describe("statoCoda: l'SLA misurato, non solo dichiarato", () => {
  it("senza timestamp d'ingresso non c'e' nessun orologio", () => {
    expect(statoCoda(null)).toBeNull();
  });

  it("dentro i 5 giorni lavorativi non e' sforata", () => {
    const s = statoCoda(iso("2026-09-07T09:00:00.000Z"), new Date("2026-09-10T09:00:00.000Z"));
    expect(s?.sforata).toBe(false);
    expect(s?.inCoda).toBe(3);
    expect(s?.rimasti).toBe(2);
  });

  it("oltre i 5 giorni lavorativi e' sforata e dice di quanto", () => {
    const s = statoCoda(iso("2026-09-07T09:00:00.000Z"), new Date("2026-09-16T09:00:00.000Z"));
    expect(s?.sforata).toBe(true);
    expect(s?.rimasti).toBe(-2);
  });

  it("il fine settimana non consuma l'SLA", () => {
    // Venerdi' -> lunedi': sono passati tre giorni solari, uno lavorativo.
    const s = statoCoda(iso("2026-09-04T09:00:00.000Z"), new Date("2026-09-07T09:00:00.000Z"));
    expect(s?.inCoda).toBe(1);
    expect(s?.sforata).toBe(false);
  });
});

describe("scadenzaBadge: la prima fra la scadenza e la fine della finestra", () => {
  it("senza ricontrollo aperto vale la scadenza annuale", () => {
    expect(scadenzaBadge(iso("2027-09-12T00:00:00.000Z"), null)).toBe(
      iso("2027-09-12T00:00:00.000Z")
    );
  });

  it("un ricontrollo aperto oggi anticipa di molto una scadenza lontana", () => {
    const fine = scadenzaBadge(
      iso("2027-09-12T00:00:00.000Z"),
      iso("2026-09-07T00:00:00.000Z")
    );
    expect(fine).toBe(iso("2026-09-14T00:00:00.000Z"));
    expect(FINESTRA_RICONTROLLO_GIORNI).toBe(7);
  });

  it("senza nessuna delle due date non spegne niente", () => {
    expect(scadenzaBadge(null, null)).toBeNull();
  });
});

describe("tettoRicontrollo: il tetto vale solo sulle cessazioni", () => {
  it("sulla cessazione e' l'apertura del caso piu' 14 giorni", () => {
    expect(tettoRicontrollo(iso("2026-09-07T00:00:00.000Z"), "cessazione")).toBe(
      iso("2026-09-21T00:00:00.000Z")
    );
    expect(TETTO_CESSAZIONE_GIORNI).toBe(14);
  });

  it("sugli altri motivi non c'e' tetto", () => {
    for (const motivo of ["scadenza", "procedura", "intestazione", null]) {
      expect(tettoRicontrollo(iso("2026-09-07T00:00:00.000Z"), motivo)).toBeNull();
    }
  });

  it("senza un caso aperto non c'e' tetto", () => {
    expect(tettoRicontrollo(null, "cessazione")).toBeNull();
  });
});

describe("livelloVisibile: cosa vede un cliente", () => {
  const passato = iso("2020-01-01T00:00:00.000Z");
  const futuro = iso("2030-01-01T00:00:00.000Z");

  it("scaduta = non verificata", () => {
    expect(livelloVisibile("vat_verified", passato)).toBe("none");
    expect(verificaScaduta(passato)).toBe(true);
  });

  it("mentre la palla e' nostra la data non morde", () => {
    expect(livelloVisibile("vat_verified", passato, true)).toBe("vat_verified");
  });

  it("IL TETTO BATTE «la palla e' nostra»: oltre, l'etichetta si spegne", () => {
    expect(livelloVisibile("documents_verified", passato, true, passato)).toBe("none");
  });

  it("un tetto non ancora arrivato non spegne niente", () => {
    expect(livelloVisibile("vat_verified", futuro, true, futuro)).toBe("vat_verified");
  });

  it("senza tetto e senza scadenza il livello resta quello che e'", () => {
    expect(livelloVisibile("documents_verified", null)).toBe("documents_verified");
  });
});

describe("publicVerificationLevel: la stessa regola, piu' il cancello dello staff", () => {
  const passato = iso("2020-01-01T00:00:00.000Z");

  it("«Pro+» si mostra solo se anche lo staff ha approvato", () => {
    expect(publicVerificationLevel("documents_verified", "pending")).toBe("vat_verified");
    expect(publicVerificationLevel("documents_verified", "verified")).toBe(
      "documents_verified"
    );
  });

  it("il tetto vince anche qui, staff approvato o no", () => {
    expect(
      publicVerificationLevel("documents_verified", "verified", passato, true, passato)
    ).toBe("none");
  });

  it("in esame, senza tetto, il badge tiene", () => {
    expect(
      publicVerificationLevel("vat_verified", "verified", passato, true, null)
    ).toBe("vat_verified");
  });
});
