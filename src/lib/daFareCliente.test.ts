import { describe, expect, it } from "vitest";
import {
  RIGHE_VISIBILI,
  divisiDaFare,
  giornoVicino,
  nonFinito,
  ordinaDaFare,
  propostaDaRispondere,
  quandoBreve,
  riepilogoCliente,
  vociDaFare,
  type AppuntamentoDaFare,
  type RichiestaDaFare,
} from "./daFareCliente";

// Venerdi' 9 ottobre 2026, 12:00 a Roma.
const adesso = new Date("2026-10-09T10:00:00.000Z");
const ora = adesso.getTime();

const pro = (id: string) => ({ id, name: `Pro ${id}` });

function richiesta(
  id: string,
  extra: Partial<RichiestaDaFare> = {}
): RichiestaDaFare {
  return {
    id,
    status: "matched",
    closed_reason: null,
    created_at: "2026-10-08T10:00:00.000Z",
    pros: [pro("p1")],
    ...extra,
  };
}

function appuntamento(
  id: string,
  extra: Partial<AppuntamentoDaFare> = {}
): AppuntamentoDaFare {
  return {
    id,
    status: "proposed",
    proposed_by: "professional",
    starts_at: "2026-10-12T08:00:00.000Z",
    duration_minutes: 60,
    ...extra,
  };
}

const vuoto = {
  appuntamenti: [] as AppuntamentoDaFare[],
  aperte: [] as RichiestaDaFare[],
  chiuse: [] as RichiestaDaFare[],
  nonLettiPerCoppia: new Map<string, number>(),
  nonLettiPerRichiesta: new Map<string, number>(),
  recensite: new Set<string>(),
};

describe("da fare ora del cliente", () => {
  it("ordine fisso: proposta, risposta, chiusura, recensioni", () => {
    const voci = vociDaFare(
      {
        ...vuoto,
        appuntamenti: [appuntamento("a1")],
        aperte: [
          richiesta("aperta"),
          richiesta("ferma", { created_at: "2026-09-20T10:00:00.000Z" }),
        ],
        chiuse: [richiesta("chiusa", { status: "closed" })],
        nonLettiPerCoppia: new Map([["aperta:p1", 2]]),
        nonLettiPerRichiesta: new Map([["aperta", 2]]),
      },
      ora
    );
    expect(voci.map((v) => v.tipo)).toEqual([
      "proposta",
      "risposta",
      "chiusura",
      "recensioni",
    ]);
  });

  it("l'ordinamento e' stabile dentro ogni gruppo", () => {
    const voci = [
      { tipo: "recensioni" as const, n: 1 },
      { tipo: "risposta" as const, n: 2 },
      { tipo: "proposta" as const, n: 3 },
      { tipo: "risposta" as const, n: 4 },
      { tipo: "proposta" as const, n: 5 },
    ];
    expect(ordinaDaFare(voci).map((v) => v.n)).toEqual([3, 5, 2, 4, 1]);
  });

  it("proposte e risposte non si nascondono mai, anche oltre quattro", () => {
    const voci = ordinaDaFare([
      ...Array.from({ length: 3 }, () => ({ tipo: "proposta" as const })),
      ...Array.from({ length: 3 }, () => ({ tipo: "risposta" as const })),
      { tipo: "chiusura" as const },
      { tipo: "recensioni" as const },
    ]);
    const { visibili, nascoste } = divisiDaFare(voci);
    expect(visibili).toHaveLength(6);
    expect(visibili.every((v) => v.tipo === "proposta" || v.tipo === "risposta")).toBe(true);
    expect(nascoste.map((v) => v.tipo)).toEqual(["chiusura", "recensioni"]);
  });

  it("chiusure e recensioni riempiono fino a quattro righe, il resto e' «+N altri»", () => {
    const voci = ordinaDaFare([
      { tipo: "risposta" as const },
      { tipo: "chiusura" as const },
      { tipo: "chiusura" as const },
      { tipo: "chiusura" as const },
      { tipo: "chiusura" as const },
      { tipo: "recensioni" as const },
    ]);
    const { visibili, nascoste } = divisiDaFare(voci);
    expect(visibili).toHaveLength(RIGHE_VISIBILI);
    expect(nascoste).toHaveLength(2);
    expect(divisiDaFare(voci.slice(0, 3)).nascoste).toHaveLength(0);
  });

  it("le recensioni mancanti sono una voce sola, la piu' recente per prima", () => {
    const voci = vociDaFare(
      {
        ...vuoto,
        chiuse: [
          richiesta("vecchia", { status: "closed", created_at: "2026-08-01T10:00:00.000Z" }),
          richiesta("nuova", { status: "closed", created_at: "2026-10-01T10:00:00.000Z" }),
          richiesta("media", { status: "closed", created_at: "2026-09-01T10:00:00.000Z" }),
        ],
      },
      ora
    );
    expect(voci).toHaveLength(1);
    const [v] = voci;
    expect(v.tipo).toBe("recensioni");
    if (v.tipo !== "recensioni") return;
    expect(v.richieste.map((r) => r.id)).toEqual(["nuova", "media", "vecchia"]);
  });

  it("niente recensione per le disdette o i lavori gia' recensiti", () => {
    const voci = vociDaFare(
      {
        ...vuoto,
        chiuse: [
          richiesta("disdetta", { status: "closed", closed_reason: "disdetto" }),
          richiesta("fatta", { status: "closed" }),
        ],
        recensite: new Set(["fatta:p1"]),
      },
      ora
    );
    expect(voci).toHaveLength(0);
  });

  it("una proposta il cui orario e' passato non e' piu' da fare", () => {
    const passata = appuntamento("a1", { starts_at: "2026-10-09T09:00:00.000Z" });
    expect(propostaDaRispondere(passata, ora)).toBe(false);
    expect(vociDaFare({ ...vuoto, appuntamenti: [passata] }, ora)).toHaveLength(0);
  });

  it("una proposta del cliente non e' una cosa da fare", () => {
    const sua = appuntamento("a1", { proposed_by: "customer" });
    expect(propostaDaRispondere(sua, ora)).toBe(false);
    expect(vociDaFare({ ...vuoto, appuntamenti: [sua] }, ora)).toHaveLength(0);
  });

  it("un appuntamento gia' confermato non e' una proposta", () => {
    expect(propostaDaRispondere(appuntamento("a1", { status: "confirmed" }), ora)).toBe(false);
  });

  it("«e' andato tutto bene?» solo dopo dieci giorni e senza non letti", () => {
    const ferma = richiesta("ferma", { created_at: "2026-09-20T10:00:00.000Z" });
    expect(vociDaFare({ ...vuoto, aperte: [ferma] }, ora).map((v) => v.tipo)).toEqual([
      "chiusura",
    ]);
    expect(
      vociDaFare(
        { ...vuoto, aperte: [ferma], nonLettiPerRichiesta: new Map([["ferma", 1]]) },
        ora
      ).filter((v) => v.tipo === "chiusura")
    ).toHaveLength(0);
    expect(vociDaFare({ ...vuoto, aperte: [richiesta("giovane")] }, ora)).toHaveLength(0);
  });
});

