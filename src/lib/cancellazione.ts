// Regole della cancellazione dell'account, in un posto solo.
//
// PERCHE' QUI E NON NELLA ROTTA
// Il primo tentativo teneva la costante dentro src/app/api/account/
// cancellazione/route.ts, e il build l'ha rifiutato: un file di rotta Next puo'
// esportare solo i nomi che il framework conosce (GET, POST, runtime, dynamic
// ...), non costanti arbitrarie. E' stato un errore fortunato, perche' ha
// costretto a mettere in comune anche l'elenco dei motivi, che stava scritto due
// volte — nella rotta per validarlo e nel componente per mostrarlo. Due elenchi
// che divergono significano un motivo che l'utente puo' scegliere e il server
// rifiuta, senza che nessuno capisca perche'.

/**
 * Giorni fra la richiesta e la cancellazione effettiva.
 *
 * Sta dentro l'art. 12(3) GDPR (un mese per dare riscontro) e non e' un ritardo
 * "ingiustificato" ai sensi dell'art. 17(1) a una condizione: che sia dichiarato
 * alla persona come finestra di ripensamento che controlla lei. Per questo il
 * numero compare sullo schermo in /impostazioni/accesso e nell'avviso in cima a
 * ogni pagina, e viene da qui: se vivesse in due posti, prima o poi lo schermo e
 * il comportamento direbbero due cose diverse alla stessa persona.
 */
export const GIORNI_RIPENSAMENTO = 7;

/**
 * I motivi proponibili. FACOLTATIVI, sempre: l'art. 12(2) obbliga il titolare ad
 * agevolare l'esercizio dei diritti, e pretendere una motivazione per
 * cancellarsi e' un ostacolo, non un'agevolazione.
 */
export const MOTIVI_CANCELLAZIONE = [
  { id: "non_lo_uso", label: "Non lo uso" },
  { id: "trovato_altro", label: "Ho trovato un altro modo di risolvere" },
  { id: "troppe_email", label: "Troppe comunicazioni" },
  { id: "problema_con_un_professionista", label: "Un problema con un professionista" },
  { id: "problema_di_fiducia", label: "Non mi fido di come trattate i miei dati" },
  { id: "altro", label: "Altro" },
] as const;

export type MotivoCancellazione = (typeof MOTIVI_CANCELLAZIONE)[number]["id"];

export function motivoValido(x: unknown): x is MotivoCancellazione {
  return MOTIVI_CANCELLAZIONE.some((m) => m.id === x);
}
