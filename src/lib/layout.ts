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
 *
 * LA REGOLA, perche' e' gia' stata sbagliata due volte:
 *
 *   Il contenitore decide la CORNICE, e dipende solo da pubblico/applicazione.
 *   La misura di lettura si applica al CONTENUTO dentro, mai al contenitore.
 *
 * `/notifiche` e `/supporto` scrivevano `container-bob max-w-2xl`: stringevano
 * la cornice a 672px, e con lei si spostavano intestazione e piede. Passando
 * dalla dashboard alle notifiche la pagina saltava da 1600 a 672. Per stringere
 * il testo si usa `.colonna-lettura` su un blocco interno: la cornice resta
 * ferma e si muove solo la colonna.
 */
export const ROTTE_APP = [
  "/dashboard",
  "/messaggi",
  "/impostazioni",
  "/notifiche",
] as const;

export function isRottaApp(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ROTTE_APP.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

/** La classe del contenitore giusta per la rotta corrente. */
export function classeContenitore(pathname: string | null | undefined): string {
  return isRottaApp(pathname) ? "container-app" : "container-bob";
}
