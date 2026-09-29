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
  avvisoSlaAcceso,
  casiInEmergenza,
  giorniLavorativiTra,
  livelloVisibile,
  misuraSlaStorica,
  riepilogoSforamenti,
  publicVerificationLevel,
  scadenzaBadge,
  statoCoda,
  tettoRicontrollo,
  verificaScaduta,
  type EventoVerificaSla,
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

// ---------------------------------------------------------------------------
// misuraSlaStorica (29/09): quanto ci abbiamo messo davvero, sui casi chiusi
// ---------------------------------------------------------------------------
// Tutti gli orari sono a MEZZOGIORNO di Roma: giorniLavorativiTra() conta le
// mezzanotti nel fuso del processo (UTC su Vercel e in CI, Roma su un Mac), e a
// mezzogiorno il giorno di calendario e' lo stesso in entrambi.
// Settembre 2026: lunedi' 7, 14, 21, 28.

const PRO = "pro-1";
const ev = (
  event: string,
  quando: string,
  actor_role: string | null = null,
  professional_id = PRO
): EventoVerificaSla => ({
  professional_id,
  event,
  created_at: `${quando}T12:00:00+02:00`,
  actor_role,
});

describe("misuraSlaStorica: l'SLA sui casi gia' chiusi", () => {
  it("chiuso dentro l'SLA: due giorni lavorativi, non sforato", () => {
    const m = misuraSlaStorica([
      ev("vat_submitted", "2026-09-07", "professional"),
      ev("vat_check_failed", "2026-09-07", "professional"),
      ev("level_granted", "2026-09-09", "admin"),
    ]);
    expect(m.esameUmano).toHaveLength(1);
    const c = m.esameUmano[0];
    expect(c.esito).toBe("concesso");
    expect(c.ultimoTratto).toBe(2);
    expect(c.attesaTotale).toBe(2);
    expect(c.sforatoSecondoIToS).toBe(false);
    expect(m.rispettati).toBe(1);
    expect(m.sforati).toBe(0);
  });

  it("chiuso oltre l'SLA: sei giorni lavorativi, sforato", () => {
    const m = misuraSlaStorica([
      ev("vat_submitted", "2026-09-07", "professional"),
      ev("vat_rejected", "2026-09-15", "cs"),
    ]);
    const c = m.esameUmano[0];
    expect(c.esito).toBe("respinto");
    expect(c.ultimoTratto).toBe(6);
    expect(c.sforatoSecondoIToS).toBe(true);
    expect(m.sforati).toBe(1);
  });

  it("la pausa documents_requested -> documents_submitted non si conta", () => {
    // Lun 7 -> mer 9: 2 giorni nostri. Poi la palla e' sua fino a lun 21.
    // Lun 21 -> gio 24: 3 giorni nostri. Dal primo all'ultimo evento sono 13.
    const m = misuraSlaStorica([
      ev("vat_submitted", "2026-09-07", "professional"),
      ev("documents_requested", "2026-09-09", "admin"),
      ev("documents_submitted", "2026-09-21", "professional"),
      ev("level_granted", "2026-09-24", "admin"),
    ]);
    const c = m.esameUmano[0];
    expect(c.tratti.map((t) => t.giorni)).toEqual([2, 3]);
    expect(c.attesaTotale).toBe(5);
    expect(c.ultimoTratto).toBe(3);
    expect(c.attesaTotale).not.toBe(
      giorniLavorativiTra(new Date("2026-09-07T12:00:00+02:00"), new Date("2026-09-24T12:00:00+02:00"))
    );
  });

  it("i due numeri divergono: dentro i ToS sull'ultimo tratto, oltre i 5 giorni in totale", () => {
    // Lun 7 -> ven 11: 4. Lun 21 -> gio 24: 3. Totale 7, ultimo tratto 3.
    const m = misuraSlaStorica([
      ev("vat_submitted", "2026-09-07", "professional"),
      ev("documents_requested", "2026-09-11", "admin"),
      ev("documents_submitted", "2026-09-21", "professional"),
      ev("level_granted", "2026-09-24", "admin"),
    ]);
    const c = m.esameUmano[0];
    expect(c.attesaTotale).toBe(7);
    expect(c.ultimoTratto).toBe(3);
    expect(c.sforatoSecondoIToS).toBe(false);
  });

  it("un ricontrollo apre il caso con la palla SUA: l'orologio parte col documento", () => {
    // Aperto lun 7 dal giro notturno; il documento arriva lun 14; deciso mer 16.
    const m = misuraSlaStorica([
      ev("vat_recheck_opened", "2026-09-07", "system"),
      ev("documents_submitted", "2026-09-14", "professional"),
      ev("level_granted", "2026-09-16", "admin"),
    ]);
    const c = m.esameUmano[0];
    expect(c.tratti).toHaveLength(1);
    expect(c.attesaTotale).toBe(2);
    expect(c.apertoIl.toISOString()).toBe(iso("2026-09-07T12:00:00+02:00"));
  });

  it("un secondo documento sul ricontrollo riazzera l'ultimo tratto, come il trigger", () => {
    const m = misuraSlaStorica([
      ev("vat_recheck_opened", "2026-09-07", "system"),
      ev("documents_submitted", "2026-09-14", "professional"),
      ev("documents_submitted", "2026-09-16", "professional"),
      ev("level_granted", "2026-09-17", "admin"),
    ]);
    const c = m.esameUmano[0];
    expect(c.tratti.map((t) => t.giorni)).toEqual([2, 1]);
    expect(c.ultimoTratto).toBe(1);
    expect(c.attesaTotale).toBe(3);
  });

  it("un ricontrollo chiuso senza che la palla sia mai stata nostra non entra nella misura", () => {
    const m = misuraSlaStorica([
      ev("vat_recheck_opened", "2026-09-07", "system"),
      ev("vat_rejected", "2026-09-21", "admin"),
      ev("level_revoked", "2026-09-21", "admin"),
    ]);
    expect(m.esameUmano).toHaveLength(0);
    expect(m.senzaAttesaNostra).toBe(1);
  });

  it("un caso senza evento di chiusura e' aperto: non entra nella misura storica", () => {
    const m = misuraSlaStorica([
      ev("vat_submitted", "2026-09-07", "professional"),
      ev("vat_check_failed", "2026-09-08", "system"),
    ]);
    expect(m.esameUmano).toHaveLength(0);
    expect(m.aperti).toBe(1);
  });

  it("le chiusure automatiche si contano a parte, per actor_role", () => {
    const m = misuraSlaStorica([
      // All'ingresso: VIES e intestazione confermati nello stesso secondo.
      ev("vat_submitted", "2026-09-07", "professional", "pro-a"),
      ev("vat_check_ok", "2026-09-07", "professional", "pro-a"),
      ev("level_granted", "2026-09-07", "professional", "pro-a"),
      // Il giro notturno che ritenta un VIES che non rispondeva.
      ev("vat_submitted", "2026-09-07", "professional", "pro-b"),
      ev("level_granted", "2026-09-08", "system", "pro-b"),
      // Un evento di chiusura senza ruolo.
      ev("vat_submitted", "2026-09-07", "professional", "pro-c"),
      ev("level_granted", "2026-09-08", null, "pro-c"),
    ]);
    expect(m.esameUmano).toHaveLength(0);
    expect(m.automatici).toEqual({ giroNotturno: 1, ingresso: 1 });
    expect(m.nonAttribuiti).toBe(1);
  });

  it("rifiuto e revoca insieme chiudono un caso solo", () => {
    const m = misuraSlaStorica([
      ev("vat_submitted", "2026-09-07", "professional"),
      ev("vat_rejected", "2026-09-08", "admin"),
      ev("level_revoked", "2026-09-08", "admin"),
    ]);
    expect(m.esameUmano).toHaveLength(1);
    expect(m.esameUmano[0].esito).toBe("respinto");
  });

  it("il fine settimana non si conta: da venerdi' a lunedi' e' un giorno", () => {
    const m = misuraSlaStorica([
      ev("vat_submitted", "2026-09-11", "professional"),
      ev("level_granted", "2026-09-14", "admin"),
    ]);
    expect(m.esameUmano[0].attesaTotale).toBe(1);
  });

  it("un nuovo vat_submitted su un caso gia' in pending non riazzera l'orologio", () => {
    const m = misuraSlaStorica([
      ev("vat_submitted", "2026-09-07", "professional"),
      ev("vat_submitted", "2026-09-09", "professional"),
      ev("level_granted", "2026-09-16", "admin"),
    ]);
    const c = m.esameUmano[0];
    expect(c.tratti).toHaveLength(1);
    expect(c.ultimoTratto).toBe(7);
    expect(c.sforatoSecondoIToS).toBe(true);
  });

  it("gli eventi possono arrivare in qualunque ordine e mescolati fra professionisti", () => {
    const m = misuraSlaStorica([
      ev("level_granted", "2026-09-09", "admin", "pro-x"),
      ev("vat_submitted", "2026-09-07", "professional", "pro-y"),
      ev("vat_submitted", "2026-09-07", "professional", "pro-x"),
      ev("vat_rejected", "2026-09-15", "admin", "pro-y"),
    ]);
    expect(m.esameUmano.map((c) => [c.professionalId, c.attesaTotale])).toEqual([
      ["pro-x", 2],
      ["pro-y", 6],
    ]);
  });

  it("stessa regola di statoCoda: 5 giorni esatti e un'ora dopo e' gia' sforato", () => {
    const aperto = new Date("2026-09-07T12:00:00+02:00");
    const dopo = new Date("2026-09-14T13:00:00+02:00");
    const m = misuraSlaStorica([
      { professional_id: PRO, event: "vat_submitted", created_at: aperto.toISOString(), actor_role: "professional" },
      { professional_id: PRO, event: "level_granted", created_at: dopo.toISOString(), actor_role: "admin" },
    ]);
    expect(m.esameUmano[0].sforatoSecondoIToS).toBe(statoCoda(aperto.toISOString(), dopo)?.sforata);
    expect(m.esameUmano[0].sforatoSecondoIToS).toBe(true);
  });
});

