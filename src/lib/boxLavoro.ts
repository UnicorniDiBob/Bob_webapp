// IL BOX DI UN LAVORO IN CORSO: LA RIGA DI STATO, SENZA REACT (15/10).
//
// Nella dashboard del cliente ogni richiesta aperta e' un box che dice solo
// «a che punto e', e c'e' qualcosa di nuovo?»; il resto sta nella pagina
// della richiesta. La riga di stato e' una frase sola, e la prima regola che
// vale vince. L'ordine e' quello di cosa conta di piu' per il cliente:
//   1. un pro propone un orario — e' l'unica cosa che aspetta lui, e scade;
//   2. un appuntamento confermato e non finito — e' la prossima cosa che
//      succede davvero, piu' importante di quante risposte ci sono;
//   3. il cliente ha proposto un orario — tocca al pro, ma e' lo stesso
//      l'ultima novita' del lavoro;
//   «Hai scelto <Pro>» (15/10, PR 7, migrazione 120): dopo la scelta, e se
//      le regole 1-3 non dicono gia' qualcosa, la frase e' questa. I pro
//      archiviati non arrivano qui: CustomerHome li toglie da `pros`;
//   4. altrimenti conta i pro che hanno RISPOSTO davvero (almeno un
//      messaggio con sender_type 'professional'), non quelli collegati
//      (decisione di André, 15/10, con la migrazione 119):
//        due o piu' → «N risposte da confrontare»;
//        uno, ed e' l'unico collegato → «In contatto con <Pro>»;
//        uno di piu' collegati → «Ha risposto <Pro>, in attesa di N»;
//        nessuno → segue lo stato, come i puntini (passiRichiesta):
//          'quote_request' → «Preventivo chiesto a <Pro>» / «… a N pro»;
//          'matched' (righe di prima della 119, quando ci arrivava anche il
//          messaggio del cliente) → «In contatto con <Pro>» / «Preventivo
//          chiesto a N pro»;
//          gli altri → «Inviata a <Pro>» / «Inviata a N pro»;
//          nessun pro → «In attesa di risposte».
//      Prima contava i pro collegati e si fidava di «matched», che fino
//      alla 119 voleva dire «il cliente ha scritto»: «2 risposte da
//      confrontare» poteva comparire senza nessuna risposta.
// Una proposta il cui orario e' passato non conta: non si conferma piu'
// (vedi propostaDaRispondere).

import {
  nonFinito,
  propostaDaRispondere,
  quandoBreve,
  type AppuntamentoDaFare,
} from "@/lib/daFareCliente";
import type { Passo } from "@/lib/passiRichiesta";

/** Dal 15/10 AppuntamentoDaFare porta gia' request_id e professional_id. */
export type AppuntamentoBox = AppuntamentoDaFare;

function primo<A extends { starts_at: string }>(as: A[]): A | undefined {
  return [...as].sort(
    (x, y) => new Date(x.starts_at).getTime() - new Date(y.starts_at).getTime()
  )[0];
}

/** La frase di stato del box: la prima regola che vale vince. */
export function rigaStatoLavoro(
  dati: {
    /** Lo stato della richiesta: sent, quote_request, matched. */
    status: string;
    /** Gli appuntamenti di QUESTA richiesta. */
    appuntamenti: AppuntamentoBox[];
    pros: { id: string; name: string }[];
    /** I pro che hanno scritto almeno un messaggio su QUESTA richiesta. */
    rispondenti: Set<string>;
    /** Il pro scelto (120). I pro archiviati non sono in `pros`. */
    scelto?: string | null;
  },
  adesso: Date = new Date()
): string {
  const t = adesso.getTime();
  const nome = (pid: string) =>
    dati.pros.find((p) => p.id === pid)?.name ?? "Professionista";

  const proposta = primo(dati.appuntamenti.filter((a) => propostaDaRispondere(a, t)));
  if (proposta) {
    return `${nome(proposta.professional_id)} propone ${quandoBreve(proposta.starts_at, adesso)}`;
  }

  const confermato = primo(
    dati.appuntamenti.filter((a) => a.status === "confirmed" && nonFinito(a, t))
  );
  if (confermato) {
    return `Appuntamento ${quandoBreve(confermato.starts_at, adesso)} con ${nome(confermato.professional_id)}`;
  }

  const mia = primo(
    dati.appuntamenti.filter(
      (a) =>
        a.status === "proposed" &&
        a.proposed_by === "customer" &&
        new Date(a.starts_at).getTime() > t
    )
  );
  if (mia) return `In attesa che ${nome(mia.professional_id)} confermi l'orario`;

  // HAI SCELTO (15/10, PR 7). Dopo la scelta il confronto e' finito: la
  // frase non conta piu' le risposte, dice con chi si va avanti. Le regole
  // 1-3 (proposta, appuntamento, proposta del cliente) vincono lo stesso.
  if (dati.scelto) {
    const p = dati.pros.find((x) => x.id === dati.scelto);
    if (p) return `Hai scelto ${p.name}`;
  }

  const n = dati.pros.length;
  const risposto = dati.pros.filter((p) => dati.rispondenti.has(p.id));
  if (risposto.length >= 2) return `${risposto.length} risposte da confrontare`;
  if (risposto.length === 1) {
    return n === 1
      ? `In contatto con ${risposto[0].name}`
      : `Ha risposto ${risposto[0].name}, in attesa di ${n - 1}`;
  }

  if (n === 0) return "In attesa di risposte";
  const uno = n === 1 ? dati.pros[0].name : null;
  if (dati.status === "matched") {
    return uno ? `In contatto con ${uno}` : `Preventivo chiesto a ${n} pro`;
  }
  if (dati.status === "quote_request") {
    return `Preventivo chiesto a ${uno ?? `${n} pro`}`;
  }
  return `Inviata a ${uno ?? `${n} pro`}`;
}

/**
 * Il passo a cui e' la richiesta, per il nome accessibile della barra:
 * quello «adesso»; se non c'e' (richiesta chiusa), l'ultimo.
 */
export function passoCorrente(passi: Passo[]): { numero: number; di: number; etichetta: string } {
  const i = passi.findIndex((p) => p.stato === "adesso");
  const k = i >= 0 ? i : passi.length - 1;
  return { numero: k + 1, di: passi.length, etichetta: passi[k]?.etichetta ?? "" };
}
