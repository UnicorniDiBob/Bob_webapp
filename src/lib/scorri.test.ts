import { describe, expect, it } from "vitest";
import {
  ATTESA_ARCHIVIA_MS,
  azioniRiga,
  pallino,
  CodaArchivia,
  azioneAlRilascio,
  bloccoDirezione,
  contaNonLetti,
  partenzaIgnorata,
  spostamentoVisibile,
  type DaArchiviare,
} from "./scorri";

describe("di chi e' il gesto", () => {
  it("sotto 10px non si decide", () => {
    expect(bloccoDirezione(6, 4)).toBeNull();
  });

  it("orizzontale solo se domina chiaramente", () => {
    expect(bloccoDirezione(30, 5)).toBe("orizzontale");
    expect(bloccoDirezione(-30, 12)).toBe("orizzontale");
    expect(bloccoDirezione(20, 18)).toBe("verticale");
    expect(bloccoDirezione(3, 40)).toBe("verticale");
  });

  it("vicino al bordo sinistro e' il «torna indietro» di Safari", () => {
    expect(partenzaIgnorata(10)).toBe(true);
    expect(partenzaIgnorata(23)).toBe(true);
    expect(partenzaIgnorata(24)).toBe(false);
  });
});

describe("cosa scatta al rilascio", () => {
  const base = { larghezza: 360, durataMs: 600, destra: true, sinistra: true };

  it("oltre il 35% della riga", () => {
    expect(azioneAlRilascio({ ...base, dx: 130 })).toBe("destra");
    expect(azioneAlRilascio({ ...base, dx: -130 })).toBe("sinistra");
  });

  it("sotto, torna indietro", () => {
    expect(azioneAlRilascio({ ...base, dx: 100 })).toBeNull();
  });

  it("un colpo veloce basta anche se corto", () => {
    expect(azioneAlRilascio({ ...base, dx: -60, durataMs: 80 })).toBe("sinistra");
    expect(azioneAlRilascio({ ...base, dx: 30, durataMs: 20 })).toBeNull();
  });

  it("solo le direzioni permesse: il pro non archivia", () => {
    expect(azioneAlRilascio({ ...base, sinistra: false, dx: -200 })).toBeNull();
    expect(spostamentoVisibile(-80, true, false)).toBe(0);
    expect(spostamentoVisibile(80, true, false)).toBe(80);
  });
});

describe("«Archivia» con 5 secondi per ripensarci", () => {
  function coda() {
    const inviati: [string, string][] = [];
    const timers: { f: () => void; ms: number; vivo: boolean }[] = [];
    const c = new CodaArchivia(
      (d: DaArchiviare, modo) => inviati.push([d.chiave, modo]),
      () => {},
      ATTESA_ARCHIVIA_MS,
      {
        set: (f, ms) => {
          timers.push({ f, ms, vivo: true });
          return (timers.length - 1) as unknown as ReturnType<typeof setTimeout>;
        },
        clear: (t) => {
          timers[t as unknown as number].vivo = false;
        },
      }
    );
    const scadi = () => timers.filter((t) => t.vivo).forEach((t) => ((t.vivo = false), t.f()));
    return { c, inviati, scadi, timers };
  }
  const d = (k: string): DaArchiviare => ({ chiave: k, requestId: `r${k}`, professionalId: `p${k}` });

  it("parte solo quando i 5 secondi scadono", () => {
    const { c, inviati, scadi, timers } = coda();
    c.aggiungi(d("a"));
    expect(inviati).toEqual([]);
    expect(timers[0].ms).toBe(5000);
    scadi();
    expect(inviati).toEqual([["a", "normale"]]);
  });

  it("«Annulla»: non parte niente, nemmeno dopo", () => {
    const { c, inviati, scadi } = coda();
    c.aggiungi(d("a"));
    expect(c.annulla()?.chiave).toBe("a");
    scadi();
    c.svuota("beacon");
    expect(inviati).toEqual([]);
  });

  it("un secondo «Archivia» manda subito il primo", () => {
    const { c, inviati } = coda();
    c.aggiungi(d("a"));
    c.aggiungi(d("b"));
    expect(inviati).toEqual([["a", "normale"]]);
    expect(c.inAttesa?.chiave).toBe("b");
  });

  it("uscire dalla pagina lo manda; chiudere la scheda lo manda col beacon", () => {
    const uno = coda();
    uno.c.aggiungi(d("a"));
    uno.c.svuota("normale");
    expect(uno.inviati).toEqual([["a", "normale"]]);
    const due = coda();
    due.c.aggiungi(d("b"));
    due.c.svuota("beacon");
    expect(due.inviati).toEqual([["b", "beacon"]]);
  });

  it("mai doppio: dopo il beacon il timer e lo svuotamento non rimandano", () => {
    const { c, inviati, scadi } = coda();
    c.aggiungi(d("a"));
    c.svuota("beacon");
    scadi();
    c.svuota("normale");
    expect(inviati).toEqual([["a", "beacon"]]);
  });
});

describe("il pallino con i segni «da leggere»", () => {
  it("una segnata senza non letti conta 1; con non letti non aggiunge", () => {
    expect(
      contaNonLetti([
        { nonLetti: 0, daLeggere: true },
        { nonLetti: 3, daLeggere: true },
        { nonLetti: 2, daLeggere: false },
        { nonLetti: 0, daLeggere: false },
      ])
    ).toBe(1 + 3 + 2);
  });
});

describe("chi puo' scorrere cosa (16/10)", () => {
  const base = { archiviata: false, chiusa: false, daLeggere: false };

  it("cliente, «Attive»: a destra «Da leggere», a sinistra «Archivia» con «Annulla»", () => {
    expect(azioniRiga({ ...base, ruolo: "customer" })).toEqual({
      destra: { etichetta: "Da leggere" },
      sinistra: { tipo: "archivia", etichetta: "Archivia", conAnnulla: true },
    });
  });

  it("cliente, «Archiviate»: a destra «Da leggere», a sinistra «Riapri» SENZA «Annulla»", () => {
    expect(azioniRiga({ ...base, ruolo: "customer", archiviata: true })).toEqual({
      destra: { etichetta: "Da leggere" },
      sinistra: { tipo: "riapri", etichetta: "Riapri", conAnnulla: false },
    });
  });

  it("segnata: a destra «Letto»", () => {
    expect(azioniRiga({ ...base, ruolo: "customer", archiviata: true, daLeggere: true }).destra.etichetta).toBe("Letto");
  });

  it("richiesta chiusa, attiva: niente da archiviare", () => {
    expect(azioniRiga({ ...base, ruolo: "customer", chiusa: true }).sinistra).toBeNull();
  });

  it("il pro: solo a destra, anche sulle archiviate", () => {
    expect(azioniRiga({ ...base, ruolo: "professional" }).sinistra).toBeNull();
    expect(azioniRiga({ ...base, ruolo: "professional", archiviata: true }).sinistra).toBeNull();
  });
});

describe("il pallino per ruolo (16/10)", () => {
  const conv = [
    { nonLetti: 0, daLeggere: true, archiviata: true },
    { nonLetti: 2, daLeggere: false, archiviata: false },
  ];

  it("il cliente conta il segno anche su un'archiviata", () => {
    expect(pallino("customer", conv)).toBe(3);
  });

  it("il pro no: le archiviate non contano", () => {
    expect(pallino("professional", conv)).toBe(2);
  });
});
