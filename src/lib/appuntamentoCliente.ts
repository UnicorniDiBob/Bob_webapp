// LA RISPOSTA DEL CLIENTE A UNA PROPOSTA D'ORARIO, IN UN POSTO SOLO (15/10).
//
// Conferma e Rifiuta stavano dentro CustomerHome. Dal 15/10 si risponde anche
// dalla pagina della richiesta, e la stessa risposta deve fare le stesse tre
// cose ovunque: cambiare lo stato, scrivere in chat cosa si e' deciso,
// avvisare il pro. Se una delle due pagine le facesse in modo diverso, il pro
// riceverebbe due versioni della stessa conferma.
//
// DAL 17/10 LE FA IL SERVER (POST /api/appointments/[id]/conferma e
// /rifiuta, src/lib/rispostaProposta.ts), lo stesso per il sito e per l'app.
// Qui resta solo la chiamata: finche' il server non ha detto si', la pagina
// non mostra niente di confermato; se dice no, un messaggio breve sotto i
// tasti, e i tasti tornano cliccabili.

import { useState } from "react";

export interface AppuntamentoCliente {
  id: string;
  request_id: string | null;
  professional_id: string;
  title: string | null;
  starts_at: string;
  duration_minutes: number;
  status: string;
  proposed_by: "professional" | "customer";
  source: "pro" | "direct" | null;
  cancellation_window_hours: number | null;
}

/** Le colonne che servono a una riga di appuntamento del cliente. */
export const COLONNE_APPUNTAMENTO_CLIENTE =
  "id, request_id, professional_id, title, starts_at, duration_minutes, status, proposed_by, source, cancellation_window_hours";

/** «gio», 9, «10:30»: come la dashboard scrive un appuntamento. */
export function fmtDayParts(d: string) {
  const date = new Date(d);
  return {
    dow: date.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", ""),
    day: date.getDate(),
    time: date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
  };
}

/** Cosa dire sotto i tasti quando la risposta non e' andata. */
export interface ErroreRisposta {
  id: string;
  testo: string;
}

/**
 * Conferma o rifiuta una proposta. Tiene lo stato «sto rispondendo a questo»
 * (per spegnere i tasti), l'errore dell'ultima risposta andata male, e chiama
 * `onFatto` quando il server ha risposto bene.
 */
export function useRispostaAppuntamento(
  userId: string | null | undefined,
  onFatto: () => void | Promise<void>
) {
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [errore, setErrore] = useState<ErroreRisposta | null>(null);

  async function rispondi(a: AppuntamentoCliente, ok: boolean) {
    if (!userId || inCorso) return;
    setInCorso(a.id);
    setErrore(null);
    try {
      const res = await fetch(`/api/appointments/${a.id}/${ok ? "conferma" : "rifiuta"}`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        setErrore({
          id: a.id,
          testo:
            res.status === 401
              ? "Sei uscito dall'account: rientra e riprova."
              : d?.error ?? "Non sono riuscito a salvare. Riprova.",
        });
        return;
      }
      await onFatto();
    } catch {
      setErrore({ id: a.id, testo: "Non riesco a raggiungere Bob. Controlla la connessione e riprova." });
    } finally {
      setInCorso(null);
    }
  }

  return { rispondi, inCorso, errore };
}
