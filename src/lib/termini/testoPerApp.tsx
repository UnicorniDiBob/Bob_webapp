import { TESTI } from "@/components/termini/testi";
import {
  trovaPubblicata,
  ultimaPubblicata,
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
// E' UN CONTRATTO CON L'APP: la forma di TestoTermini e VersioneCorrente e le
// route che le servono (/api/termini/[versione], /api/termini/corrente) non
// cambiano senza cambiare anche Bob_app.

export interface TestoTermini {
  versione: VersioneTermini["versione"];
  pubblico: PubblicoTermini;
  /** ISO 8601 con fuso, come nel registro. */
  pubblicataIl: string;
  html: string;
}

/** Cache delle due route: il ritardo massimo di una pubblicazione nell'app. */
export const CACHE_OK = "public, max-age=300, s-maxage=300";
export const CACHE_ERRORE = "public, max-age=60, s-maxage=60";

export interface VersioneCorrente {
  versione: VersioneTermini["versione"];
  pubblico: PubblicoTermini;
  /** ISO 8601 con fuso, come nel registro. */
  pubblicataIl: string;
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

/**
 * La versione pubblicata a `adesso` per un pubblico: la stessa che mostra
 * /termini[/professionisti] e che accetta chi si iscrive dal sito
 * (ultimaPubblicata). null se non ce n'e' nessuna, invece di lanciare.
 */
export function versioneCorrente(
  pubblico: PubblicoTermini,
  adesso: Date = new Date()
): VersioneCorrente | null {
  let v: VersioneTermini;
  try {
    v = ultimaPubblicata(pubblico, adesso);
  } catch {
    return null;
  }
  return { versione: v.versione, pubblico: v.pubblico, pubblicataIl: v.pubblicataIl };
}
