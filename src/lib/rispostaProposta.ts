// IL CLIENTE CONFERMA O RIFIUTA UNA PROPOSTA D'ORARIO: UNA STRADA SOLA (17/10).
//
// Fino al 17/10 lo faceva il browser, in tre punti (home del cliente,
// pagina della richiesta, biglietto in chat): cambiare lo stato, scrivere in
// chat cosa si e' deciso, avvisare il pro. L'app non poteva rifarlo uguale
// senza copiarne i testi. Adesso il lavoro e' qui, chiamato da
// POST /api/appointments/[id]/conferma e /rifiuta, per il sito (cookie) e
// per l'app (Bearer).
//
// STATO E MESSAGGIO LI FA IL DATABASE, INSIEME (132): rispondi_proposta()
// controlla chi chiama e in che stato e' la proposta, cambia lo stato e
// scrive il messaggio in una transazione sola — o tutti e due o nessuno. I
// testi del messaggio stanno li'. Qui resta la traduzione dei motivi in
// risposte HTTP (le stesse della PR #204) e la notifica, che parte solo se
// la funzione e' riuscita e non era una risposta ripetuta.
//
// GIRA CON LA SESSIONE DEL CLIENTE, non col service role: la funzione e'
// SECURITY INVOKER, quindi la RLS e i trigger vedono il cliente. Lo storico
// (registra_evento_appuntamento) scrive autore 'customer', e da li' nasce la
// campanella del pro. Col service role direbbe 'sistema'.

import type { SupabaseClient } from "@supabase/supabase-js";
import { notificaEvento } from "@/lib/notificaEvento";

export type Risposta = "conferma" | "rifiuta";

export type EsitoRisposta =
  | { stato: 200; corpo: { ok: true; status: "confirmed" | "declined"; giaFatto: boolean; messaggio: boolean } }
  | { stato: 401 | 403 | 404 | 409 | 500; corpo: { error: string; motivo: string } };

/** I motivi di rispondi_proposta() (hint) e la risposta HTTP di ognuno. */
const STATO_PER_MOTIVO: Record<string, 403 | 404 | 409> = {
  non_trovato: 404,
  non_cliente: 403,
  non_proposta: 409,
  proposta_tua: 409,
  scaduta: 409,
  // (132) Il cliente ha archiviato la conversazione con quel pro.
  archiviata: 409,
};

const errore = (stato: 401 | 403 | 404 | 409 | 500, motivo: string, error: string): EsitoRisposta => ({
  stato,
  corpo: { error, motivo },
});

export async function rispondiProposta(
  supabase: SupabaseClient,
  userId: string,
  appointmentId: string,
  risposta: Risposta
): Promise<EsitoRisposta> {
  // Un id che non e' un uuid farebbe fallire la chiamata (22P02): e' un 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentId)) {
    return errore(404, "non_trovato", "Appuntamento non trovato");
  }

  const { data, error } = await supabase.rpc("rispondi_proposta", {
    p_id: appointmentId,
    p_ok: risposta === "conferma",
  });
  if (error) {
    const stato = STATO_PER_MOTIVO[error.hint ?? ""];
    if (stato) return errore(stato, error.hint as string, error.message);
    if (error.code === "28000") return errore(401, "non_autenticato", "Non autenticato");
    console.error(`[risposta] rispondi_proposta(${appointmentId}, ${risposta}):`, error.code, error.message);
    return errore(500, "salvataggio", "Non sono riuscito a salvare. Riprova.");
  }

  const esito = data as {
    gia_fatto: boolean;
    status: "confirmed" | "declined";
    request_id: string;
    professional_id: string;
  };

  // La notifica al pro (email: spenta per scelta, vedi src/lib/email.ts).
  // Solo per una risposta nuova: ripetere non avvisa due volte.
  if (!esito.gia_fatto) {
    try {
      await notificaEvento({
        userId,
        event: risposta === "conferma" ? "appointment_confirmed" : "appointment_declined",
        requestId: esito.request_id,
        professionalId: esito.professional_id,
      });
    } catch {
      // notifica non critica
    }
  }

  return {
    stato: 200,
    corpo: { ok: true, status: esito.status, giaFatto: esito.gia_fatto, messaggio: !esito.gia_fatto },
  };
}
