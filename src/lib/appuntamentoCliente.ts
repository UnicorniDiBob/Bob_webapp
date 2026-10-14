// LA RISPOSTA DEL CLIENTE A UNA PROPOSTA D'ORARIO, IN UN POSTO SOLO (15/10).
//
// Conferma e Rifiuta stavano dentro CustomerHome. Dal 15/10 si risponde anche
// dalla pagina della richiesta, e la stessa risposta deve fare le stesse tre
// cose ovunque: cambiare lo stato, scrivere in chat cosa si e' deciso,
// avvisare il pro. Se una delle due pagine le facesse in modo diverso, il pro
// riceverebbe due versioni della stessa conferma.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "@/lib/messages";
import { notifyEvent } from "@/lib/notify";

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

/**
 * Conferma o rifiuta una proposta. Tiene lo stato «sto rispondendo a questo»
 * (per spegnere i tasti) e chiama `onFatto` quando la risposta e' andata.
 */
export function useRispostaAppuntamento(
  userId: string | null | undefined,
  onFatto: () => void | Promise<void>
) {
  const [inCorso, setInCorso] = useState<string | null>(null);

  async function rispondi(a: AppuntamentoCliente, ok: boolean) {
    if (!userId) return;
    setInCorso(a.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("appointments")
      .update({ status: ok ? "confirmed" : "declined" })
      .eq("id", a.id);
    if (!error && a.request_id) {
      const { dow, day, time } = fmtDayParts(a.starts_at);
      await sendMessage(
        a.request_id,
        a.professional_id,
        userId,
        "customer",
        ok
          ? `Ho confermato l'appuntamento di ${dow} ${day} alle ${time}.`
          : `Non posso ${dow} ${day} alle ${time}: proponi un altro orario?`
      );
      notifyEvent(ok ? "appointment_confirmed" : "appointment_declined", {
        requestId: a.request_id,
        professionalId: a.professional_id,
      });
      await onFatto();
    }
    setInCorso(null);
  }

  return { rispondi, inCorso };
}
