// IL FERMO PER MANUTENZIONE — in un posto solo.
//
// La 071 ha dato allo staff il modo di DIRE una cosa a tutti; questo file da'
// il modo di CHIUDERE la porta davvero. Sono due cose diverse e servono
// insieme: un avviso senza fermo lascia entrare chi non l'ha letto, un fermo
// senza avviso e' un guasto agli occhi di chi lo trova.
//
// PERCHE' STA QUI E NON DENTRO IL MIDDLEWARE. Tre posti diversi devono dare la
// stessa risposta alla stessa domanda — il middleware che chiude, la fascia di
// preavviso che avvisa, il pannello admin che programma — e la domanda «c'e'
// un fermo adesso?» ha una risposta sola. Le funzioni pure qui sotto si
// provano senza database e senza browser.
//
// COSA GIRA SUL BORDO. `leggiFermoInCorso` e `paginaFermo` vengono chiamate
// dal middleware, che gira sull'edge runtime di Vercel: niente Node, niente
// import pesanti, nessuna dipendenza oltre a fetch. Per la stessa ragione la
// pagina di cortesia e' una stringa HTML con lo stile dentro, e non una pagina
// di Next: quando il sito e' fermo, la cosa che risponde deve dipendere dal
// minor numero possibile di pezzi funzionanti.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Manutenzione {
  id: string;
  motivo: string;
  dettaglio: string | null;
  inizio_il: string;
  fine_il: string;
}

/**
 * Le porte che restano aperte anche a sito fermo.
 *
 * `/login` e `/auth` ci sono per una ragione pratica: se il fermo prende anche
 * chi deve toglierlo, l'admin che non ha la sessione aperta resta fuori
 * insieme a tutti gli altri e non ha piu' nessun modo di riaprire dal
 * prodotto. `/manutenzione` e' la pagina di cortesia stessa.
 */
export const PERCORSI_APERTI = ["/login", "/auth", "/manutenzione"];

export function percorsoSempreAperto(pathname: string): boolean {
  return PERCORSI_APERTI.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/** Il fermo attivo in questo momento fra quelli passati, o null. */
export function fermoAdesso(
  righe: Manutenzione[],
  adesso: number = Date.now()
): Manutenzione | null {
  for (const r of righe) {
    const da = new Date(r.inizio_il).getTime();
    const a = new Date(r.fine_il).getTime();
    if (!isNaN(da) && !isNaN(a) && da <= adesso && a > adesso) return r;
  }
  return null;
}

/**
 * Il prossimo fermo che deve ancora cominciare, entro `entroOre`. E' quello
 * che la fascia di preavviso annuncia a chiunque, registrato o no.
 */
export function prossimoFermo(
  righe: Manutenzione[],
  adesso: number = Date.now(),
  entroOre = 48
): Manutenzione | null {
  const limite = adesso + entroOre * 3600 * 1000;
  const futuri = righe
    .filter((r) => {
      const da = new Date(r.inizio_il).getTime();
      return !isNaN(da) && da > adesso && da <= limite;
    })
    .sort((a, b) => a.inizio_il.localeCompare(b.inizio_il));
  return futuri[0] ?? null;
}

/**
 * Quanti secondi manca alla riapertura, per l'header `Retry-After`.
 *
 * Il minimo e' 30 secondi e non zero: un `Retry-After: 0` invita crawler e
 * browser a ripartire subito addosso a un sito che sta ancora chiudendo.
 */
export function secondiDiAttesa(
  f: Manutenzione,
  adesso: number = Date.now()
): number {
  const mancano = Math.ceil((new Date(f.fine_il).getTime() - adesso) / 1000);
  return Math.min(Math.max(mancano, 30), 86400);
}

const FUSO = "Europe/Rome";

/** «alle 03:40» / «domani alle 03:40» / «lunedì 14 alle 03:40». */
export function quandoLeggibile(
  iso: string,
  adesso: number = Date.now()
): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const ora = d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO,
  });
  const giorno = (t: number) =>
    new Date(t).toLocaleDateString("it-IT", { timeZone: FUSO });
  if (giorno(d.getTime()) === giorno(adesso)) return `alle ${ora}`;
  if (giorno(d.getTime()) === giorno(adesso + 86400000)) {
    return `domani alle ${ora}`;
  }
  const data = d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: FUSO,
  });
  return `${data} alle ${ora}`;
}

/**
 * Il testo che il preavviso mette davanti. Uno solo, usato dalla fascia
 * pubblica e dall'avviso della 071, cosi' non si scrive due volte.
 */
export function frasePreavviso(f: Manutenzione, adesso = Date.now()): string {
  return `Bob si ferma per manutenzione ${quandoLeggibile(
    f.inizio_il,
    adesso
  )} e torna ${quandoLeggibile(f.fine_il, adesso)}. ${f.motivo}`;
}

/** Niente HTML da un campo che scrive una persona, per quanto fidata. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * La pagina che vede chi arriva a sito fermo. Autosufficiente di proposito:
 * nessun CSS esterno, nessuno script, nessuna immagine. Se dipendesse da un
 * pezzo del sito sarebbe la pagina che si rompe proprio quando serve.
 */
