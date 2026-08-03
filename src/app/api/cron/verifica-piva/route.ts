// Ritentativo notturno delle verifiche rimaste senza risposta (blocco 10, 10.5).
//
// GET /api/cron/verifica-piva  — la chiama Vercel una volta al giorno.
//
// Perché di notte e non subito: quando il VIES non risponde il caso resta in
// coda, e finché nessuno riprova occupa il tempo di una persona per un guasto
// che non è nostro né del professionista. Un solo giro a fine giornata evita
// di martellare un servizio pubblico che magari è in difficoltà proprio adesso,
// e al mattino lo staff trova la coda già sfoltita.
//
// Cosa NON fa: non rifiuta e non declassa nessuno. Può solo concedere il
// livello quando il riscontro è pieno (numero valido E intestazione che
// corrisponde), oppure lasciare il caso dov'è. Ogni altra decisione resta
// umana — è la stessa regola della route del professionista.
//
// Protezione: Vercel invia l'header Authorization con CRON_SECRET. Senza quel
// segreto configurato la route rifiuta di lavorare: meglio un ritentativo che
// non parte di un endpoint che chiunque può innescare.
//
// Orario: in vercel.json è "0 22 * * *", e i cron di Vercel vanno a UTC. In ora
// legale sono le 24:00 italiane; d'inverno diventano le 23:00. Va bene lo
// stesso — quello che conta è che giri a giornata finita — ma se un domani
// l'orario dovesse essere esatto, la strada è far partire il cron ogni ora e
// uscire subito quando in Italia non è mezzanotte.

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { checkVatOnVies } from "@/lib/vies";
import { matchRegistryName } from "@/lib/vat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quanti casi al massimo per giro: il VIES è un servizio pubblico, non nostro. */
const MAX_PER_RUN = 50;
/** Pausa tra una chiamata e l'altra, per non arrivare a raffica. */
const PAUSA_MS = 400;

const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET non configurato: il ritentativo resta spento." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Servizio di verifica non configurato" },
      { status: 503 }
    );
  }
  const admin = createServiceClient(url, serviceKey);

  // I casi da riprendere sono quelli in cui il controllo non è mai avvenuto:
  // vat_check_source resta null solo nel ramo "servizio irraggiungibile".
  // Chi è stato esaminato da una persona (docs_requested, rejected) non si
  // tocca: una macchina non riapre una decisione umana.
  const { data: daRiprendere, error: readError } = await admin
    .from("professional_verification")
    .select("professional_id, vat_number, declared_business_name")
    .eq("vat_review_state", "pending")
    .eq("level", "none")
    .is("vat_check_source", null)
    .not("vat_number", "is", null)
    .order("updated_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const casi = (daRiprendere ?? []) as {
    professional_id: string;
    vat_number: string;
    declared_business_name: string | null;
  }[];

  let confermati = 0;
  let daEsaminare = 0;
  let ancoraGiu = 0;

  for (const caso of casi) {
    const esito = await checkVatOnVies(caso.vat_number);
    const adesso = new Date().toISOString();

    if (esito.status === "unavailable") {
      // Il servizio è ancora giù: si riprova domani, senza toccare niente.
      ancoraGiu++;
      await attendi(PAUSA_MS);
      continue;
    }

    const snap = esito.snapshot;

    // Nome sul profilo, per decidere se il riscontro è pieno.
    const { data: pro } = await admin
      .from("professionals")
      .select("user_id")
      .eq("id", caso.professional_id)
      .maybeSingle();
    const proUserId = (pro as { user_id: string } | null)?.user_id ?? null;
    let nomeProfilo: string | null = null;
    if (proUserId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("user_id", proUserId)
        .maybeSingle();
      nomeProfilo =
        (profile as { full_name: string | null } | null)?.full_name ?? null;
    }
    // Stesso confronto della route del professionista: tutti i nomi che
    // conosciamo, e teniamo da conto quale ha deciso.
    const matchSource = matchRegistryName(snap.name, {
      profileName: nomeProfilo,
      declaredName: caso.declared_business_name,
    });

    const base = {
      vat_active: esito.status === "confirmed",
      vat_holder_name: snap.name,
      vat_checked_at: snap.requestDate ?? adesso,
      vat_check_source: "vies",
      vat_check_payload: snap,
      updated_at: adesso,
    };

    if (esito.status === "confirmed" && matchSource) {
      // Riscontro pieno: il livello si concede, come farebbe la route del pro.
      await admin
        .from("professional_verification")
        .update({
          ...base,
          level: "vat_verified",
          vat_match_source: matchSource,
          vat_review_state: null,
          vat_review_note: null,
        })
        .eq("professional_id", caso.professional_id);

      await admin.from("verification_events").insert([
        {
          professional_id: caso.professional_id,
          event: "vat_check_ok",
          note: `Ritentativo notturno: confermata dal VIES e intestata a "${snap.name}", coerente col ${
            matchSource === "declared_name"
              ? "nome dichiarato dal professionista (da ricontrollare a campione)"
              : "nome del profilo"
          }.`,
          actor_name: "Ritentativo automatico",
          actor_role: "system",
        },
        {
          professional_id: caso.professional_id,
          event: "level_granted",
          from_level: "none",
          to_level: "vat_verified",
          note: "Concesso dal ritentativo notturno dopo che il VIES era risultato irraggiungibile.",
          actor_name: "Ritentativo automatico",
          actor_role: "system",
        },
      ]);
      confermati++;
    } else {
      // Il VIES ha risposto ma il caso non si chiude da solo: resta in coda,
      // però ora l'operatore sa cosa ha detto il registro.
      await admin
        .from("professional_verification")
        .update({ ...base, vat_review_state: "pending" })
        .eq("professional_id", caso.professional_id);

      await admin.from("verification_events").insert({
        professional_id: caso.professional_id,
        event: esito.status === "confirmed" ? "vat_check_ok" : "vat_check_failed",
        note:
          esito.status === "confirmed"
            ? `Ritentativo notturno: partita IVA valida ma intestata a "${
                snap.name ?? "intestatario non restituito"
              }", da attribuire a mano.`
            : "Ritentativo notturno: il VIES non ha confermato la partita IVA. Da esaminare.",
        actor_name: "Ritentativo automatico",
        actor_role: "system",
      });
      daEsaminare++;
    }

    await attendi(PAUSA_MS);
  }

  return NextResponse.json({
    ok: true,
    esaminati: casi.length,
    confermati,
    daEsaminare,
    ancoraGiu,
  });
}
