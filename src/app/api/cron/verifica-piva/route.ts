// Il giro notturno della verifica: due passate, blocco 10.
//
//  1. RITENTATIVO (10.5) delle richieste rimaste senza risposta dal VIES.
//  2. RICONTROLLO ANNUALE (079) delle verifiche in scadenza.
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
import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { checkVatOnVies } from "@/lib/vies";
import { matchRegistryName, procedureFlagInName } from "@/lib/vat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quanti casi al massimo per giro: il VIES è un servizio pubblico, non nostro. */
const MAX_PER_RUN = 50;
/** Pausa tra una chiamata e l'altra, per non arrivare a raffica. */
const PAUSA_MS = 400;
/**
 * Quante notti insistere sullo stesso caso. Oltre, il silenzio del VIES non è
 * più un guasto passeggero: è la risposta, e la decisione torna a una persona.
 */
const MAX_RITENTATIVI = 5;
/** Non ritentare lo stesso caso due volte nello stesso giro di notte. */
const PAUSA_TRA_TENTATIVI_ORE = 20;

const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Registra il passaggio in system_job_runs (migrazione 049).
 *
 * Perche' serve: da quando la 043 fa uscire subito il giro a vuoto, dal
 * database non si distingue "ha girato e non aveva niente da fare" da "non ha
 * girato". E' esattamente il buco in cui e' rimasto nascosto per settimane un
 * CRON_SECRET mancante. Con questa riga "ha girato almeno una volta" e' una
 * query, non una deduzione.
 *
 * Nessun dato personale: nome del lavoro, orari, contatori aggregati.
 * Non deve mai far fallire il giro: se il registro non scrive, pazienza.
 */
async function registraGiro(
  // SupabaseClient, non ReturnType<typeof createServiceClient>: senza
  // argomenti di tipo il generico collassa e from() finisce a never[],
  // quindi l'insert non compilava. Il resto del progetto passa il client
  // inline e non incontra il problema.
  admin: SupabaseClient,
  dati: {
    started_at: string;
    ok: boolean;
    outcome?: Record<string, number>;
    error?: string | null;
  }
) {
  try {
    await admin.from("system_job_runs").insert({
      job: "verifica-piva",
      started_at: dati.started_at,
      finished_at: new Date().toISOString(),
      ok: dati.ok,
      outcome: dati.outcome ?? {},
      error: dati.error ?? null,
    });
  } catch {
    // volutamente silenzioso
  }
}

/** Quante verifiche in scadenza guardare per giro. */
const MAX_RICONTROLLI = 50;
/** Quanti giorni prima della scadenza il ricontrollo puo' partire. */
const ANTICIPO_GIORNI = 7;

/**
 * RICONTROLLO ANNUALE (079).
 *
 * Chi e' stato verificato DAL VIES si puo' ricontrollare da soli: se il
 * registro conferma ancora, la scadenza si sposta di un anno e nessuno tocca
 * niente. Se invece il VIES adesso NON conferma un numero che prima
 * confermava, quello e' un segnale vero — non il rumore di fondo — e il caso
 * va a una persona.
 *
 * Chi e' stato verificato da una PERSONA non si richiama affatto: il VIES
 * risponde solo per chi e' iscritto agli scambi intra-UE, cioe' la minoranza,
 * e per tutti gli altri un "non risulta" non vuol dire niente. Chiamarlo lo
 * stesso produrrebbe una coda di falsi allarmi. Quelle righe entrano in
 * ricontrollo per scadenza e le rifa' una persona.
 *
 * Qui NON si declassa nessuno: il livello resta, cambia solo lo stato.
 */
