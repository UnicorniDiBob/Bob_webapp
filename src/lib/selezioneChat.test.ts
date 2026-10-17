import { describe, expect, it } from "vitest";
import {
  cambiaSelezione,
  elencoNomi,
  etichettaScrivi,
  richiestaAncoraAperta,
  selezionePiena,
  statoScheda,
} from "./selezioneChat";
import { MAX_PRO_PER_RICHIESTA } from "./collegamento";

const s = (...ids: string[]) => new Set(ids);

describe("la scelta dei pro nella chat di Bob (17/10)", () => {
  it("il tetto e' quello della 125", () => {
    expect(MAX_PRO_PER_RICHIESTA).toBe(3);
  });

  it("si spunta fino a 3, il quarto non entra", () => {
    let sel = s();
    for (const id of ["a", "b", "c", "d"]) sel = cambiaSelezione(id, sel, s());
    expect([...sel]).toEqual(["a", "b", "c"]);
    expect(selezionePiena(sel, s())).toBe(true);
    expect(statoScheda("d", sel, s())).toBe("bloccato");
  });

  it("togliere una spunta libera il posto", () => {
    const sel = cambiaSelezione("b", s("a", "b", "c"), s());
    expect([...sel]).toEqual(["a", "c"]);
    expect(statoScheda("d", sel, s())).toBe("libero");
  });

  it("i pro gia' contattati contano nel tetto e non si spuntano", () => {
    const contattati = s("a", "b");
    expect(statoScheda("a", s(), contattati)).toBe("contattato");
    let sel = cambiaSelezione("a", s(), contattati);
    expect(sel.size).toBe(0);
    sel = cambiaSelezione("c", sel, contattati);
    expect([...sel]).toEqual(["c"]);
    expect(selezionePiena(sel, contattati)).toBe(true);
    expect(statoScheda("d", sel, contattati)).toBe("bloccato");
    expect([...cambiaSelezione("d", sel, contattati)]).toEqual(["c"]);
  });

  it("con 3 gia' contattati non si spunta piu' niente", () => {
    const contattati = s("a", "b", "c");
    expect(statoScheda("d", s(), contattati)).toBe("bloccato");
    expect(cambiaSelezione("d", s(), contattati).size).toBe(0);
  });

  it("l'etichetta del bottone: singolare e plurale", () => {
    expect(etichettaScrivi(1)).toBe("Scrivi a 1 professionista");
    expect(etichettaScrivi(2)).toBe("Scrivi a 2 professionisti");
    expect(etichettaScrivi(3)).toBe("Scrivi a 3 professionisti");
  });

  it("i nomi nel titolo del messaggio", () => {
    expect(elencoNomi(["Rossi"])).toBe("Rossi");
    expect(elencoNomi(["Rossi", "Bianchi"])).toBe("Rossi e Bianchi");
    expect(elencoNomi(["Rossi", "Bianchi", "Verdi"])).toBe("Rossi, Bianchi e Verdi");
  });

  it("si aggiunge solo a una richiesta ancora aperta; chiusa, se ne apre una nuova", () => {
    for (const st of ["sent", "quote_request", "matched"]) expect(richiestaAncoraAperta(st)).toBe(true);
    for (const st of ["closed", "draft", null, undefined]) expect(richiestaAncoraAperta(st)).toBe(false);
  });
});
