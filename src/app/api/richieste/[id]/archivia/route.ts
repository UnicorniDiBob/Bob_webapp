// POST /api/richieste/[id]/archivia  { professionalId }
//
// IL CLIENTE ARCHIVIA UNA CONVERSAZIONE A MANO (15/10, PR 9, migrazione
// 121). Lo stesso effetto dell'archiviazione alla scelta: il pro legge e non
// scrive piu', le sue proposte aperte si rifiutano senza entrare nelle sue
// analisi, e riceve da Bob «Il cliente ha chiuso questa richiesta.» (dal
// 16/10, migrazione 124, solo se non e' gia' l'ultimo messaggio della chat:
// riarchiviare senza niente in mezzo e' silenzioso). Se era il pro scelto,
// la scelta si annulla e «Scegli» torna sugli altri. Bloccato solo da un
// appuntamento confermato e non ancora finito con lui. Si riapre con
// /riapri.
//
// Una transazione sola, archivia_conversazione() nel database; qui chi e'
// l'utente e se la richiesta e' sua (sceltaServer.ts), come /scegli e
// /riapri.

import { NextResponse } from "next/server";
import { preparaScelta, rifiuto } from "@/lib/sceltaServer";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const p = await preparaScelta(request, params.id);
  if (!p.ok) return p.risposta;

  const { data, error } = await p.admin.rpc("archivia_conversazione", {
    p_richiesta: p.requestId,
    p_cliente: p.userId,
    p_professionista: p.professionalId,
  });
  if (error) {
    console.error("[richieste/archivia]", error.message);
    return NextResponse.json({ error: "Non è andata. Riprova fra poco." }, { status: 500 });
  }
  const esito = data as { ok: boolean; motivo?: string; professionista?: string; scelta_annullata?: boolean };
  if (!esito?.ok) return rifiuto(p.admin, esito ?? {});
  return NextResponse.json({ ok: true, sceltaAnnullata: Boolean(esito.scelta_annullata) });
}
