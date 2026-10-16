// LA RICHIESTA CHIUSA (E RIAPERTA), NELLA CAMPANELLA DEL PRO (15/10, PR 8).
//
// Quando il cliente sceglie un altro professionista, la conversazione di
// questo pro viene archiviata (migrazione 120) e in chat compare la nota di
// Bob «Il cliente ha chiuso questa richiesta.». Chi non apriva quella chat non
// lo sapeva: la richiesta spariva da «Nuove richieste» e basta. Qui diventa
// una voce sola, quieta («fatto»), della campanella; e una seconda quando il
// cliente la riapre.
//
// E' LA TERZA ECCEZIONE DI lib/notifiche.ts, nello stesso spirito degli
// appuntamenti (113): non e' un messaggio fra persone, e' un FATTO del lavoro
// del pro, e resta derivato da righe che esistono gia'. Nessuna tabella.
//
// LA FONTE SONO LE NOTE DI BOB, non request_professionals.archived_at.
// archived_at dice solo lo stato di adesso e l'ULTIMA volta: dopo
// archivia → riapri → archivia ricorderebbe un evento solo, e la riapertura
// in mezzo non lascerebbe traccia. Le note invece sono una riga per evento,
// ognuna col suo id e la sua ora, scritte nella stessa transazione che cambia
// lo stato (scegli_professionista / riapri_conversazione): una voce per
// evento, id stabile (cosi' «letto» regge), e la sequenza intera resta vera.
//
// DAL 16/10 RIAPRIRE E' SILENZIOSO (migrazione 123): non si scrivono piu'
// note «riaperta», quindi non arrivano piu' voci «Il cliente ha riaperto la
// richiesta». Quelle gia' nel database restano e si leggono come prima.
//
// NON DICE MAI CHI E' STATO SCELTO (decisione 4). Le parole sono sempre «il
// cliente ha chiuso / riaperto»: il nome dell'altro pro e' un'informazione
// commerciale che a questo pro non serve, e sapere di aver «perso» contro
// qualcuno in particolare non cambia niente di quello che puo' fare.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Notifica } from "@/lib/notifiche";
import { BOB_CHIUSA, BOB_RIAPERTA } from "@/lib/scelta";

/** Le note di Bob di quanti giorni fa entrano nella campanella. */
const GIORNI = 30;

export interface NotaDiBob {
  id: string;
  request_id: string;
  professional_id: string;
  message: string;
  created_at: string;
  /** Il servizio della richiesta: «Imbianchino». */
  servizio: string | null;
}

/** Le note di Bob di questo pro, diventate voci della campanella. */
export function notificheDaNoteDiBob(note: NotaDiBob[]): Notifica[] {
  const out: Notifica[] = [];
  for (const n of note) {
    const chiusa = n.message === BOB_CHIUSA;
    const riaperta = n.message === BOB_RIAPERTA;
    if (!chiusa && !riaperta) continue;
    const servizio = n.servizio?.trim() || "la tua richiesta";
    out.push({
      id: `richiesta-${chiusa ? "chiusa" : "riaperta"}:${n.id}`,
      livello: "fatto",
      titolo: `Il cliente ha ${chiusa ? "chiuso" : "riaperto"} la richiesta · ${servizio}`,
      testo: chiusa
        ? "Puoi rileggere la conversazione, ma non scriverci più."
        : "Puoi scrivere di nuovo al cliente nella stessa conversazione.",
      href: `/messaggi?r=${n.request_id}&p=${n.professional_id}`,
      azione: "Apri la conversazione",
      quando: n.created_at,
      mittente: "Bob",
    });
  }
  return out;
}

/** Legge le note di Bob degli ultimi 30 giorni sulle conversazioni del pro. */
export async function caricaNotificheChiusure(
  supabase: SupabaseClient,
  professionalId: string
): Promise<Notifica[]> {
  const dal = new Date(Date.now() - GIORNI * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("request_messages")
    .select("id, request_id, professional_id, message, created_at, requests ( services ( name ) )")
    .eq("professional_id", professionalId)
    .eq("sender_type", "bob")
    .gte("created_at", dal)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[notifiche] note di Bob:", error);
    return [];
  }
  return notificheDaNoteDiBob(
    ((data ?? []) as unknown as Array<{
      id: string;
      request_id: string;
      professional_id: string;
      message: string;
      created_at: string;
      requests: { services: { name: string } | null } | null;
    }>).map((r) => ({
      id: r.id,
      request_id: r.request_id,
      professional_id: r.professional_id,
      message: r.message,
      created_at: r.created_at,
      servizio: r.requests?.services?.name ?? null,
    }))
  );
}
