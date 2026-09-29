// La coda di lavoro della verifica: ordine, viste, righe, documenti firmati.
// Orari a mezzogiorno di Roma, come in vat.test.ts: giorniLavorativiTra() conta
// le mezzanotti nel fuso del processo, e a mezzogiorno il giorno e' lo stesso
// in UTC e a Roma. Martedi' 29 settembre 2026.

import { describe, expect, it } from "vitest";
import {
  VISTE,
  contatori,
  firmaDocumenti,
  inAttesaDelProDa,
  ordinaCoda,
  perche,
  righeDellaVista,
  testoSla,
  vistaDa,
  type DocumentoGrezzo,
  type RigaCaso,
  type Vista,
} from "./coda";

const ADESSO = new Date("2026-09-29T12:00:00+02:00");
const g = (giorno: string) => `2026-09-${giorno}T12:00:00+02:00`;

const riga = (over: Partial<RigaCaso> & { professional_id: string }): RigaCaso => ({
  level: "none",
  vat_review_state: null,
  vat_review_opened_at: null,
  recheck_reason: null,
  recheck_opened_at: null,
  vat_check_source: "vies",
  updated_at: g("01"),
  ...over,
});

// Una coda realistica, un caso per tipo.
const RIGHE: RigaCaso[] = [
  riga({ professional_id: "pending-dentro", vat_review_state: "pending", vat_review_opened_at: g("28") }),
  riga({ professional_id: "pending-sforato", vat_review_state: "pending", vat_review_opened_at: g("18") }),
  // Il buco del 29/09: ricontrollo con documento caricato, palla nostra, oltre.
  riga({
    professional_id: "ricontrollo-con-documento",
    vat_review_state: "recheck",
    recheck_reason: "scadenza",
    recheck_opened_at: g("14"),
    vat_review_opened_at: g("21"),
    level: "vat_verified",
  }),
  riga({
    professional_id: "ricontrollo-cessazione",
    vat_review_state: "recheck",
    recheck_reason: "cessazione",
    recheck_opened_at: g("25"),
    level: "vat_verified",
  }),
  riga({ professional_id: "documenti-richiesti", vat_review_state: "docs_requested", updated_at: g("22") }),
  riga({ professional_id: "respinto", vat_review_state: "rejected", updated_at: g("20") }),
  riga({ professional_id: "attivo", level: "vat_verified", updated_at: g("10") }),
];
const ids = (xs: RigaCaso[]) => xs.map((r) => r.professional_id);

describe("vistaDa: un link incollato si riapre uguale", () => {
  it("senza parametro, la vista e' «Aperti»", () => {
    expect(vistaDa(undefined)).toBe("aperti");
  });
  it("ogni vista dichiarata si riconosce", () => {
    for (const v of VISTE) expect(vistaDa(v.id)).toBe(v.id);
  });
  it("un valore sconosciuto torna ad «Aperti», non a una pagina vuota", () => {
    expect(vistaDa("pippo")).toBe("aperti");
    expect(vistaDa(["respinti", "attivi"])).toBe("respinti");
  });
});

describe("ordinaCoda: dal piu' urgente, con le regole di vat.ts", () => {
  it("prima gli sforati dal piu' vecchio, poi la palla nostra, poi quella del pro", () => {
    expect(ids(ordinaCoda(RIGHE, ADESSO))).toEqual([
      "pending-sforato",
      "ricontrollo-con-documento",
      "pending-dentro",
      "ricontrollo-cessazione",
      "documenti-richiesti",
    ]);
  });
  it("respinti e livelli attivi non sono lavoro: fuori dalla coda", () => {
    const coda = ids(ordinaCoda(RIGHE, ADESSO));
    expect(coda).not.toContain("respinto");
    expect(coda).not.toContain("attivo");
  });
});

describe("righeDellaVista: le viste sono filtri della stessa coda", () => {
  const vista = (v: Vista) => ids(righeDellaVista(RIGHE, v, ADESSO));
  it("Palla nostra include il ricontrollo con documento", () => {
    expect(vista("nostra")).toEqual(["pending-sforato", "ricontrollo-con-documento", "pending-dentro"]);
  });
  it("In attesa del pro", () => {
    expect(vista("pro")).toEqual(["ricontrollo-cessazione", "documenti-richiesti"]);
  });
  it("Ricontrolli, di chiunque sia la palla, nell'ordine della coda", () => {
    expect(vista("ricontrolli")).toEqual(["ricontrollo-con-documento", "ricontrollo-cessazione"]);
  });
  it("Respinti e Livelli attivi", () => {
    expect(vista("respinti")).toEqual(["respinto"]);
    expect(vista("attivi")).toEqual(["attivo"]);
  });
  it("ogni vista filtrata e' un sottoinsieme ordinato di «Aperti» (tranne le due d'archivio)", () => {
    const aperti = vista("aperti");
    for (const v of ["nostra", "pro", "ricontrolli"] as Vista[]) {
      const x = vista(v);
      expect(x).toEqual(aperti.filter((id) => x.includes(id)));
    }
  });
});

