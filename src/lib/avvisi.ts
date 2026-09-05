"use client";

// GLI AVVISI DI SERVIZIO — quando siamo noi a dover dire una cosa a tutti.
//
// Una manutenzione programmata, un disservizio in corso, un cambiamento che
// riguarda chiunque usi Bob. Non e' una notifica personale: e' la stessa frase
// per tutti, scritta da una persona dello staff. Per questo, sola in tutto il
// prodotto, ha una tabella sua (vedi la migrazione 071, che spiega perche' qui
// la regola «niente tabella» di notifiche.ts non poteva reggere).
//
// DOVE SI VEDE, E IN CHE ORDINE:
//   1. una finestra, UNA VOLTA SOLA, al primo accesso dopo la pubblicazione;
//   2. da li' in poi fra le notifiche di servizio, come tutto il resto;
//   3. alla data e all'ora di fine sparisce da solo, da tutti e due i posti.
// Il passo 3 non e' un filtro dell'interfaccia: e' la policy di lettura del
// database. Un avviso scaduto non arriva proprio al browser, quindi non c'e'
// modo di dimenticarsi un `where` e lasciarlo in pagina.

import type { SupabaseClient } from "@supabase/supabase-js";

export type LivelloAvviso = "informazione" | "attenzione" | "disservizio";

export interface AvvisoServizio {
  id: string;
  titolo: string;
  testo: string;
  livello: LivelloAvviso;
  inizio_il: string;
  fine_il: string;
}

/** Quanto pesa a vederselo arrivare: decide colore e ordine, non altro. */
export const PESO_AVVISO: Record<LivelloAvviso, number> = {
  disservizio: 0,
  attenzione: 1,
  informazione: 2,
};

export const ETICHETTA_AVVISO: Record<LivelloAvviso, string> = {
  informazione: "Informazione",
  attenzione: "Attenzione",
  disservizio: "Disservizio",
};

/**
 * Gli avvisi in corso adesso, per la finestra e per la campanella.
 *
 * IL FILTRO SULLA FINESTRA C'E' ANCHE QUI, e serve. La policy della 071 e' il
 * pavimento: un utente normale un avviso scaduto non riesce proprio a
 * leggerlo. Ma admin e cs li leggono TUTTI — devono, per gestirli e per
 * rispondere a chi chiede «che succede?» — e senza questo filtro si
 * prenderebbero in faccia la finestra di una manutenzione di tre settimane fa.
 * Quindi: la RLS decide chi puo' leggere cosa, questa funzione decide cosa e'
 * in corso adesso. Due domande diverse, due posti diversi.
 *
 * Non lancia mai. Un avviso che non si carica e' un avviso mancato; una
 * pagina che non si apre perche' l'avviso non si e' caricato e' peggio.
 */
export async function leggiAvvisiInCorso(
  supabase: SupabaseClient
): Promise<AvvisoServizio[]> {
  const { data, error } = await supabase
    .from("avvisi_servizio")
    .select("id, titolo, testo, livello, inizio_il, fine_il")
    .order("inizio_il", { ascending: false });

  if (error) return [];
  const adesso = Date.now();
  const righe = ((data ?? []) as AvvisoServizio[]).filter((a) => {
    const da = new Date(a.inizio_il).getTime();
    const a_ = new Date(a.fine_il).getTime();
    return !isNaN(da) && !isNaN(a_) && da <= adesso && a_ > adesso;
  });
  return righe.sort(
    (a, b) =>
      PESO_AVVISO[a.livello] - PESO_AVVISO[b.livello] ||
      b.inizio_il.localeCompare(a.inizio_il)
  );
}

/**
 * Quali di questi non ha ancora visto. `vistiAl` e' la data sull'account
 * (profiles.avvisi_visti_al): tutto quello che e' stato pubblicato dopo, non
 * l'ha ancora visto.
 */
export function daMostrare(
  avvisi: AvvisoServizio[],
  vistiAl: string | null
): AvvisoServizio[] {
  if (!vistiAl) return avvisi;
  return avvisi.filter((a) => a.inizio_il > vistiAl);
}

/**
 * La data da salvare dopo aver chiuso la finestra: la piu' recente fra quelli
 * mostrati, NON `now()`. Se l'orologio del browser e' avanti di un minuto
 * rispetto al server, `now()` marcherebbe come gia' visto un avviso pubblicato
 * in quel minuto e quella persona non lo vedrebbe mai.
 */
export function segnaFinoA(mostrati: AvvisoServizio[]): string | null {
  if (mostrati.length === 0) return null;
  return mostrati.reduce(
    (max, a) => (a.inizio_il > max ? a.inizio_il : max),
    mostrati[0].inizio_il
  );
}
