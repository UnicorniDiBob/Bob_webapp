// API: riscatto codice promo in beta (blocco 12, in attesa di Stripe).
//
// PERCHÉ ESISTE
// Il checkout non c'è ancora (M7/12.1): in betatesting l'accesso ai piani a
// pagamento passa da un codice promo, assegnato da noi e revocabile da admin
// (decisione di Lucio, 14/08). La convalida sta TUTTA qui, server-side:
// - i codici non sono leggibili dal client (nessuna policy per authenticated),
//   quindi non sono enumerabili;
// - il tier è protetto dal trigger protect_professional_columns, che il
//   service role bypassa (auth.uid() è null per il service role).
//
// Due azioni:
// - redeem {code}: convalida e registra il riscatto; applica il tier se la
//   riga professionals esiste già.
// - sync: applica il miglior tier già riscattato alla riga professionals —
//   serve perché nel flusso di onboarding il codice si inserisce PRIMA del
//   questionario che crea la riga.
//
// POST /api/onboarding/promo  Body: { action: "redeem", code } | { action: "sync" }

import { NextResponse } from "next/server";
import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, business: 2 };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Config mancante" }, { status: 500 });
  }
  const admin = createServiceClient(url, serviceKey);

  let body: { action?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  if (body.action === "redeem") {
    const code = (body.code ?? "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Inserisci un codice." }, { status: 400 });
    }

    const { data: promo } = await admin
      .from("promo_codes")
      .select("id, grants_tier, active, max_uses, used_count, expires_at")
      .eq("code", code)
      .maybeSingle();

    // Un solo messaggio per tutti i casi negativi: non riveliamo se il codice
    // esiste, è scaduto o è disattivato — meno superficie per chi prova a caso.
    const invalid = NextResponse.json(
      { error: "Codice non valido o non più attivo." },
      { status: 400 }
    );
    if (!promo || !promo.active) return invalid;
    if (promo.expires_at && new Date(promo.expires_at as string) < new Date()) {
      return invalid;
    }
    if (
      promo.max_uses != null &&
      (promo.used_count as number) >= (promo.max_uses as number)
    ) {
      return invalid;
    }

    // Registra il riscatto; il vincolo unique rende l'operazione idempotente
    // (ripremere il bottone non consuma un secondo uso).
    const { error: redErr } = await admin
      .from("promo_redemptions")
      .insert({ promo_code_id: promo.id, user_id: user.id });
    if (redErr && !/duplicate key/i.test(redErr.message)) {
      return NextResponse.json({ error: "Riscatto non riuscito." }, { status: 500 });
    }
    if (!redErr) {
      await admin
        .from("promo_codes")
        .update({ used_count: (promo.used_count as number) + 1 })
        .eq("id", promo.id);
    }

    // Se la riga professionals esiste già, applica subito il tier.
    await applyBestTier(admin, user.id);

    return NextResponse.json({ ok: true, tier: promo.grants_tier });
  }

  if (body.action === "sync") {
    const applied = await applyBestTier(admin, user.id);
    return NextResponse.json({ ok: true, tier: applied });
  }

  return NextResponse.json({ error: "Azione sconosciuta" }, { status: 400 });
}

// Applica alla riga professionals il tier più alto fra quelli riscattati con
// codici ANCORA attivi: disattivare un codice da admin ferma i nuovi riscatti
// e le nuove sincronizzazioni, come da decisione ("possiamo sempre
// disattivarlo"). Ritorna il tier applicato, o null se non c'è riga/riscatti.
// NOTA sul tipo: ReturnType<typeof createServiceClient> qui collassa i
// generici e fa diventare from() `never` (lezione di M1) — serve SupabaseClient.
async function applyBestTier(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: redemptions } = await admin
    .from("promo_redemptions")
    .select("promo_codes ( grants_tier, active )")
    .eq("user_id", userId);

  // Il tipo generato vede la join come array; a runtime con FK singola è un
  // oggetto. Normalizziamo entrambe le forme senza fidarci del cast.
  let best: string | null = null;
  for (const r of redemptions ?? []) {
    const raw = (r as { promo_codes: unknown }).promo_codes;
    const pcs = (Array.isArray(raw) ? raw : [raw]) as {
      grants_tier: string;
      active: boolean;
    }[];
    for (const pc of pcs) {
      if (!pc?.active) continue;
      if (!best || TIER_RANK[pc.grants_tier] > TIER_RANK[best]) {
        best = pc.grants_tier;
      }
    }
  }
  if (!best) return null;

  const { data: pro } = await admin
    .from("professionals")
    .select("id, subscription_tier")
    .eq("user_id", userId)
    .maybeSingle();
  if (!pro) return null;

  if (TIER_RANK[best] > TIER_RANK[(pro.subscription_tier as string) ?? "free"]) {
    await admin
      .from("professionals")
      .update({ subscription_tier: best })
      .eq("id", pro.id);
  }
  return best;
}
