// «AGGIUNGI UN ALTRO ACCOUNT» e «RICONNETTI», decisi senza eseguire niente
// (29/09, sessioni multiple). Le route eseguono; qui si decide, e si prova.
//
// DAL 30/09 (R6) l'accesso avviene nel pannello di /login in modalita'
// «aggiungi» (AccessoAggiuntivo), su un client che non scrive i cookie
// dell'attivo; /api/sessioni/adotta riceve solo il refresh token e applica
// queste decisioni. /api/sessioni/aggiungi, che riceveva la password e aveva
// il suo tetto di tentativi (tetto.ts, migrazione 104), non c'e' piu'.
//
// RESTANO I VINCOLI DI LUCIO:
//   1. se l'accesso fallisce non si tocca NIENTE, nemmeno bob-attesa;
//   2. errore IDENTICO per email sbagliata e password sbagliata (e per ogni
//      altro rifiuto di Supabase): non si dice chi ha un account;
//   3. la password va solo a Supabase: non passa dalle nostre route, quindi da
//      nessun log nostro.

import type { Attesa, SessioneSupabase } from "./attesa";

/** Il messaggio unico per ogni rifiuto delle credenziali. */
export const ERRORE_CREDENZIALI = "Email o password non corrette.";

/** Prima di adottare la sessione: si puo'? Nessuna rete. */
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
 * Dopo l'accesso. `sessione` null = Supabase ha rifiutato (il login nel
 * pannello, o il rinnovo del token in adotta): esito «credenziali», senza
 * distinguere. Se lo slot e' «da
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
