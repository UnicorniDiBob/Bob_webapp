// CHI SI PUO' COLLEGARE A UNA RICHIESTA (16/10, migrazione 125).
//
// Il browser del cliente scrive request_professionals in due flussi:
// «Contatta» dal profilo (RequestDialog) e il preventivo dalla chat di Bob
// (QuoteDialog). Dalla 125 il database rifiuta quello che l'app non
// offrirebbe mai: un pro non pronto o spento, il proprio profilo da pro, piu'
// di MAX_PRO_PER_RICHIESTA pro sulla stessa richiesta. Qui stanno il tetto,
// che la chat di Bob usa per non far scegliere di piu', e la traduzione dei
// rifiuti in parole per chi li vede.

/**
 * Quanti professionisti al massimo per richiesta. REGOLA DI PRODOTTO (André,
 * 16/10): un preventivo si chiede a pochi. E' l'unico posto dell'app dove sta
 * il numero: lo usano la chat di Bob e il testo del rifiuto. La 125 ha lo
 * stesso 3 nel database, e collegamento.test.ts controlla che coincidano.
 */
export const MAX_PRO_PER_RICHIESTA = 3;

// I testi esatti dei RAISE della 125: arrivano cosi' come sono in
// error.message. Solo questi si mostrano: qualunque altro errore resta il
// messaggio generico di chi chiama.
const RIFIUTI_125 = [
  "Questo professionista non è disponibile per nuove richieste.",
  "Non puoi contattare il tuo stesso profilo da professionista.",
  `Puoi contattare al massimo ${MAX_PRO_PER_RICHIESTA} professionisti per richiesta.`,
] as const;

/**
 * Il messaggio da mostrare se l'errore e' un rifiuto della guardia (125),
 * altrimenti null. Guarda il testo e non solo il codice: 42501 e' anche il
 * rifiuto generico delle policy, che non e' una frase per il cliente.
 */
export function rifiutoCollegamento(errore: unknown): string | null {
  const e = errore as { code?: unknown; message?: unknown } | null;
  if (!e || typeof e.message !== "string") return null;
  if (e.code !== "42501" && e.code !== "23514") return null;
  return RIFIUTI_125.find((t) => e.message === t) ?? null;
}
