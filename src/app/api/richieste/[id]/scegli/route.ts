// POST /api/richieste/[id]/scegli  { professionalId }
//
// IL CLIENTE SCEGLIE UN PRO (15/10, PR 7, migrazione 120). La richiesta
// registra il pro scelto; le conversazioni degli altri pro collegati vengono
// archiviate (leggono, non scrivono piu'), le loro proposte d'orario ancora
// aperte rifiutate, e ognuno riceve in chat da Bob «Il cliente ha chiuso
// questa richiesta.». Se il pro scelto era archiviato torna attivo e riceve
// «Il cliente ha riaperto la conversazione.».
//
// TUTTO IN UNA TRANSAZIONE: scegli_professionista() nel database. Qui solo
// chi e' l'utente e se la richiesta e' sua (sceltaServer.ts); i rifiuti —
// pro non collegato, che non ha risposto, un pro solo, richiesta chiusa,
// appuntamento confermato con un altro, scelta gia' bloccata — tornano dal
// database senza che niente sia stato scritto.
//
// Nessun tetto di frequenza: le altre route di scrittura del cliente
// (appointments/counter, /disdici, /sposta) non ne hanno, e il limite di
// frequenza della 097 accetta solo 'chat' e 'brief'. Il corpo si'.

import { NextResponse } from "next/server";
import { preparaScelta, rifiuto } from "@/lib/sceltaServer";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const p = await preparaScelta(request, params.id);
  if (!p.ok) return p.risposta;

  const { data, error } = await p.admin.rpc("scegli_professionista", {
    p_richiesta: p.requestId,
    p_cliente: p.userId,
    p_professionista: p.professionalId,
  });
  if (error) {
    console.error("[richieste/scegli]", error.message);
    return NextResponse.json({ error: "Non è andata. Riprova fra poco." }, { status: 500 });
  }
  const esito = data as { ok: boolean; motivo?: string; professionista?: string; archiviati?: string[] };
  if (!esito?.ok) return rifiuto(p.admin, esito ?? {});
  return NextResponse.json({ ok: true, archiviati: esito.archiviati ?? [] });
}
