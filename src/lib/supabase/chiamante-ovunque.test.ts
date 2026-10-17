// OGNI ROUTE CHE DEVE SAPERE CHI CHIAMA PASSA DA chiamante() (17/10).
//
// Il 16/10 chiamante() ha imparato il Bearer (PR #181), ma 13 route
// ricavavano ancora l'utente con createClient() di ./server.ts: dai cookie
// soltanto. Dal sito andavano; dall'app, che manda un Bearer e nessun cookie,
// avrebbero risposto 401 — e niente l'avrebbe segnalato, perche' il sito
// non se ne accorge. Questo test e' la rete: scorre src/app/api/**/route.ts e
// fallisce se una route importa createClient da @/lib/supabase/server.
//
// Fuori: admin/**, cron/** e sessioni/**. Admin e cron non servono l'app;
// sessioni/** gestisce proprio i cookie del sito (account attivo e in attesa).
//
// Un livello sotto: anche un modulo di @/lib/ importato da una route conta,
// se prende createClient da ./server.ts E chiede getUser() — era il caso di
// sceltaServer.ts per scegli/riapri/archivia. data.ts e search.ts leggono il
// catalogo con quel client senza chiedere chi c'e', e restano fuori.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RADICE = path.resolve(__dirname, "../..");
const API = path.join(RADICE, "app/api");
const FUORI = ["admin", "cron", "sessioni"];

function route(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return route(p);
    return e.name === "route.ts" ? [p] : [];
  });
}

// `import { createClient } from "@/lib/supabase/server"`, con o senza alias,
// e l'import dinamico.
const DAL_SERVER = /(?:from\s*|import\s*\(\s*)["'](?:@\/lib\/supabase\/server|(?:\.\.?\/)+(?:lib\/)?supabase\/server)["']/;
const MODULI_LIB = /from\s*["']@\/lib\/([^"']+)["']/g;

function moduloLib(nome: string): string | null {
  for (const est of [".ts", ".tsx", "/index.ts"]) {
    const p = path.join(RADICE, "lib", nome + est);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const tutte = route(API).sort();
const dentro = tutte.filter((f) => !FUORI.includes(path.relative(API, f).split(path.sep)[0]));
const rel = (f: string) => path.relative(RADICE, f);

describe("chiamante() ovunque: nessuna route ricava l'utente dai soli cookie", () => {
  it("il test vede davvero le route (una rete vuota non prova niente)", () => {
    expect(dentro.length).toBeGreaterThan(20);
    expect(dentro.map(rel)).toContain("app/api/account/esporta/route.ts");
    expect(tutte.some((f) => rel(f).startsWith("app/api/admin/"))).toBe(true);
  });

  it("la regola riconosce un import da ./server.ts (la rete puo' fallire)", () => {
    expect(DAL_SERVER.test('import { createClient } from "@/lib/supabase/server";')).toBe(true);
    expect(DAL_SERVER.test('import { createClient as createServerClient } from "@/lib/supabase/server";')).toBe(true);
    expect(DAL_SERVER.test('const { createClient } = await import("@/lib/supabase/server");')).toBe(true);
    expect(DAL_SERVER.test('import { chiamante } from "@/lib/supabase/chiamante";')).toBe(false);
    expect(DAL_SERVER.test('import { createClient } from "@supabase/supabase-js";')).toBe(false);
  });

  it("nessuna route fuori da admin, cron e sessioni importa createClient da @/lib/supabase/server", () => {
    const colpevoli = dentro.filter((f) => DAL_SERVER.test(fs.readFileSync(f, "utf8"))).map(rel);
    expect(colpevoli, "usare chiamante(request) di @/lib/supabase/chiamante").toEqual([]);
  });

  it("nessun modulo di @/lib/ usato da quelle route chiede getUser() a ./server.ts", () => {
    const colpevoli = new Set<string>();
    for (const f of dentro) {
      for (const [, nome] of Array.from(fs.readFileSync(f, "utf8").matchAll(MODULI_LIB))) {
        const m = moduloLib(nome);
        if (!m || m.includes(`${path.sep}supabase${path.sep}`)) continue;
        const t = fs.readFileSync(m, "utf8");
        if (DAL_SERVER.test(t) && /\.auth\.getUser\(/.test(t)) colpevoli.add(`${rel(m)} (da ${rel(f)})`);
      }
    }
    expect([...colpevoli], "usare chiamante(request) di @/lib/supabase/chiamante").toEqual([]);
  });
});
