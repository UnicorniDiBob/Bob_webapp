import { TESTI } from "@/components/termini/testi";
import {
  trovaPubblicata,
  type PubblicoTermini,
  type VersioneTermini,
} from "@/lib/termini/registro";

// IL TESTO DEI TERMINI PER L'APP (17/10, Lucio).
//
// PERCHE' ESISTE. L'app (repo Bob_app) mostrava i termini scaricando la pagina
// /termini/<versione> e togliendo a mano intestazione e menu: bastava cambiare
// il layout del sito per romperla, senza che niente qui se ne accorgesse.
// Questo modulo da' il solo testo, e lo prende dagli STESSI componenti
// congelati che rende la pagina (TESTI di components/termini): pagina e app non
// possono mostrare due testi diversi per la stessa versione, perche' il testo
// esiste una volta sola.
//
// COSA E' «PULITO». L'HTML dei componenti, senza il guscio di LegalPage, senza
// gli attributi class (sono classi Tailwind del sito: all'app non dicono
// niente) e con i link interni resi assoluti, perche' nell'app «/privacy» non
// porta da nessuna parte. Il testo non si tocca.
//
// PERCHE' L'IMPORT DI react-dom/server E' DINAMICO. Next 14 rifiuta al build
// un import statico di react-dom/server da un modulo dell'app router («render
// or return the content directly as a Server Component»): il controllo guarda
// le dichiarazioni import, non import(). Qui non c'e' un componente da
// restituire, c'e' una stringa da mettere in un JSON.
//
// E' UN CONTRATTO CON L'APP: la forma di TestoTermini e la route che la serve
// (/api/termini/[versione]) non cambiano senza cambiare anche Bob_app.

export interface TestoTermini {
  versione: VersioneTermini["versione"];
  pubblico: PubblicoTermini;
  /** ISO 8601 con fuso, come nel registro. */
  pubblicataIl: string;
  html: string;
}

export const SITO = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.meetonda.com";

export function isPubblico(valore: unknown): valore is PubblicoTermini {
  return valore === "customer" || valore === "professional";
}

/** Toglie le classi e rende assoluti i link che cominciano con «/». */
export function pulisci(html: string, sito: string = SITO): string {
  // renderToStaticMarkup scrive ogni attributo fra doppi apici e ne escapa le
  // virgolette: [^"]* non puo' uscire dal valore.
  return html
    .replace(/ class="[^"]*"/g, "")
    .replace(/ href="\/(?!\/)/g, ` href="${sito.replace(/\/$/, "")}/`);
}

/**
 * Il testo di una versione per un pubblico, solo se gia' pubblicata a
 * `adesso`. null se la versione non esiste, non e' di quel pubblico o non e'
 * ancora pubblicata: per chi chiama sono la stessa cosa, un 404.
 */
export async function testoTermini(
  pubblico: PubblicoTermini,
  versione: string,
  adesso: Date = new Date(),
  sito: string = SITO
): Promise<TestoTermini | null> {
  const v = trovaPubblicata(pubblico, versione, adesso);
  if (!v) return null;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const Testo = TESTI[v.versione];
  return {
    versione: v.versione,
    pubblico: v.pubblico,
    pubblicataIl: v.pubblicataIl,
    html: pulisci(renderToStaticMarkup(<Testo audience={pubblico} />), sito),
  };
}
