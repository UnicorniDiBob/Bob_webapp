// IL CLIENTE CONFERMA O RIFIUTA UNA PROPOSTA D'ORARIO: UNA STRADA SOLA (17/10).
//
// Fino al 17/10 lo faceva il browser, in tre punti (home del cliente,
// pagina della richiesta, biglietto in chat): cambiare lo stato, scrivere in
// chat cosa si e' deciso, avvisare il pro. L'app non poteva rifarlo uguale
// senza copiarne i testi. Adesso il lavoro e' qui, chiamato da
// POST /api/appointments/[id]/conferma e /rifiuta, per il sito (cookie) e
// per l'app (Bearer). Stessi tre passi, stesso ordine, stessi testi di
// src/lib/appuntamentoCliente.ts.
//
// GIRA CON LA SESSIONE DEL CLIENTE, non col service role: il trigger
// registra_evento_appuntamento scrive nello storico chi ha risposto
// (autore 'customer'), e appointments_customer_guard (031) resta l'ultima
// parola su cosa il cliente puo' cambiare. Col service role lo storico
// direbbe 'sistema' e la campanella del pro non vedrebbe niente.
//
// DUE VOLTE LA STESSA RISPOSTA NON FANNO DUE MESSAGGI. L'update vale solo se
// la riga e' ancora una proposta del pro (status = 'proposed' nel WHERE):
// due richieste insieme, una sola cambia la riga e solo quella scrive in chat
// e notifica. La seconda trova lo stato gia' cambiato e risponde «gia' fatto»
// senza scrivere niente.

import type { SupabaseClient } from "@supabase/supabase-js";
import { notificaEvento } from "@/lib/notificaEvento";

export type Risposta = "conferma" | "rifiuta";

export type EsitoRisposta =
  | { stato: 200; corpo: { ok: true; status: "confirmed" | "declined"; giaFatto: boolean; messaggio: boolean } }
  | { stato: 403 | 404 | 409 | 500; corpo: { error: string; motivo: string } };

/** «dom», «18», «10:00»: come fmtDayParts del browser, ma sempre in ora italiana. */
function partiData(iso: string) {
  const d = new Date(iso);
  const tz = { timeZone: "Europe/Rome" } as const;
  return {
    dow: d.toLocaleDateString("it-IT", { ...tz, weekday: "short" }).replace(".", ""),
    day: d.toLocaleDateString("it-IT", { ...tz, day: "numeric" }),
    time: d.toLocaleTimeString("it-IT", { ...tz, hour: "2-digit", minute: "2-digit" }),
  };
}

export function testoRisposta(risposta: Risposta, startsAt: string): string {
  const { dow, day, time } = partiData(startsAt);
  return risposta === "conferma"
    ? `Ho confermato l'appuntamento di ${dow} ${day} alle ${time}.`
    : `Non posso ${dow} ${day} alle ${time}: proponi un altro orario?`;
}

const errore = (stato: 403 | 404 | 409 | 500, motivo: string, error: string): EsitoRisposta => ({
  stato,
  corpo: { error, motivo },
});