async function ricontrollaScadute(admin: SupabaseClient) {
  const soglia = new Date(
    Date.now() + ANTICIPO_GIORNI * 24 * 3600 * 1000
  ).toISOString();

  const { data, error } = await admin
    .from("professional_verification")
    .select(
      "professional_id, vat_number, declared_business_name, vat_check_source, vat_expires_at"
    )
    .in("level", ["vat_verified", "documents_verified"])
    .is("vat_review_state", null)
    .not("vat_expires_at", "is", null)
    .lte("vat_expires_at", soglia)
    .order("vat_expires_at", { ascending: true })
    .limit(MAX_RICONTROLLI);

  if (error || !data || data.length === 0) {
    return { guardate: 0, rinnovate: 0, inRicontrollo: 0 };
  }

  const righe = data as {
    professional_id: string;
    vat_number: string | null;
    declared_business_name: string | null;
    vat_check_source: string | null;
    vat_expires_at: string | null;
  }[];

  let rinnovate = 0;
  let inRicontrollo = 0;

  const apriRicontrollo = async (
    id: string,
    motivo: string,
    nota: string,
    evento: string
  ) => {
    const adesso = new Date().toISOString();
    await admin
      .from("professional_verification")
      .update({
        vat_review_state: "recheck",
        recheck_reason: motivo,
        recheck_opened_at: adesso,
        updated_at: adesso,
      })
      .eq("professional_id", id);
    await admin.from("verification_events").insert({
      professional_id: id,
      event: evento,
      note: nota,
      actor_name: "Ricontrollo automatico",
      actor_role: "system",
    });
    inRicontrollo++;
  };

  for (const r of righe) {
    // Verificato da una persona, o senza numero da richiamare: il VIES qui non
    // aggiunge informazione. Va a una persona, con il motivo "scadenza".
    if (r.vat_check_source !== "vies" || !r.vat_number) {
      await apriRicontrollo(
        r.professional_id,
        "scadenza",
        "Verifica arrivata a scadenza. Il riscontro originale non veniva dal VIES, quindi il controllo automatico non puo' rifarlo: lo rifa' una persona.",
        "vat_recheck_opened"
      );
      continue;
    }

    const esito = await checkVatOnVies(r.vat_number);
    const adesso = new Date().toISOString();

    // Servizio giu': non e' un segnale. Si riprova domani, la riga resta
    // com'e' (la scadenza e' gia' passata o sta per passare: un giorno in piu'
    // non cambia niente, un falso allarme si').
    if (esito.status === "unavailable") {
      await attendi(PAUSA_MS);
      continue;
    }

    const snap = esito.snapshot;
    const procedura = procedureFlagInName(snap.name);
    const match = matchRegistryName(snap.name, {
      profileName: null,
      declaredName: r.declared_business_name,
    });

    if (esito.status === "confirmed" && !procedura) {
      // Conferma piena: la scadenza si sposta di un anno e non disturbiamo
      // nessuno. L'intestazione che non torna piu' non rinnova da sola.
      if (match) {
        const nuova = new Date();
        nuova.setFullYear(nuova.getFullYear() + 1);
        await admin
          .from("professional_verification")
          .update({
            vat_active: true,
            vat_holder_name: snap.name,
            vat_checked_at: snap.requestDate ?? adesso,
            vat_check_payload: snap,
            vat_expires_at: nuova.toISOString(),
            updated_at: adesso,
          })
          .eq("professional_id", r.professional_id);
        await admin.from("verification_events").insert({
          professional_id: r.professional_id,
          event: "vat_check_ok",
          note: `Ricontrollo annuale: il VIES conferma ancora la partita IVA, intestata a "${snap.name}". Verifica valida per un altro anno.`,
          actor_name: "Ricontrollo automatico",
          actor_role: "system",
        });
        rinnovate++;
        await attendi(PAUSA_MS);
        continue;
      }
      await apriRicontrollo(
        r.professional_id,
        "intestazione",
        `Ricontrollo annuale: partita IVA ancora valida ma intestata a "${
          snap.name ?? "intestatario non restituito"
        }", che non corrisponde piu'. Decide una persona.`,
        "vat_recheck_opened"
      );
      await attendi(PAUSA_MS);
      continue;
    }

    if (esito.status === "confirmed" && procedura) {
      await apriRicontrollo(
        r.professional_id,
        "procedura",
        `Ricontrollo annuale: partita IVA attiva ma la denominazione "${snap.name}" segnala una procedura in corso (${procedura}). Decide una persona.`,
        "vat_recheck_opened"
      );
      await attendi(PAUSA_MS);
      continue;
    }

    // Il VIES aveva confermato questo numero e adesso non lo conferma piu':
    // questo si' che e' un segnale. Non declassiamo: apriamo il caso.
    await apriRicontrollo(
      r.professional_id,
      "cessazione",
      "Ricontrollo annuale: il VIES aveva confermato questa partita IVA e adesso non la conferma piu'. Possibile cessazione: da guardare a mano prima di toccare il livello.",
      "vat_recheck_opened"
    );
    await attendi(PAUSA_MS);
  }

  return { guardate: righe.length, rinnovate, inRicontrollo };
}

