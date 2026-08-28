import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { creaZip } from "@/lib/zip";
import {
  INTERVALLO_EXPORT_MS,
  INTERVALLO_EXPORT_ORE,
  leggimi,
  raccogliDatiCliente,
} from "@/lib/export-dati";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/account/esporta — la copia dei propri dati, artt. 15 e 20 GDPR.
//
// PERCHE' UN DOWNLOAD DIRETTO E NON UN LAVORO IN CODA CON UN LINK VIA EMAIL
// Il secondo disegno e' quello che si trova in giro, ed e' giusto quando i dati
// sono tanti. Qui non lo sono, e soprattutto poggerebbe su una gamba che oggi
// non regge: la posta. Il mailer interno di Supabase manda 2 email all'ora per
// TUTTO il progetto, quindi un export "te lo mandiamo per email" e' un export
// che a volte non arriva — su un diritto che ha una scadenza di legge. Quando
// ci sara' l'SMTP dedicato e i dati saranno cresciuti, il lavoro in coda sara'
// la scelta giusta; oggi non lo e'.
//
// PERCHE' SERVICE ROLE E NON LA SESSIONE DELL'UTENTE
// Con il client dell'utente la RLS garantirebbe da sola che nessuno legga i
// dati di un altro, ed e' una bella proprieta'. Ma la RLS qui lavora contro
// l'obiettivo: nasconde a una persona alcune righe che la riguardano
// (city_waitlist e' leggibile solo dal service role) e un export deve essere
// COMPLETO, altrimenti stiamo rispondendo male a una richiesta di accesso.
// La regola che sostituisce la RLS e' una sola, e va tenuta d'occhio a ogni
// modifica: l'identita' viene SEMPRE da getUser() sui cookie, mai dal corpo o
// dai parametri della richiesta. Non c'e' nessun id in ingresso da manomettere.
//
// PERCHE' SOLO I CLIENTI, PER ORA
// I dati di un professionista vivono in una ventina di tabelle in piu'
// (verifica, documenti, abbonamento, pagamenti, disponibilita', portfolio) che
// stanno nel perimetro di Lucio. Consegnare a un pro un archivio che si
// intitola "i tuoi dati" e ne contiene meta' sarebbe peggio che non dargliene
// nessuno: e' una risposta formalmente data e sostanzialmente falsa. Quindi la
// rotta si ferma, lo dice chiaramente, e il blocco pro arriva nella sua PR.

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Devi essere autenticato." }, { status: 401 });
  }

  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Servizio momentaneamente non disponibile." },
      { status: 503 }
    );
  }

  const { data: userRow } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (userRow as { role?: string } | null)?.role ?? "customer";
  if (role !== "customer") {
    return NextResponse.json(
      {
        error:
          "Per ora il download automatico copre gli account cliente. Il tuo account professionista ha gli stessi diritti: scrivici e ti mandiamo la copia completa.",
      },
      { status: 409 }
    );
  }

  // Limite di frequenza (art. 12(5)). Non blocca un diritto: distanzia le
  // richieste ripetute di 24 ore, e lo dice con l'ora esatta del prossimo giro
  // invece di un "riprova piu' tardi" che non aiuta nessuno.
  const { data: privata } = await admin
    .from("profile_private")
    .select("last_export_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const ultimo = (privata as { last_export_at?: string | null } | null)?.last_export_at;
  if (ultimo) {
    const trascorso = Date.now() - Date.parse(ultimo);
    if (Number.isFinite(trascorso) && trascorso < INTERVALLO_EXPORT_MS) {
      const disponibileDal = new Date(
        Date.parse(ultimo) + INTERVALLO_EXPORT_MS
      ).toISOString();
      return NextResponse.json(
        {
          error: `Hai già scaricato i tuoi dati nelle ultime ${INTERVALLO_EXPORT_ORE} ore.`,
          disponibileDal,
        },
        { status: 429 }
      );
    }
  }

  const quando = new Date();
  let archivio: Buffer;
  try {
    const { documento, allegati } = await raccogliDatiCliente(admin, {
      id: user.id,
      email: user.email,
    });
    archivio = creaZip(
      [
        { nome: "LEGGIMI.txt", dati: Buffer.from(leggimi(quando), "utf8") },
        {
          nome: "dati.json",
          dati: Buffer.from(JSON.stringify(documento, null, 2), "utf8"),
        },
        ...allegati,
      ],
      quando
    );
  } catch {
    // Un export incompleto non si consegna: meglio un errore onesto di un
    // archivio che sembra completo e non lo e'.
    return NextResponse.json(
      { error: "Non sono riuscito a preparare l'archivio. Riprova fra poco." },
      { status: 500 }
    );
  }

  // Il timbro si mette DOPO che l'archivio esiste: se la raccolta fallisce, la
  // persona non deve ritrovarsi bloccata per 24 ore senza aver ricevuto niente.
  await admin
    .from("profile_private")
    .upsert(
      { user_id: user.id, last_export_at: quando.toISOString() },
      { onConflict: "user_id" }
    );

  const giorno = quando.toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(archivio), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="bob-i-tuoi-dati-${giorno}.zip"`,
      "content-length": String(archivio.length),
      "cache-control": "no-store",
    },
  });
}
