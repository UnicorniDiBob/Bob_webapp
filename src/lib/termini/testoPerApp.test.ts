import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/termini/[versione]/route";
import { GET as GET_CORRENTE } from "@/app/api/termini/corrente/route";
import { ultimaPubblicata } from "./registro";
import { pulisci, testoTermini, versioneCorrente } from "./testoPerApp";

const OGGI = new Date("2026-10-17T12:00:00+02:00");
// Prima della v2 (20/09 18:28) e dopo la v1 (30/07).
const AGOSTO = new Date("2026-08-15T12:00:00+02:00");

describe("testoTermini", () => {
  it("da' versione, pubblico, data e il testo di una versione pubblicata", async () => {
    const t = await testoTermini("professional", "2026-09-v2", OGGI, "https://www.meetonda.com");
    expect(t).not.toBeNull();
    expect(t!.versione).toBe("2026-09-v2");
    expect(t!.pubblico).toBe("professional");
    expect(t!.pubblicataIl).toBe("2026-09-20T18:28:00+02:00");
    expect(t!.html).toContain("1. Cosa è BOB");
    expect(t!.html).toContain("Verifica del profilo");
  });

  it("e' il testo della versione chiesta, non dell'ultima", async () => {
    const v1 = (await testoTermini("professional", "2026-07-v1", OGGI))!;
    const v2 = (await testoTermini("professional", "2026-09-v2", OGGI))!;
    expect(v1.html).not.toBe(v2.html);
    expect(v1.html).not.toContain("Verifica del profilo: livelli");
  });

  it("cambia col pubblico", async () => {
    const cliente = (await testoTermini("customer", "2026-09-v2", OGGI))!;
    const pro = (await testoTermini("professional", "2026-09-v2", OGGI))!;
    expect(cliente.html).not.toBe(pro.html);
    expect(cliente.html).not.toContain("volume minimo di richieste");
    expect(pro.html).toContain("volume minimo di richieste");
  });

  it("e' HTML pulito: niente layout del sito, niente classi, link assoluti", async () => {
    const { html } = (await testoTermini("customer", "2026-09-v2", OGGI, "https://www.meetonda.com"))!;
    expect(html.startsWith("<section>")).toBe(true);
    expect(html).not.toMatch(/<(h1|header|nav|footer|main|html|body)\b/);
    expect(html).not.toContain("class=");
    expect(html).toContain('href="https://www.meetonda.com/privacy"');
    expect(html).not.toMatch(/href="\/[^/]/);
    expect(html).toContain('href="mailto:');
  });

  it("null per una versione inesistente", async () => {
    expect(await testoTermini("customer", "2099-01-v9", OGGI)).toBeNull();
    expect(await testoTermini("customer", "", OGGI)).toBeNull();
  });

  it("null per una versione non ancora pubblicata", async () => {
    expect(await testoTermini("customer", "2026-09-v2", AGOSTO)).toBeNull();
    expect(await testoTermini("customer", "2026-07-v1", AGOSTO)).not.toBeNull();
  });
});

describe("pulisci", () => {
  it("non tocca i link assoluti, i mailto e quelli che cominciano con //", () => {
    const html = '<a href="https://x.it/a">a</a><a href="mailto:a@b.it">b</a><a href="//x.it">c</a>';
    expect(pulisci(html, "https://www.meetonda.com")).toBe(html);
  });

  it("toglie le classi e rende assoluti i link interni", () => {
    expect(pulisci('<a class="a b" href="/privacy">p</a>', "https://s.it/")).toBe(
      '<a href="https://s.it/privacy">p</a>'
    );
  });
});

describe("GET /api/termini/[versione]", () => {
  function chiama(versione: string, query: string) {
    return GET(new Request(`http://localhost/api/termini/${versione}${query}`), {
      params: { versione },
    });
  }

  it("200 con il testo e una cache breve", async () => {
    const r = await chiama("2026-09-v2", "?pubblico=customer");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300");
    const body = await r.json();
    expect(Object.keys(body).sort()).toEqual(["html", "pubblicataIl", "pubblico", "versione"]);
    expect(body.versione).toBe("2026-09-v2");
    expect(body.pubblico).toBe("customer");
  });

  it("404 per una versione inesistente", async () => {
    expect((await chiama("2099-01-v9", "?pubblico=customer")).status).toBe(404);
  });

  it("400 per un pubblico sbagliato o mancante", async () => {
    expect((await chiama("2026-09-v2", "?pubblico=admin")).status).toBe(400);
    expect((await chiama("2026-09-v2", "?pubblico=")).status).toBe(400);
    expect((await chiama("2026-09-v2", "")).status).toBe(400);
  });
});

describe("versioneCorrente", () => {
  it("e' l'ultima pubblicata, la stessa del sito", () => {
    for (const p of ["customer", "professional"] as const) {
      const c = versioneCorrente(p, OGGI)!;
      const u = ultimaPubblicata(p, OGGI);
      expect(c).toEqual({ versione: u.versione, pubblico: p, pubblicataIl: u.pubblicataIl });
    }
    expect(versioneCorrente("customer", OGGI)!.versione).toBe("2026-09-v2");
  });

  it("segue la data: ad agosto era la v1", () => {
    expect(versioneCorrente("professional", AGOSTO)!.versione).toBe("2026-07-v1");
  });

  it("null prima di qualunque pubblicazione, invece di lanciare", () => {
    expect(versioneCorrente("customer", new Date("2026-01-01T00:00:00+01:00"))).toBeNull();
  });
});

describe("GET /api/termini/corrente", () => {
  const chiama = (query: string) =>
    GET_CORRENTE(new Request(`http://localhost/api/termini/corrente${query}`));

  it("200 con versione, pubblico e data, e la stessa cache", async () => {
    const r = chiama("?pubblico=professional");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300");
    const body = await r.json();
    expect(Object.keys(body).sort()).toEqual(["pubblicataIl", "pubblico", "versione"]);
    expect(body.versione).toBe(ultimaPubblicata("professional").versione);
    expect(body.pubblico).toBe("professional");
  });

  it("400 per un pubblico sbagliato o mancante", () => {
    expect(chiama("?pubblico=admin").status).toBe(400);
    expect(chiama("?pubblico=").status).toBe(400);
    expect(chiama("").status).toBe(400);
  });
});
