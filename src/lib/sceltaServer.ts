// SCEGLI E RIAPRI: IL PEZZO COMUNE DELLE DUE ROUTE (15/10, PR 7).
//
// /api/richieste/[id]/scegli e /riapri fanno le stesse quattro cose prima di
// scrivere: chi e' l'utente, il corpo, la richiesta e' sua, il pro e' un
// uuid. Poi chiamano la loro funzione del database (migrazione 120), che
// ricontrolla tutto e scrive in UNA transazione: o tutto o niente.
//
// Il service role serve solo li': le due funzioni non le puo' eseguire
// nessun utente, cosi' nessuno le chiama saltando il controllo della
// sessione che fa questa route.

import { NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { readBodyWithLimit } from "@/lib/rate-limit";
import { sembraUnId } from "@/lib/richiestaCliente";
import { statoRifiuto, testoRifiuto } from "@/lib/scelta";

/** Il corpo e' { professionalId }: qualche decina di byte. */
const MAX_CORPO = 1024;

export type Preparata =
  | { ok: true; admin: SupabaseClient; userId: string; requestId: string; professionalId: string }
  | { ok: false; risposta: NextResponse };

function errore(status: number, testo: string): { ok: false; risposta: NextResponse } {
  return { ok: false, risposta: NextResponse.json({ error: testo }, { status }) };
}

export async function preparaScelta(request: Request, requestId: string): Promise<Preparata> {
  const letto = await readBodyWithLimit(request, MAX_CORPO);
  if (!letto.ok) return errore(413, "Richiesta troppo grande.");
  let professionalId: unknown;
  try {
    professionalId = (JSON.parse(letto.text || "{}") as { professionalId?: unknown }).professionalId;
  } catch {
    return errore(400, "Body non valido");
  }
  if (typeof professionalId !== "string" || !sembraUnId(professionalId) || !sembraUnId(requestId)) {
    return errore(400, "Parametri mancanti");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errore(401, "Non autenticato");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return errore(500, "Config mancante");
  const admin = createServiceClient(url, serviceKey);

  // La richiesta deve essere del chiamante. La funzione del database lo
  // ricontrolla dentro la sua transazione; qui si risponde subito, senza
  // chiamarla per niente.
  const { data: req } = await admin
    .from("requests")
    .select("id, customer_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.customer_id !== user.id) return errore(404, testoRifiuto("non_trovata"));

  return { ok: true, admin, userId: user.id, requestId, professionalId };
}

/** Il nome che vede il cliente (065): l'attivita', poi la persona. */
export async function nomePro(admin: SupabaseClient, professionalId: string): Promise<string | null> {
  const { data: p } = await admin
    .from("professionals")
    .select("business_name, user_id")
    .eq("id", professionalId)
    .maybeSingle();
  if (!p) return null;
  const riga = p as { business_name: string | null; user_id: string | null };
  if (riga.business_name?.trim()) return riga.business_name.trim();
  if (!riga.user_id) return null;
  const { data: prof } = await admin
    .from("profiles")
    .select("full_name")
    .eq("user_id", riga.user_id)
    .maybeSingle();
  return (prof as { full_name: string | null } | null)?.full_name ?? null;
}

/** La risposta a un { ok: false, motivo } della funzione del database. */
export async function rifiuto(
  admin: SupabaseClient,
  esito: { motivo?: string; professionista?: string }
): Promise<NextResponse> {
  const motivo = esito.motivo ?? "errore";
  const nome = esito.professionista ? await nomePro(admin, esito.professionista) : null;
  return NextResponse.json(
    { error: testoRifiuto(motivo, nome), motivo },
    { status: statoRifiuto(motivo) }
  );
}
