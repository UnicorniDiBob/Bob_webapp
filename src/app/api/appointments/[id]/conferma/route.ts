// POST /api/appointments/[id]/conferma
// Il cliente conferma una proposta d'orario del professionista.
// Il lavoro e' in src/lib/rispostaProposta.ts, lo stesso per /conferma e
// /rifiuta, per il sito (cookie) e per l'app (Bearer): stato e messaggio in
// chat in una transazione sola (rispondi_proposta, 132), poi la notifica.
//
// Risposte: 200 { ok, status, giaFatto, messaggio }; 401 senza login;
// 404 «non_trovato»; 403 «non_cliente»; 409 «non_proposta» | «proposta_tua» |
// «scaduta»; 500. Ripetere la stessa risposta da' 200 con giaFatto: true e
// non scrive niente.

import { NextResponse } from "next/server";
import { chiamante } from "@/lib/supabase/chiamante";
import { rispondiProposta } from "@/lib/rispostaProposta";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await chiamante(request);
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { stato, corpo } = await rispondiProposta(supabase, user.id, params.id, "conferma");
  return NextResponse.json(corpo, { status: stato });
}