describe("date vicine", () => {
  it("finito quando inizio piu' durata e' passato, un'ora se manca", () => {
    expect(nonFinito({ starts_at: "2026-10-09T09:30:00.000Z", duration_minutes: 60 }, ora)).toBe(true);
    expect(nonFinito({ starts_at: "2026-10-09T08:30:00.000Z", duration_minutes: null }, ora)).toBe(false);
  });

  it("oggi e domani sono giorni di calendario a Roma", () => {
    const tardi = new Date("2026-10-09T21:30:00.000Z"); // 23:30 a Roma
    expect(giornoVicino("2026-10-09T06:00:00.000Z", tardi)).toBe("oggi");
    expect(giornoVicino("2026-10-09T22:30:00.000Z", tardi)).toBe("domani");
    expect(giornoVicino("2026-10-10T22:00:00.000Z", tardi)).toBeNull();
  });

  it("«oggi alle 19:00», «mar 13 alle 09:00»", () => {
    expect(quandoBreve("2026-10-09T17:00:00.000Z", adesso)).toBe("oggi alle 19:00");
    expect(quandoBreve("2026-10-13T07:00:00.000Z", adesso)).toBe("mar 13 alle 09:00");
  });
});

describe("il sottotitolo del cliente", () => {
  const confermato = appuntamento("c", {
    status: "confirmed",
    starts_at: "2026-10-10T08:00:00.000Z",
  });

  it("conto e prossimo appuntamento, uniti", () => {
    expect(riepilogoCliente(4, [confermato], adesso)).toBe(
      "4 cose da fare · prossimo appuntamento domani alle 10:00"
    );
    expect(riepilogoCliente(1, [], adesso)).toBe("1 cosa da fare");
  });

  it("solo l'appuntamento, con la maiuscola", () => {
    expect(riepilogoCliente(0, [confermato], adesso)).toBe(
      "Prossimo appuntamento domani alle 10:00"
    );
  });

  it("niente da fare e niente in programma", () => {
    expect(riepilogoCliente(0, [], adesso)).toBe("Nessuna novità: tutto in ordine.");
  });

  it("conta i confermati e le proposte del pro, non quelle del cliente ne' i finiti", () => {
    const delCliente = appuntamento("x", {
      proposed_by: "customer",
      starts_at: "2026-10-09T15:00:00.000Z",
    });
    const finito = appuntamento("f", {
      status: "confirmed",
      starts_at: "2026-10-09T07:00:00.000Z",
    });
    const delPro = appuntamento("p", { starts_at: "2026-10-12T07:00:00.000Z" });
    expect(riepilogoCliente(0, [delCliente, finito, delPro, confermato], adesso)).toBe(
      "Prossimo appuntamento domani alle 10:00"
    );
    expect(riepilogoCliente(0, [delCliente, finito, delPro], adesso)).toBe(
      "Prossimo appuntamento lun 12 alle 09:00"
    );
  });
});
