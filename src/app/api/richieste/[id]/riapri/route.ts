// POST /api/richieste/[id]/riapri  { professionalId }
//
// IL CLIENTE RIAPRE UNA CONVERSAZIONE ARCHIVIATA (15/10, PR 7, migrazione
// 120). Il pro torna a poter scrivere e riceve in chat da Bob «Il cliente ha
// riaperto la conversazione.». La scelta non cambia: si riapre per parlare,
// non per scegliere. Una transazione sola, riapri_conversazione() nel
// database; qui chi e' l'utente e se la richiesta e' sua (sceltaServer.ts).

import { NextResponse } from "next/server";
import { preparaScelta, rifiuto } from "@/lib/sceltaServer";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const p = await preparaScelta(request, params.id);
  if (!p.ok) return p.risposta;

  const { data, error } = await p.admin.rpc("riapri_conversazione", {
    p_richiesta: p.requestId,
    p_cliente: p.userId,
    p_professionista: p.professionalId,
  });
  if (error) {
    console.error("[richieste/riapri]", error.message);
    return NextResponse.json({ error: "Non è andata. Riprova fra poco." }, { status: 500 });
  }
  const esito = data as { ok: boolean; motivo?: string };
  if (!esito?.ok) return rifiuto(p.admin, esito ?? {});
  return NextResponse.json({ ok: true });
}