export async function GET(request: Request) {
  const inizioGiro = new Date().toISOString();
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

  // PRIMA il ricontrollo annuale, e prima anche dell'uscita a vuoto qui sotto:
  // le notti in cui non c'e' niente in coda sono la maggioranza, ed e'
  // esattamente in quelle che le verifiche scadute vanno guardate. Se sta
  // dopo il return, gira quasi mai.
  const ric = await ricontrollaScadute(admin);

  // I casi da riprendere sono quelli in cui il controllo non è mai avvenuto:
  // vat_check_source resta null solo nel ramo "servizio irraggiungibile".
  // Chi è stato esaminato da una persona (docs_requested, rejected) non si
  // tocca: una macchina non riapre una decisione umana.
  // Chi ha già esaurito i tentativi non si tocca più, e chi è stato ritentato
  // poche ore fa nemmeno: se non è cambiato niente, rifare la stessa chiamata
  // non produce informazione, produce solo traffico.
  const sogliaRitentativo = new Date(
    Date.now() - PAUSA_TRA_TENTATIVI_ORE * 3600 * 1000
  ).toISOString();

  const { data: daRiprendere, error: readError } = await admin
    .from("professional_verification")
    .select(
      "professional_id, vat_number, declared_business_name, vat_retry_count"
    )
    .eq("vat_review_state", "pending")
    .eq("level", "none")
    .is("vat_check_source", null)
    .not("vat_number", "is", null)
    .lt("vat_retry_count", MAX_RITENTATIVI)
    .or(`vat_last_retry_at.is.null,vat_last_retry_at.lt.${sogliaRitentativo}`)
    .order("updated_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const casi = (daRiprendere ?? []) as {
    professional_id: string;
    vat_number: string;
    declared_business_name: string | null;
    vat_retry_count: number;
  }[];

  // Niente in attesa: si esce subito, senza contattare nessuno. È il caso
  // normale nella maggior parte delle notti.
  if (casi.length === 0) {
    // Il giro a vuoto e' il caso normale, ed e' proprio quello che prima non
    // lasciava traccia: la riga si scrive comunque.
    await registraGiro(admin, {
      started_at: inizioGiro,
      ok: true,
      outcome: {
        esaminati: 0,
        scadenze_guardate: ric.guardate,
        rinnovate: ric.rinnovate,
        in_ricontrollo: ric.inRicontrollo,
      },
    });
    return NextResponse.json({
      ok: true,
      esaminati: 0,
      ricontrollo: ric,
      nota: "Niente in attesa di un ritentativo.",
    });
  }

  let confermati = 0;
  let daEsaminare = 0;
  let ancoraGiu = 0;

  for (const caso of casi) {
    const esito = await checkVatOnVies(caso.vat_number);
    const adesso = new Date().toISOString();

    if (esito.status === "unavailable") {
      // Il servizio è ancora giù: si riprova domani. Segniamo però il
      // tentativo, altrimenti insisteremmo all'infinito su un caso che il VIES
      // non sa chiudere; all'ultimo tentativo lo diciamo nel registro, così chi
      // apre la coda sa che la macchina ha smesso di provarci.
      const tentativi = caso.vat_retry_count + 1;
      await admin
        .from("professional_verification")
        .update({ vat_retry_count: tentativi, vat_last_retry_at: adesso })
        .eq("professional_id", caso.professional_id);

      if (tentativi >= MAX_RITENTATIVI) {
        await admin.from("verification_events").insert({
          professional_id: caso.professional_id,
          event: "vat_check_failed",
          note: `Il servizio europeo non ha risposto per ${MAX_RITENTATIVI} notti di seguito: i ritentativi automatici si fermano qui, il caso resta da esaminare a mano.`,
          actor_name: "Ritentativo automatico",
          actor_role: "system",
        });
      }

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
    // Procedura in corso: la partita IVA resta attiva ma la decisione è umana.
    const procedura = procedureFlagInName(snap.name);

    const base = {
      vat_active: esito.status === "confirmed",
      vat_holder_name: snap.name,
      vat_checked_at: snap.requestDate ?? adesso,
      vat_check_source: "vies",
      vat_check_payload: snap,
      vat_retry_count: caso.vat_retry_count + 1,
      vat_last_retry_at: adesso,
      updated_at: adesso,
    };

    if (esito.status === "confirmed" && matchSource && !procedura) {
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
          esito.status === "confirmed" && procedura
            ? `Ritentativo notturno: partita IVA attiva ma la denominazione "${snap.name}" segnala una procedura in corso (${procedura}): decisione umana.`
            : esito.status === "confirmed"
            ? `Ritentativo notturno: partita IVA valida ma intestata a "${
                snap.name ?? "intestatario non restituito"
              }", da attribuire a mano.`
            : "Ritentativo notturno: il VIES non ha confermato la partita IVA. Da esaminare.",
        // nota: se c'era una procedura in corso lo dice il ramo qui sopra
        actor_name: "Ritentativo automatico",
        actor_role: "system",
      });
      daEsaminare++;
    }

    await attendi(PAUSA_MS);
  }

  // La riga si scrive SEMPRE, anche quando il giro ha lavorato: mancava, e
  // senza di lei dal database non si distingue un giro pieno da un giro che
  // non e' partito — che e' il buco in cui era rimasto nascosto per settimane
  // un CRON_SECRET mancante.
  await registraGiro(admin, {
    started_at: inizioGiro,
    ok: true,
    outcome: {
      esaminati: casi.length,
      confermati,
      da_esaminare: daEsaminare,
      ancora_giu: ancoraGiu,
      scadenze_guardate: ric.guardate,
      rinnovate: ric.rinnovate,
      in_ricontrollo: ric.inRicontrollo,
    },
  });

  return NextResponse.json({
    ok: true,
    esaminati: casi.length,
    confermati,
    daEsaminare,
    ancoraGiu,
    ricontrollo: ric,
  });
}
