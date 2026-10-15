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
//   4-6. altrimenti quanti pro ci sono: da confrontare, uno, nessuno.
// Una proposta il cui orario e' passato non conta: non si conferma piu'
// (vedi propostaDaRispondere).

import {
  nonFinito,
  propostaDaRispondere,
  quandoBreve,
  type AppuntamentoDaFare,
} from "@/lib/daFareCliente";
import type { Passo } from "@/lib/passiRichiesta";

export interface AppuntamentoBox extends AppuntamentoDaFare {
  professional_id: string;
}

function primo<A extends { starts_at: string }>(as: A[]): A | undefined {
  return [...as].sort(
    (x, y) => new Date(x.starts_at).getTime() - new Date(y.starts_at).getTime()
  )[0];
}

/** La frase di stato del box: la prima regola che vale vince. */
export function rigaStatoLavoro(
  dati: {
    /** Gli appuntamenti di QUESTA richiesta. */
    appuntamenti: AppuntamentoBox[];
    pros: { id: string; name: string }[];
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

  if (dati.pros.length >= 2) return `${dati.pros.length} risposte da confrontare`;
  if (dati.pros.length === 1) return `In contatto con ${dati.pros[0].name}`;
  return "In attesa di risposte";
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
