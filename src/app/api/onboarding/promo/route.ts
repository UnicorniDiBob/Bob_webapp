// API: codici sconto in beta (blocco 12, in attesa di Stripe).
//
// COSA E' CAMBIATO IL 30/08 (migrazione 064). Prima il codice APPLICAVA un
// piano: riscattavi BOB-FOUNDER-2026 e uscivi Business, qualunque cosa avessi
// scelto due secondi prima. Adesso il codice porta uno SCONTO PER PIANO, i tre
// piani si vedono al prezzo scontato, e la scelta resta a chi si iscrive. Il
// server applica il piano scelto solo se, con gli sconti riscattati, quel
// piano costa ZERO: il pagamento non esiste ancora, e far scegliere un piano
// che andrebbe pagato sarebbe una promessa che il prodotto non mantiene.
//
// PERCHE' TUTTO QUI E NIENTE NEL CLIENT
// - promo_codes non ha nessuna policy per authenticated (solo staff): i codici
//   non sono leggibili ne' enumerabili dal browser. Quindi anche gli sconti si
//   leggono da qui, con il service role, e non con una join dal client — che
//   e' esattamente il motivo per cui /impostazioni/piano mostrava «Con il
//   codice —»: la join tornava null e nessuno se n'era accorto.
// - professionals.subscription_tier e' protetta dal trigger
//   protect_professional_columns: il client non puo' scriverla. Il service
//   role bypassa il trigger perche' per lui auth.uid() e' null.
//
// Azioni:
//   { action: "redeem", code }   convalida e registra il riscatto
//   { action: "stato" }          gli sconti attivi, i codici che li portano e
//                                la data dell'ultimo cambio di piano
//   { action: "scegli", piano }  applica il piano scelto, se costa zero
//
// POST /api/onboarding/promo

import { NextResponse } from "next/server";
import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/lib/supabase/types";
import {
  NESSUNO_SCONTO,
  costaZero,
  pianoById,
  type ScontiPerPiano,
} from "@/lib/piani";

const PIANI_VALIDI: SubscriptionTier[] = ["free", "pro", "business"];