describe("riepilogoSforamenti: quello che il giro notturno conta ogni notte", () => {
  const ADESSO = new Date("2026-09-29T12:00:00+02:00"); // martedi'

  it("coda vuota: zero casi, zero sforati", () => {
    expect(riepilogoSforamenti([], ADESSO)).toEqual({ pallaNostra: 0, sforati: 0, peggiore: 0 });
  });

  it("conta solo i casi con la palla nostra, e fra questi gli sforati", () => {
    const r = riepilogoSforamenti(
      [
        "2026-09-28T12:00:00+02:00", // ieri: dentro
        "2026-09-18T12:00:00+02:00", // ven 18: 7 giorni lavorativi, sforato di 2
        "2026-09-21T12:00:00+02:00", // lun 21: 6 giorni lavorativi, sforato di 1
        null, // palla sua: nessun orologio
      ],
      ADESSO
    );
    expect(r).toEqual({ pallaNostra: 3, sforati: 2, peggiore: 2 });
  });

  it("usa la stessa regola di statoCoda, caso per caso", () => {
    const aperto = "2026-09-21T12:00:00+02:00";
    expect(riepilogoSforamenti([aperto], ADESSO).sforati).toBe(
      statoCoda(aperto, ADESSO)?.sforata ? 1 : 0
    );
  });
});

