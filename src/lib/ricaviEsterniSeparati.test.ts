// I RICAVI ESTERNI RESTANO DEL PROFESSIONISTA (spec §4.4, mig 111).
//
// Quello che un pro scrive a mano sul lavoro fatto fuori da Bob non deve
// finire nelle analisi dello staff, nel punteggio, nei segnali o in un
// confronto fra professionisti: e' un dato di qualita' diversa, raccolto per
// uno scopo diverso, e nessuna policy lo fa leggere allo staff. La RLS lo
// impedisce nel database; questo test impedisce che il codice ci provi.
//
// Se fallisce perche' un file nuovo nomina la tabella, la domanda da farsi
// non e' «come lo aggiungo all'elenco» ma «questo file serve al pro per i
// SUOI numeri?». Se si', si aggiunge qui con una riga che dice perche'.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RADICE = join(__dirname, "..", "..");

const AMMESSI = new Set([
  // la tabella, le policy e la condensazione
  "supabase/migrations/111_ricavi_esterni.sql",
  // «cancella tutto» del pro, passata a SECURITY INVOKER
  "supabase/migrations/112_analisi_permessi.sql",
  // la pagina del pro e il suo componente
  "src/app/numeri/esterni/page.tsx",
  "src/components/analisi/RicaviEsterni.tsx",
  // questo test
  "src/lib/ricaviEsterniSeparati.test.ts",
]);

function file(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (nome === "node_modules" || nome.startsWith(".")) return [];
    return statSync(p).isDirectory() ? file(p) : [p];
  });
}

describe("ricavi_esterni resta separata", () => {
  it("compare solo nei file del professionista", () => {
    const trovati = [...file(join(RADICE, "src")), ...file(join(RADICE, "supabase", "migrations"))]
      .filter((p) => /\.(ts|tsx|sql)$/.test(p))
      .filter((p) => readFileSync(p, "utf8").includes("ricavi_esterni"))
      .map((p) => relative(RADICE, p));
    const abusivi = trovati.filter((p) => !AMMESSI.has(p));
    expect(abusivi).toEqual([]);
  });

  it("le analisi dello staff non la nominano", () => {
    const staff = file(join(RADICE, "src", "app", "admin"));
    for (const p of staff) {
      expect(readFileSync(p, "utf8"), p).not.toMatch(/ricavi_esterni|ricaviEsterni|origine.*esterno/);
    }
  });
});
