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
//
// I ToS pro (4.3) promettono la disdetta «con effetto dalla fine del periodo
// in corso»; oggi nessuno paga, quindi un periodo da far scadere non esiste.
// Per un po' questo file ha detto solo la seconda cosa, con la prima
// parcheggiata in un commento «si cambiera' al checkout» — cioe' appoggiata
// alla memoria di qualcuno, sei mesi prima del giorno in cui serviva.
//
// Adesso sa fare tutte e due, e quale applicare lo decide un DATO:
//   · il piano non costa niente a chi ce l'ha (oggi: tutti, perche' i piani si
//     attivano con un codice) -> effetto SUBITO. Tenere qualcuno su Bob Pro
//     tre settimane «fino alla fine del periodo» quando non ha mai pagato
//     niente e' una finzione che lui vede benissimo;
//   · il piano lo paga -> effetto alla fine del mese di abbonamento in corso,
//     contato dal giorno in cui quel piano e' stato attivato («Attivo dal»,
//     da subscription_tier_events).
// Il giorno del primo pagamento il ramo cambia da solo. Nessun deploy da
// sincronizzare con niente, che era il punto.
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
  /** Vero quando non c'e' nessun periodo pagato da far scadere. */
  immediata: boolean;
  /** Il giorno in cui il piano scende, ISO. Null se la disdetta e' immediata. */
  effettivaDal: string | null;
  /** Come si dice al professionista, in una riga. */
  quando: string;
}

const GIORNO = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Rome",
});

/**
 * La fine del mese di abbonamento in corso: il primo anniversario mensile di
 * `attivoDal` che viene dopo adesso.
 *
 * IL CASO CHE ROMPE TUTTE LE IMPLEMENTAZIONI INGENUE e' il 31. Un piano
 * attivato il 31 gennaio non ha un anniversario il 31 febbraio: `setMonth`
 * traboccherebbe al 2 o 3 marzo, e il professionista si vedrebbe una data che
 * non c'entra niente con il giorno in cui ha attivato. Qui il giorno viene
 * limitato all'ultimo del mese di arrivo — 28 febbraio, poi di nuovo 31 marzo:
 * il mese "storto" non sposta tutti quelli dopo.
 */
export function fineDelPeriodo(
  attivoDal: string,
  adesso: Date = new Date()
): Date | null {
  const da = new Date(attivoDal);
  if (isNaN(da.getTime())) return null;

  const giorno = da.getUTCDate();
  let mesi = Math.max(
    0,
    (adesso.getUTCFullYear() - da.getUTCFullYear()) * 12 +
      (adesso.getUTCMonth() - da.getUTCMonth())
  );

  // Al massimo due giri: il primo puo' cadere prima di adesso per via del
  // giorno del mese, il secondo no.
  for (let giro = 0; giro < 3; giro += 1) {
    const anno = da.getUTCFullYear() + Math.floor((da.getUTCMonth() + mesi) / 12);
    const mese = (da.getUTCMonth() + mesi) % 12;
    const ultimo = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate();
    const candidato = new Date(
      Date.UTC(
        anno,
        mese,
        Math.min(giorno, ultimo),
        da.getUTCHours(),
        da.getUTCMinutes(),
        da.getUTCSeconds()
      )
    );
    if (candidato.getTime() > adesso.getTime()) return candidato;
    mesi += 1;
  }
  return null;
}

/**
 * Quando ha effetto la disdetta. UNICA fonte: pagina, conferma, route ed
 * eventuali email chiamano questa, e nessuno scrive la frase a mano.
 *
 * `gratis` = il piano attuale e' coperto al 100% dagli sconti di questa
 * persona, cioe' non le costa niente. `attivoDal` = da quando ha questo piano.
 * Senza `attivoDal` non sappiamo dove finisce il mese: meglio la disdetta
 * subito che una data inventata.
 */
export function effettoDisdetta(
  opts: { gratis: boolean; attivoDal: string | null } = {
    gratis: true,
    attivoDal: null,
  },
  adesso: Date = new Date()
): EffettoDisdetta {
  const fine = opts.gratis || !opts.attivoDal
    ? null
    : fineDelPeriodo(opts.attivoDal, adesso);

  if (!fine) {
    return {
      immediata: true,
      effettivaDal: null,
      quando: opts.gratis
        ? "Ha effetto subito: il tuo piano è coperto da un codice, non c'è nessun periodo pagato da far scadere e non hai niente in sospeso."
        : "Ha effetto subito: non risulta nessun periodo di abbonamento in corso da far scadere.",
    };
  }

  return {
    immediata: false,
    effettivaDal: fine.toISOString(),
    quando: `Ha effetto il ${GIORNO.format(
      fine
    )}, alla fine del mese di abbonamento in corso. Fino a quel giorno non cambia niente, e puoi annullare la disdetta quando vuoi.`,
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