export async function rispondiProposta(
  supabase: SupabaseClient,
  userId: string,
  appointmentId: string,
  risposta: Risposta
): Promise<EsitoRisposta> {
  const nuovo = risposta === "conferma" ? "confirmed" : "declined";
  // Un id che non e' un uuid farebbe fallire la query (22P02): e' un 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentId)) {
    return errore(404, "non_trovato", "Appuntamento non trovato");
  }

  // La RLS lascia leggere l'appuntamento solo alle due parti: chi non lo
  // vede riceve 404, senza sapere se esiste.
  const { data: appt, error: errAppt } = await supabase
    .from("appointments")
    .select("id, request_id, professional_id, starts_at, status, proposed_by")
    .eq("id", appointmentId)
    .maybeSingle();
  if (errAppt) {
    console.error(`[risposta] lettura di ${appointmentId}:`, errAppt);
    return errore(500, "lettura", "Non sono riuscito a leggere l'appuntamento. Riprova.");
  }
  const a = appt as {
    id: string;
    request_id: string | null;
    professional_id: string;
    starts_at: string;
    status: string;
    proposed_by: string;
  } | null;
  if (!a || !a.request_id) return errore(404, "non_trovato", "Appuntamento non trovato");

  // Solo il cliente della richiesta. Il pro vede la riga ma non risponde da
  // qui: per lui ci sono il calendario e il biglietto in chat.
  const { data: req } = await supabase
    .from("requests")
    .select("customer_id")
    .eq("id", a.request_id)
    .maybeSingle();
  if ((req as { customer_id: string } | null)?.customer_id !== userId) {
    return errore(403, "non_cliente", "Solo il cliente può rispondere a questa proposta");
  }

  // La stessa risposta ripetuta: niente da fare, niente da riscrivere.
  if (a.status === nuovo) {
    return { stato: 200, corpo: { ok: true, status: nuovo, giaFatto: true, messaggio: false } };
  }
  if (a.status !== "proposed") {
    return errore(409, "non_proposta", "Questo appuntamento non aspetta più una risposta");
  }
  // Una proposta del cliente aspetta il pro, non il cliente.
  if (a.proposed_by !== "professional") {
    return errore(409, "proposta_tua", "Questa proposta l'hai fatta tu: aspetta la risposta del professionista");
  }
  if (new Date(a.starts_at).getTime() <= Date.now()) {
    return errore(409, "scaduta", "Questo orario è già passato: chiedi al professionista un altro orario");
  }

  // 1. Lo stato. Il WHERE sullo stato rende la risposta una volta sola.
  const { data: cambiate, error: errUpd } = await supabase
    .from("appointments")
    .update({ status: nuovo })
    .eq("id", a.id)
    .eq("status", "proposed")
    .eq("proposed_by", "professional")
    .select("id, status");
  if (errUpd) {
    console.error(`[risposta] ${risposta} di ${a.id}:`, errUpd);
    return errore(500, "salvataggio", "Non sono riuscito a salvare. Riprova.");
  }
  const riga = (cambiate ?? [])[0] as { id: string; status: string } | undefined;
  if (!riga) {
    // Un'altra richiesta e' arrivata prima: rileggo per dire cosa e' successo.
    const { data: ora } = await supabase
      .from("appointments")
      .select("status")
      .eq("id", a.id)
      .maybeSingle();
    if ((ora as { status: string } | null)?.status === nuovo) {
      return { stato: 200, corpo: { ok: true, status: nuovo, giaFatto: true, messaggio: false } };
    }
    return errore(409, "non_proposta", "Questo appuntamento non aspetta più una risposta");
  }
  if (riga.status !== nuovo) {
    // Un trigger l'ha portata altrove: non scriviamo in chat una cosa falsa.
    console.error(`[risposta] ${a.id}: chiesto ${nuovo}, il database ha scritto ${riga.status}`);
    return errore(409, "non_proposta", "Questo appuntamento non aspetta più una risposta");
  }

  // 2. Il messaggio in chat, a nome del cliente.
  const { error: errMsg } = await supabase.from("request_messages").insert({
    request_id: a.request_id,
    professional_id: a.professional_id,
    sender_id: userId,
    sender_type: "customer",
    message: testoRisposta(risposta, a.starts_at),
    kind: "text",
    appointment_id: null,
  });
  if (errMsg) console.error(`[risposta] messaggio per ${a.id}:`, errMsg);

  // 3. La notifica al pro (email: spenta per scelta, vedi src/lib/email.ts).
  try {
    await notificaEvento({
      userId,
      event: risposta === "conferma" ? "appointment_confirmed" : "appointment_declined",
      requestId: a.request_id,
      professionalId: a.professional_id,
    });
  } catch {
    // notifica non critica
  }

  return { stato: 200, corpo: { ok: true, status: nuovo, giaFatto: false, messaggio: !errMsg } };
}