describe("contatori", () => {
  it("da fare, oltre l'SLA, in attesa del pro", () => {
    expect(contatori(RIGHE, ADESSO)).toEqual({ daFare: 3, oltreSla: 2, inAttesaDelPro: 2 });
  });
});

describe("la riga dice da sola perche' e da quanto", () => {
  it("una prima richiesta dice cosa ha risposto il VIES", () => {
    expect(perche(riga({ professional_id: "x", vat_review_state: "pending", vat_check_source: null }))).toBe(
      "Prima richiesta · il VIES non ha risposto"
    );
    expect(perche(riga({ professional_id: "x", vat_review_state: "pending" }))).toBe(
      "Prima richiesta · il VIES non ha confermato"
    );
  });
  it("dopo un documento caricato lo dice", () => {
    expect(
      perche(riga({ professional_id: "x", vat_review_state: "pending" }), [
        { event: "vat_submitted", created_at: g("10") },
        { event: "documents_requested", created_at: g("11") },
        { event: "documents_submitted", created_at: g("20") },
      ])
    ).toBe("Documenti caricati, da esaminare");
  });
  it("un ricontrollo dice il motivo, e se c'e' un documento", () => {
    const [conDoc] = RIGHE.filter((r) => r.professional_id === "ricontrollo-con-documento");
    const [cessazione] = RIGHE.filter((r) => r.professional_id === "ricontrollo-cessazione");
    expect(perche(conDoc)).toBe("Ricontrollo · Scadenza annuale · documento caricato");
    expect(perche(cessazione)).toBe("Ricontrollo · P.IVA non piu' attiva");
  });
  it("palla nostra: la pillola di statoCoda; palla sua: da quanto aspetta lui", () => {
    const [sforato] = RIGHE.filter((r) => r.professional_id === "pending-sforato");
    expect(testoSla(sforato, ADESSO)).toMatchObject({ testo: "SLA sforata di 2 giorni", inCoda: 7, sforata: true });
    expect(inAttesaDelProDa(sforato, [], ADESSO)).toBeNull();
    const [cessazione] = RIGHE.filter((r) => r.professional_id === "ricontrollo-cessazione");
    expect(inAttesaDelProDa(cessazione, [], ADESSO)).toBe("In attesa del professionista da 2 giorni lavorativi");
    const [documenti] = RIGHE.filter((r) => r.professional_id === "documenti-richiesti");
    expect(
      inAttesaDelProDa(documenti, [{ event: "documents_requested", created_at: g("28") }], ADESSO)
    ).toBe("In attesa del professionista da 1 giorno lavorativo");
  });
});

describe("i documenti si firmano solo per chi si mostra, e il link c'e' da ogni vista", () => {
  // Ogni caso ha un documento: se una vista mostra un caso, il suo link DEVE
  // esserci; se non lo mostra, il documento NON deve essere firmato.
  const TUTTI: DocumentoGrezzo[] = RIGHE.map((r) => ({
    professional_id: r.professional_id,
    file_name: `${r.professional_id}.pdf`,
    storage_path: `${r.professional_id}/doc.pdf`,
    status: "in_esame",
    uploaded_at: g("20"),
  }));

  // Lo stesso percorso della pagina: righe della vista -> id -> documenti di
  // quegli id -> firma.
  async function comeLaPagina(v: Vista) {
    const mostrate = righeDellaVista(RIGHE, v, ADESSO);
    const idMostrati = new Set(mostrate.map((r) => r.professional_id));
    const firmati: string[] = [];
    const docs = await firmaDocumenti(
      TUTTI.filter((d) => idMostrati.has(d.professional_id)),
      async (percorso) => {
        firmati.push(percorso);
        return `https://firmato.example/${percorso}`;
      }
    );
    return { mostrate, docs, firmati };
  }

  for (const v of VISTE.map((x) => x.id)) {
    it(`vista «${v}»: ogni caso mostrato ha il link al suo documento`, async () => {
      const { mostrate, docs } = await comeLaPagina(v);
      expect(mostrate.length).toBeGreaterThan(0);
      for (const r of mostrate) {
        const d = docs.get(r.professional_id);
        expect(d, r.professional_id).toHaveLength(1);
        expect(d?.[0].url).toBe(`https://firmato.example/${r.professional_id}/doc.pdf`);
        expect(d?.[0].firmaFallita).toBe(false);
      }
    });
    it(`vista «${v}»: nessun documento firmato per chi non si mostra`, async () => {
      const { mostrate, firmati } = await comeLaPagina(v);
      const attesi = mostrate.map((r) => `${r.professional_id}/doc.pdf`).sort();
      expect([...firmati].sort()).toEqual(attesi);
    });
  }

  it("una firma che fallisce non sparisce: il documento resta, segnato", async () => {
    const docs = await firmaDocumenti(TUTTI.slice(0, 2), async (p) => {
      if (p.startsWith("pending-dentro")) throw new Error("storage giu'");
      return null;
    });
    expect(docs.get("pending-dentro")?.[0]).toMatchObject({ url: null, firmaFallita: true });
    expect(docs.get("pending-sforato")?.[0]).toMatchObject({ url: null, firmaFallita: true });
  });
});
