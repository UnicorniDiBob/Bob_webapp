// La disdetta dell'abbonamento, in un posto solo.
//
// PERCHE' ESISTE QUESTO FILE
// La disdetta non e' una funzione nuova: e' una promessa gia' pubblicata. I
// ToS pro (art. 3, `TermsContent.tsx`) e le FAQ di /per-i-professionisti
// dicono la stessa frase — «puoi disdire in qualsiasi momento dall'area
// riservata, senza costi di disdetta ne' penali» — e finora dietro quella
// frase c'era un bottone «Passa a Free» dentro la griglia degli altri piani.
// Il declassamento funzionava (la route lo concede sempre: «scendere e'
// sempre concesso»), ma non si chiamava disdetta, non diceva cosa si perde e
// non aveva una data.
//
// LA DATA DI EFFETTO E' IL MOTIVO VERO DI QUESTO MODULO.
// Oggi Stripe non c'e': non esiste nessun periodo di fatturazione e la
// disdetta ha effetto SUBITO. La bozza dei ToS pro (4.3) promette pero' gia'
// l'effetto «dalla fine del periodo in corso», che e' quello che sara' vero
// da 12.1/12.2 in avanti. Se «ha effetto subito» finisce scritto a mano
// dentro la pagina, il giorno del checkout va cercato li' dentro, nei ToS e
// nella mail di conferma, e uno dei tre resta indietro. Sta qui: quando
// arriva l'abbonamento a pagamento si cambia questa funzione e basta.
//
// NIENTE DECLASSAMENTO NASCOSTO. `funzioniPerse` elenca solo cio' che il tier
// governa DAVVERO oggi (12.4: foto portfolio e prenotazione diretta, piu'
// l'accesso al percorso di verifica). Il badge gia' ottenuto non si tocca da
// qui — `professionals.verification_level` e' una colonna a parte e nessun
// declassamento e' automatico (art. 22, regola del blocco 10).

import { PIANI, pianoById } from "@/lib/piani";
import type { SubscriptionTier } from "@/lib/supabase/types";

/** L'ordine dei piani dal piu' basso al piu' alto. */
const SCALA: SubscriptionTier[] = PIANI.map((p) => p.id);

export interface EffettoDisdetta {
  /** Vero finche' non esiste un periodo di fatturazione da far scadere. */
  immediata: boolean;
  /** Come si dice al professionista, in una riga. */
  quando: string;
}

/**
 * Quando ha effetto la disdetta. UNICA fonte: pagina, conferma ed eventuali
 * email devono chiamare questa, mai scrivere la frase a mano.
 *
 * Con Stripe attivo diventera' `immediata: false` e la frase portera' la data
 * di fine periodo letta dall'abbonamento.
 */
export function effettoDisdetta(): EffettoDisdetta {
  return {
    immediata: true,
    quando:
      "Ha effetto subito: finche' gli abbonamenti a pagamento non sono attivi non c'e' nessun periodo da far scadere e non hai niente in sospeso.",
  };
}

/**
 * Cosa smette di funzionare tornando a Free. Si ricava dai piani, cosi' il
 * giorno che a Bob Pro si aggiunge una funzione questa lista la segue da sola
 * invece di restare indietro (e' lo stesso motivo per cui PIANI vive in
 * `piani.ts` e non dentro le pagine).
 */
export function funzioniPerse(tier: SubscriptionTier): string[] {
  const fino = SCALA.indexOf(tier);
  if (fino <= 0) return [];
  return SCALA.slice(1, fino + 1)
    .flatMap((id) => pianoById(id).punti)
    .filter((p) => !/^tutto di /i.test(p));
}

/** Cosa resta comunque: e' il piano Free, non una lista scritta due volte. */
export function funzioniCheRestano(): string[] {
  return pianoById("free").punti;
}

/**
 * Il badge non se ne va con la disdetta, e va detto: il contrario sarebbe un
 * declassamento automatico, che qui non facciamo mai.
 */
export const BADGE_RESTA =
  "La verifica che hai gia' ottenuto non te la togliamo da qui: nessun declassamento e' automatico. Se dovra' cambiare stato te lo scriviamo prima, con il motivo.";