export function paginaFermo(f: Manutenzione, adesso = Date.now()): string {
  const torna = quandoLeggibile(f.fine_il, adesso);
  const dettaglio = f.dettaglio?.trim()
    ? `<p class="d">${esc(f.dettaglio.trim()).replace(/\n/g, "<br>")}</p>`
    : "";
  return `<!doctype html>
<html lang="it"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Bob è in manutenzione</title>
<style>
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
padding:24px;background:#f6f6f8;color:#1c1c22;
font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.c{max-width:29rem;width:100%;background:#fff;border-radius:20px;padding:32px 28px;
box-shadow:0 1px 2px rgba(0,0,0,.05),0 12px 32px -12px rgba(0,0,0,.15)}
.e{font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#5b5bd6;margin:0}
h1{font-size:24px;line-height:1.25;font-weight:700;margin:10px 0 0;letter-spacing:-.01em}
.m{margin:14px 0 0;color:#1c1c22b8}
.d{margin:10px 0 0;color:#1c1c2299;font-size:15px}
.t{margin:20px 0 0;padding:12px 14px;border-radius:12px;background:#5b5bd60f;
color:#3f3fa8;font-size:15px;font-weight:600}
.s{margin:20px 0 0;padding-top:16px;border-top:1px solid #0000000d;
font-size:13px;color:#1c1c2273}
a{color:#5b5bd6}
</style></head>
<body><main class="c">
<p class="e">Bob</p>
<h1>Ci fermiamo un momento</h1>
<p class="m">${esc(f.motivo)}</p>
${dettaglio}
<p class="t">Torniamo ${esc(torna)}.</p>
<p class="s">Le richieste e i messaggi già inviati non si perdono: li ritrovi
tutti quando riapriamo. Se sei dello staff, entra da
<a href="/login">/login</a>.</p>
</main></body></html>`;
}

/**
 * La risposta a sito fermo: 503, non 200 e non 302.
 *
 * IL CODICE CONTA PIU' DELLA PAGINA. Un 200 con scritto «siamo fermi» dice a
 * Google che quella e' la pagina, e la manutenzione di un'ora finisce
 * nell'indice al posto della home; un 302 sposta il problema su un altro URL.
 * 503 con `Retry-After` e' l'unica risposta che significa «riprova, non e'
 * cambiato niente»: i motori tengono in caldo quello che avevano e i browser
 * non mettono niente in cache.
 */
export function rispostaFermo(f: Manutenzione, adesso = Date.now()): Response {
  return new Response(paginaFermo(f, adesso), {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "retry-after": String(secondiDiAttesa(f, adesso)),
      "cache-control": "no-store, must-revalidate",
      "x-robots-tag": "noindex",
    },
  });
}

// ---------------------------------------------------------------------------
// Lettura
// ---------------------------------------------------------------------------

const CAMPI = "id,motivo,dettaglio,inizio_il,fine_il";

/** Dal browser o dal server, con la sessione che c'e': la RLS fa il resto. */
export async function leggiManutenzioni(
  supabase: SupabaseClient
): Promise<Manutenzione[]> {
  const { data, error } = await supabase
    .from("manutenzioni")
    .select(CAMPI)
    .is("annullata_il", null)
    .gt("fine_il", new Date().toISOString())
    .order("inizio_il", { ascending: true })
    .limit(10);
  if (error) return [];
  return (data ?? []) as Manutenzione[];
}

// Il middleware gira su OGNI richiesta: una chiamata di rete a richiesta non
// e' accettabile, e nemmeno leggere una volta e non accorgersi mai piu' di
// niente. Dieci secondi e' il compromesso: il fermo rapido si vede entro dieci
// secondi su ogni istanza, e nel frattempo il costo e' zero.
const VALIDITA_MS = 10_000;
let cache: { scade: number; righe: Manutenzione[] } | null = null;

/**
 * Il fermo in corso, letto con la chiave pubblica direttamente da PostgREST.
 *
 * SI FALLISCE APERTI, SEMPRE. Se Supabase non risponde, se la chiave manca, se
 * la rete e' lenta: il sito resta su. Un controllo di manutenzione che chiude
 * Bob perche' una query e' andata in timeout sarebbe un disservizio
 * autoinflitto, e per giunta uno che si spegne solo a mano.
 */
export async function leggiFermoInCorso(): Promise<Manutenzione | null> {
  const adesso = Date.now();
  if (cache && cache.scade > adesso) return fermoAdesso(cache.righe, adesso);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chiave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chiave) return null;

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 1500);
  try {
    const iso = new Date(adesso).toISOString();
    const q =
      `${url}/rest/v1/manutenzioni?select=${CAMPI}` +
      `&annullata_il=is.null&fine_il=gt.${iso}` +
      `&order=inizio_il.asc&limit=5`;
    const res = await fetch(q, {
      headers: { apikey: chiave, authorization: `Bearer ${chiave}` },
      signal: stop.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const righe = (await res.json()) as Manutenzione[];
    cache = { scade: adesso + VALIDITA_MS, righe };
    return fermoAdesso(righe, adesso);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Per le prove: butta via quello che il bordo si e' tenuto in mano. */
export function scordaCache(): void {
  cache = null;
}