interface CodiceAttivo {
  code: string;
  description: string | null;
  expiresAt: string | null;
  redeemedAt: string;
  sconti: ScontiPerPiano;
}

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

  let body: { action?: string; code?: string; piano?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  if (body.action === "redeem") {
    const code = (body.code ?? "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Inserisci un codice." }, { status: 400 });
    }

    const { data: promo } = await admin
      .from("promo_codes")
      .select(
        "id, grants_tier, active, max_uses, used_count, expires_at, discount_free_pct, discount_pro_pct, discount_business_pct"
      )
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

    // Il vincolo unique rende l'operazione idempotente: ripremere il bottone
    // non consuma un secondo uso. Il contatore used_count lo tiene allineato
    // il trigger della 060, non questa route.
    const { error: redErr } = await admin
      .from("promo_redemptions")
      .insert({ promo_code_id: promo.id, user_id: user.id });
    if (redErr && !/duplicate key/i.test(redErr.message)) {
      return NextResponse.json({ error: "Riscatto non riuscito." }, { status: 500 });
    }

    const stato = await leggiStato(admin, user.id);
    return NextResponse.json({
      ok: true,
      code,
      consigliato: (promo.grants_tier as SubscriptionTier) ?? null,
      ...stato,
    });
  }

  // -------------------------------------------------------------------------
  if (body.action === "stato") {
    // ATTIVO DAL: si legge da qui, con il service role, per lo stesso motivo
    // dei codici. subscription_tier_events (migrazione 025) ha una sola policy
    // di select ed e' per admin e cs; /impostazioni/piano la interrogava dal
    // browser con la sessione del professionista, quindi non tornava mai una
    // riga e la data non si e' mai vista da quando la pagina esiste. Una riga
    // che manca non somiglia a un errore: e' esattamente come era passata
    // inosservata la join su promo_codes.
    const { data: pro } = await admin
      .from("professionals")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let attivoDal: string | null = null;
    if (pro) {
      const { data: ev } = await admin
        .from("subscription_tier_events")
        .select("changed_at")
        .eq("professional_id", pro.id)
        .order("changed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      attivoDal = (ev as { changed_at: string } | null)?.changed_at ?? null;
    }

    return NextResponse.json({
      ok: true,
      attivoDal,
      ...(await leggiStato(admin, user.id)),
    });
  }

  // -------------------------------------------------------------------------
  if (body.action === "scegli") {
    const piano = body.piano as SubscriptionTier | undefined;
    if (!piano || !PIANI_VALIDI.includes(piano)) {
      return NextResponse.json({ error: "Piano sconosciuto." }, { status: 400 });
    }

    const { data: pro } = await admin
      .from("professionals")
      .select("id, subscription_tier")
      .eq("user_id", user.id)
      .maybeSingle();
    // Nel percorso di iscrizione la riga nasce DOPO la scelta del piano: non
    // e' un errore, e' l'ordine dei passi. Si riproverà a questionario finito.
    if (!pro) {
      return NextResponse.json({ ok: true, applicato: null, motivo: "nessun profilo" });
    }

    const { sconti } = await leggiStato(admin, user.id);

    // LA REGOLA, in una riga: si può scegliere ciò che non costa niente.
    // Scendere è sempre concesso — nessuno deve restare su un piano perché
    // non riesce a uscirne.
    const scendeAFree = piano === "free";
    if (!scendeAFree && !costaZero(pianoById(piano), sconti)) {
      return NextResponse.json(
        {
          error:
            "Questo piano non è coperto dai tuoi codici: servirebbe un pagamento, e i pagamenti non sono ancora attivi.",
        },
        { status: 402 }
      );
    }

    if ((pro.subscription_tier as string) !== piano) {
      const { error } = await admin
        .from("professionals")
        .update({ subscription_tier: piano })
        .eq("id", pro.id);
      if (error) {
        return NextResponse.json(
          { error: "Non sono riuscito ad applicare il piano." },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ ok: true, applicato: piano });
  }

  return NextResponse.json({ error: "Azione sconosciuta" }, { status: 400 });
}

/**
 * Gli sconti di cui questa persona dispone davvero: il MIGLIORE per ciascun
 * piano fra tutti i codici riscattati ancora attivi e non scaduti.
 * Disattivare un codice da admin toglie lo sconto subito, come deve —
 * "possiamo sempre disattivarlo" (decisione del 14/08) deve restare vero.
 *
 * NOTA sul tipo: ReturnType<typeof createServiceClient> qui collassa i
 * generici e fa diventare from() `never` (lezione di M1) — serve SupabaseClient.
 */
async function leggiStato(
  admin: SupabaseClient,
  userId: string
): Promise<{ sconti: ScontiPerPiano; codici: CodiceAttivo[] }> {
  const { data: redemptions } = await admin
    .from("promo_redemptions")
    .select(
      "redeemed_at, promo_codes ( code, description, active, expires_at, discount_free_pct, discount_pro_pct, discount_business_pct )"
    )
    .eq("user_id", userId)
    .order("redeemed_at", { ascending: false });

  const sconti: ScontiPerPiano = { ...NESSUNO_SCONTO };
  const codici: CodiceAttivo[] = [];
  const adesso = new Date();

  for (const r of redemptions ?? []) {
    // Il tipo generato vede la join come array; a runtime con FK singola è un
    // oggetto. Normalizziamo entrambe le forme senza fidarci del cast.
    const raw = (r as { promo_codes: unknown }).promo_codes;
    const pcs = (Array.isArray(raw) ? raw : [raw]) as Array<{
      code: string;
      description: string | null;
      active: boolean;
      expires_at: string | null;
      discount_free_pct: number | null;
      discount_pro_pct: number | null;
      discount_business_pct: number | null;
    } | null>;

    for (const pc of pcs) {
      if (!pc?.active) continue;
      if (pc.expires_at && new Date(pc.expires_at) < adesso) continue;

      const suoi: ScontiPerPiano = {
        free: pc.discount_free_pct ?? 0,
        pro: pc.discount_pro_pct ?? 0,
        business: pc.discount_business_pct ?? 0,
      };
      for (const k of PIANI_VALIDI) {
        if (suoi[k] > sconti[k]) sconti[k] = suoi[k];
      }
      codici.push({
        code: pc.code,
        description: pc.description,
        expiresAt: pc.expires_at,
        redeemedAt: (r as { redeemed_at: string }).redeemed_at,
        sconti: suoi,
      });
    }
  }

  return { sconti, codici };
}
