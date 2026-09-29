// «AGGIUNGI UN ALTRO ACCOUNT» e «RICONNETTI», decisi senza eseguire niente
// (29/09, sessioni multiple). Le route eseguono; qui si decide, e si prova.
//
// I TRE VINCOLI DI LUCIO:
//   1. se il login fallisce non si tocca NIENTE, nemmeno bob-attesa;
//   2. errore IDENTICO per email sbagliata e password sbagliata (e per ogni
//      altro rifiuto di Supabase): la route non deve dire chi ha un account;
//   3. la password non finisce in nessun log.
// Il tetto di tentativi (per IP e per HMAC dell'email) lo applica la route
// PRIMA del login: vedi tetto.ts e la migrazione 104.

import type { Attesa, SessioneSupabase } from "./attesa";

/** Il messaggio unico per ogni rifiuto delle credenziali. */
export const ERRORE_CREDENZIALI = "Email o password non corrette.";
/** Il messaggio unico quando si supera il tetto: non dice quale dei due tetti. */
export const ERRORE_TROPPI = "Troppi tentativi. Riprova fra qualche minuto.";

/** Prima del login: si puo' tentare? Nessuna rete. */
export function puoTentare(
  attivoId: string | null,
  attesa: Attesa | null
): { ok: true } | { ok: false; motivo: "nessun_attivo" | "gia_due" } {
  if (!attivoId) return { ok: false, motivo: "nessun_attivo" };
  // Un secondo account vivo c'e' gia': prima si esce da quello.
  if (attesa?.refreshToken) return { ok: false, motivo: "gia_due" };
  return { ok: true };
}

export type EsitoAggiunta =
  /** bob-attesa si scrive con questa. */
  | { tipo: "aggiunto"; attesa: Attesa }
  /** Login rifiutato: NIENTE da scrivere, niente da revocare. */
  | { tipo: "credenziali" }
  /** Login riuscito ma non si puo' tenere: la sessione appena nata va revocata. */
  | { tipo: "stesso_account"; daRevocare: string }
  | { tipo: "altro_da_riconnettere"; daRevocare: string };

/**
 * Dopo il login. `sessione` null = Supabase ha rifiutato (per qualunque
 * motivo): esito «credenziali», senza distinguere. Se lo slot e' «da
 * riconnettere», lo riprende solo lo stesso account: un account diverso non lo
 * sostituisce in silenzio.
 */
export function decidiDopoLogin(
  attivoId: string,
  attesa: Attesa | null,
  sessione: SessioneSupabase | null
): EsitoAggiunta {
  if (!sessione) return { tipo: "credenziali" };
  if (sessione.user.id === attivoId) return { tipo: "stesso_account", daRevocare: sessione.access_token };
  if (attesa && attesa.refreshToken === null && attesa.userId !== sessione.user.id) {
    return { tipo: "altro_da_riconnettere", daRevocare: sessione.access_token };
  }
  return {
    tipo: "aggiunto",
    attesa: { refreshToken: sessione.refresh_token, userId: sessione.user.id, email: sessione.user.email ?? "" },
  };
}
