// GUARDIA CONTRO L'OPEN REDIRECT DEL 30/09 (roadmap/findings.csv).
//
// ritorno.test.ts prova che ritornoInterno() si comporta bene. Questo file
// prova una cosa diversa: che il resto del codice la usi davvero, e che il
// vecchio controllo debole (startsWith("//")) non ritorni da nessun'altra
// parte. Scansiona i file sorgente con fs, non importa nessun componente.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");
const RITORNO_TS = join("lib", "ritorno.ts");

function elencaFileSorgente(dir: string): string[] {
  const risultato: string[] = [];
  for (const voce of readdirSync(dir)) {
    const percorso = join(dir, voce);
    const info = statSync(percorso);
    if (info.isDirectory()) {
      risultato.push(...elencaFileSorgente(percorso));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(voce)) continue;
    if (/\.test\.tsx?$/.test(voce)) continue;
    risultato.push(percorso);
  }
  return risultato;
}

const file = elencaFileSorgente(SRC);

describe("guardia open redirect", () => {
  it("chi legge returnTo dall'URL passa da ritornoInterno()", () => {
    const colpevoli: string[] = [];
    for (const f of file) {
      const testo = readFileSync(f, "utf8");
      const leggeReturnTo = /\.get\(\s*["']returnTo["']\s*\)/.test(testo);
      const usaRitornoInterno = /ritornoInterno/.test(testo);
      if (leggeReturnTo && !usaRitornoInterno) {
        colpevoli.push(relative(SRC, f).split(sep).join("/"));
      }
    }
    expect(
      colpevoli,
      `legge returnTo senza ritornoInterno(): ${colpevoli.join(", ")}`
    ).toEqual([]);
  });

  it('nessuno fuori da ritorno.ts usa il controllo debole startsWith("//")', () => {
    const colpevoli: string[] = [];
    for (const f of file) {
      if (relative(SRC, f) === RITORNO_TS) continue;
      const testo = readFileSync(f, "utf8");
      if (/startsWith\(\s*["']\/\/["']\s*\)/.test(testo)) {
        colpevoli.push(relative(SRC, f).split(sep).join("/"));
      }
    }
    expect(
      colpevoli,
      `usa ancora il controllo debole startsWith("//"): ${colpevoli.join(", ")}`
    ).toEqual([]);
  });
});
