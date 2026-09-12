/**
 * Quali rotte sono "applicazione" e quali sono "sito".
 *
 * Bob e' due cose in un dominio solo. Le pagine pubbliche si leggono, e per
 * leggere una riga lunga e' peggio: 1120px (`container-bob`) e' la misura
 * giusta e resta. Le pagine dietro il login si usano, e li' lo spazio e' la
 * risorsa: `container-app` arriva a 1600px.
 *
 * Sta in un modulo suo perche' lo consultano anche l'intestazione e il piede,
 * che vivono nel layout e non sanno da soli su che pagina si trovano. Se un
 * giorno una rotta cambia famiglia, si cambia qui e basta.
 */
export const ROTTE_APP = ["/dashboard", "/messaggi", "/impostazioni"] as const;

export function isRottaApp(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ROTTE_APP.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

/** La classe del contenitore giusta per la rotta corrente. */
export function classeContenitore(pathname: string | null | undefined): string {
  return isRottaApp(pathname) ? "container-app" : "container-bob";
}
