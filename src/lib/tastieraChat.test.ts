import { describe, expect, it } from "vitest";
import {
  CAMPO_ALTEZZA_MASSIMA,
  altezzaCampo,
  altezzaCornice,
  correzioneCornice,
  cosaFaIlTasto,
} from "./tastieraChat";

describe("la cornice con la tastiera dell'iPhone", () => {
  it("i numeri misurati sull'iPhone di André: 654px, non 554", () => {
    // rect.top −310 + scrollY 391 = la cornice comincia a 81.
    expect(altezzaCornice({ pageTop: 391, altezzaVisibile: 344, inizioCornice: -310 + 391 })).toBe(654);
  });

  it("senza tastiera e senza scorrimento: dal fondo dell'intestazione al fondo", () => {
    expect(altezzaCornice({ pageTop: 0, altezzaVisibile: 635, inizioCornice: 81 })).toBe(554);
  });

  it("mai negativa", () => {
    expect(altezzaCornice({ pageTop: 0, altezzaVisibile: 50, inizioCornice: 81 })).toBe(0);
  });

  it("la correzione e' la differenza dei fondi, sotto i 2px niente", () => {
    expect(correzioneCornice({ pageTop: 391, altezzaVisibile: 344, fondoCornice: 735 })).toBe(0);
    expect(correzioneCornice({ pageTop: 391, altezzaVisibile: 344, fondoCornice: 733.5 })).toBe(0);
    expect(correzioneCornice({ pageTop: 391, altezzaVisibile: 344, fondoCornice: 635 })).toBe(100);
    expect(correzioneCornice({ pageTop: 391, altezzaVisibile: 344, fondoCornice: 760 })).toBe(-25);
  });
});

describe("il campo che cresce", () => {
  it("una riga: 46px, non scorre", () => {
    expect(altezzaCampo(44, 2)).toEqual({ altezza: 46, scorre: false });
  });

  it("cresce fino a cinque righe", () => {
    expect(altezzaCampo(5 * 24 + 20, 2)).toEqual({ altezza: CAMPO_ALTEZZA_MASSIMA, scorre: false });
  });

  it("oltre, resta al massimo e scorre dentro", () => {
    expect(altezzaCampo(10 * 24 + 20, 2)).toEqual({ altezza: CAMPO_ALTEZZA_MASSIMA, scorre: true });
  });
});

describe("il tasto Invio", () => {
  const base = { tasto: "Enter", maiuscolo: false, componendo: false, tattile: false };

  it("con mouse e tastiera: Invio manda, Maiuscolo+Invio va a capo", () => {
    expect(cosaFaIlTasto(base)).toBe("invia");
    expect(cosaFaIlTasto({ ...base, maiuscolo: true })).toBe("a-capo");
  });

  it("sul telefono Invio va a capo: si manda col bottone", () => {
    expect(cosaFaIlTasto({ ...base, tattile: true })).toBe("a-capo");
  });

  it("durante la composizione non fa niente", () => {
    expect(cosaFaIlTasto({ ...base, componendo: true })).toBe("niente");
  });

  it("gli altri tasti non riguardano l'invio", () => {
    expect(cosaFaIlTasto({ ...base, tasto: "a" })).toBe("niente");
  });
});