describe("casiInEmergenza: la sezione Emergenze usa il criterio del giro notturno", () => {
  const ADESSO = new Date("2026-09-29T12:00:00+02:00"); // martedi'
  type Riga = { id: string; vat_review_state: string | null; vat_review_opened_at: string | null };
  const righe: Riga[] = [
    // Prima richiesta in pending, oltre l'SLA: c'era gia' prima.
    { id: "pending-vecchio", vat_review_state: "pending", vat_review_opened_at: "2026-09-18T12:00:00+02:00" },
    // IL CASO CHE PRIMA SFUGGIVA: un ricontrollo con documento caricato,
    // quindi palla nostra, e oltre l'SLA.
    { id: "ricontrollo-con-documento", vat_review_state: "recheck", vat_review_opened_at: "2026-09-21T12:00:00+02:00" },
    // Un ricontrollo senza documento: palla sua, nessun orologio.
    { id: "ricontrollo-senza-documento", vat_review_state: "recheck", vat_review_opened_at: null },
    // Documenti richiesti: palla sua.
    { id: "documenti-richiesti", vat_review_state: "docs_requested", vat_review_opened_at: null },
    // In pending ma dentro l'SLA.
    { id: "pending-recente", vat_review_state: "pending", vat_review_opened_at: "2026-09-28T12:00:00+02:00" },
  ];

  it("prende il ricontrollo con documento, che il filtro per stato perdeva", () => {
    const ids = casiInEmergenza(righe, ADESSO).map((r) => r.id);
    expect(ids).toContain("ricontrollo-con-documento");
    // Il filtro di prima (solo pending e docs_requested) lo escludeva.
    const primaPerStato = righe
      .filter((r) => r.vat_review_state === "pending" || r.vat_review_state === "docs_requested")
      .filter((r) => statoCoda(r.vat_review_opened_at, ADESSO)?.sforata)
      .map((r) => r.id);
    expect(primaPerStato).not.toContain("ricontrollo-con-documento");
  });

  it("chi ha la palla sua o e' dentro l'SLA non e' un'emergenza", () => {
    const ids = casiInEmergenza(righe, ADESSO).map((r) => r.id);
    expect(ids).not.toContain("ricontrollo-senza-documento");
    expect(ids).not.toContain("documenti-richiesti");
    expect(ids).not.toContain("pending-recente");
  });

  it("l'ordine resta dal piu' vecchio al piu' recente", () => {
    expect(casiInEmergenza(righe, ADESSO).map((r) => r.id)).toEqual([
      "pending-vecchio",
      "ricontrollo-con-documento",
    ]);
  });

  it("la pagina e il giro notturno contano lo stesso numero", () => {
    expect(casiInEmergenza(righe, ADESSO)).toHaveLength(
      riepilogoSforamenti(
        righe.map((r) => r.vat_review_opened_at),
        ADESSO
      ).sforati
    );
  });
});

