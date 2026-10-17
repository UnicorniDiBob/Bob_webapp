// POST /api/conversazioni/da-leggere  { requestId, professionalId, valore }
//
// «DA LEGGERE» (15/10, migrazione 122). Segna o toglie il PROPRIO segno su una
// conversazione: il cliente il suo, il pro il suo. E' una preferenza della
// propria casella: l'altra parte non vede niente e niente cambia per lei.
// La parte la decide il database da chi e' l'utente della sessione
// (segna_da_leggere), mai il corpo della richiesta; il service role serve
// solo li', perche' nessun utente puo' scrivere quei due campi da solo.

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { chiamante } from "@/lib/supabase/chiamante";
import { readBodyWithLimit } from "@/lib/rate-limit";
import { sembraUnId } from "@/lib/richiestaCliente";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const letto = await readBodyWithLimit(request, 1024);
  if (!letto.ok) return NextResponse.json({ error: "Richiesta troppo grande." }, { status: 413 });
  let corpo: { requestId?: unknown; professionalId?: unknown; valore?: unknown };
  try {
    corpo = JSON.parse(letto.text || "{}");
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }
  const { requestId, professionalId, valore } = corpo;
  if (
    typeof requestId !== "string" ||
    typeof professionalId !== "string" ||
    typeof valore !== "boolean" ||
    !sembraUnId(requestId) ||
    !sembraUnId(professionalId)
  ) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  const { user } = await chiamante(request);
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Config mancante" }, { status: 500 });
  const admin = createServiceClient(url, serviceKey);

  const { data, error } = await admin.rpc("segna_da_leggere", {
    p_richiesta: requestId,
    p_professionista: professionalId,
    p_utente: user.id,
    p_valore: valore,
  });
  if (error) {
    console.error("[conversazioni/da-leggere]", error.message);
    return NextResponse.json({ error: "Non è andata. Riprova fra poco." }, { status: 500 });
  }
  const esito = data as { ok: boolean; motivo?: string };
  if (!esito?.ok) {
    return NextResponse.json({ error: "Questa conversazione non è tua.", motivo: esito?.motivo }, { status: 404 });
  }
  return NextResponse.json({ ok: true, valore });
}