describe("avvisoSlaAcceso: l'avviso di ritardo al professionista", () => {
  const ADESSO = new Date("2026-09-29T12:00:00+02:00"); // martedi'
  const OLTRE = "2026-09-21T12:00:00+02:00"; // 6 giorni lavorativi fa
  const DENTRO = "2026-09-28T12:00:00+02:00"; // ieri

  it("si accende su una richiesta in esame oltre l'SLA", () => {
    expect(avvisoSlaAcceso("pending", OLTRE, ADESSO)).toBe(true);
  });

  it("non si accende dentro l'SLA", () => {
    expect(avvisoSlaAcceso("pending", DENTRO, ADESSO)).toBe(false);
  });

  it("non si accende quando la palla e' sua, o il caso e' chiuso", () => {
    expect(avvisoSlaAcceso("docs_requested", null, ADESSO)).toBe(false);
    expect(avvisoSlaAcceso("rejected", null, ADESSO)).toBe(false);
    expect(avvisoSlaAcceso(null, null, ADESSO)).toBe(false);
    expect(avvisoSlaAcceso("pending", null, ADESSO)).toBe(false);
  });

  it("non si accende sui ricontrolli, anche oltre l'SLA: li' il componente non c'e'", () => {
    expect(avvisoSlaAcceso("recheck", OLTRE, ADESSO)).toBe(false);
  });

  it("segue statoCoda: stessa soglia del riquadro admin", () => {
    for (const aperto of [OLTRE, DENTRO, "2026-09-22T12:00:00+02:00", "2026-09-22T11:00:00+02:00"]) {
      expect(avvisoSlaAcceso("pending", aperto, ADESSO)).toBe(statoCoda(aperto, ADESSO)?.sforata === true);
    }
  });
});
