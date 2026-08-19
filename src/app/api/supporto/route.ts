import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Apertura di un ticket di assistenza.
//
// Scrittura via service role, come la waitlist e per le stesse ragioni:
// support_tickets non ha policy di insert per anon ne' per authenticated,
// quindi l'unico modo di crearne uno e' passare da qui — ed e' l'unico posto
// dove si possono mettere honeypot, validazione e un tetto agli invii.
//
// L'UTENTE NON DECIDE CHI E'. Se c'e' una sessione, user_id ed email li
// leggiamo dalla sessione lato server e ignoriamo quello che arriva nel body:
// altrimenti chiunque potrebbe aprire un ticket a nome di un altro, e la
// policy di lettura ("i miei ticket") glielo farebbe poi leggere.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const CATEGORIE = [
  "problema_tecnico",
  "account",
  "professionista",
  "pagamenti",
  "privacy",
  "altro",
] as const;

// Codice leggibile ad alta voce al telefono: niente 0/O, 1/I/L, che al
// telefono si confondono e che qualcuno dovra' dettare davvero.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generaRef(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return `BOB-${s}`;
}

export async function POST(request: Request) {
  let body: {
    email?: string;
    category?: string;
    subject?: string;
    message?: string;
    website?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  // Honeypot: campo invisibile agli umani. Se e' pieno, rispondiamo ok senza
  // salvare — un bot non deve sapere di essere stato scartato.
  if (body.website) return NextResponse.json({ ok: true, ref: generaRef() });

  const category = (body.category ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();

  if (!CATEGORIE.includes(category as (typeof CATEGORIE)[number])) {
    return NextResponse.json({ error: "Scegli di cosa si tratta." }, { status: 400 });
  }
  if (subject.length < 3 || subject.length > 140) {
    return NextResponse.json(
      { error: "Scrivi un titolo breve (da 3 a 140 caratteri)." },
      { status: 400 }
    );
  }
  if (message.length < 20) {
    return NextResponse.json(
      { error: "Racconta il problema con qualche parola in più: così possiamo risponderti davvero." },
      { status: 400 }
    );
  }
  if (message.length > 5000) {
    return NextResponse.json(
      { error: "Il messaggio è troppo lungo: prova a stringerlo sotto i 5000 caratteri." },
      { status: 400 }
    );
  }

  // Chi sta scrivendo, secondo il server e non secondo il body.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = (user?.email ?? body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Serve un indirizzo email valido, per poterti rispondere." },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Servizio momentaneamente non disponibile." },
      { status: 503 }
    );
  }
  const admin = createServiceClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // Tetto agli invii: cinque ticket aperti a testa. Non e' antispam serio (per
  // quello serve il rate limiting di P1.5), e' una guardia contro il doppio
  // clic e contro chi apre venti ticket per lo stesso problema.
  if (user) {
    const { count } = await admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["nuovo", "in_lavorazione"]);
    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        {
          error:
            "Hai già cinque richieste aperte: rispondiamo a quelle prima di aprirne altre.",
        },
        { status: 429 }
      );
    }
  }

  // Il codice deve essere unico: se per caso collide, si riprova.
  for (let tentativo = 0; tentativo < 5; tentativo++) {
    const ref = generaRef();
    const { error } = await admin.from("support_tickets").insert({
      ref,
      user_id: user?.id ?? null,
      email,
      category,
      subject,
      message,
    });
    if (!error) return NextResponse.json({ ok: true, ref });
    if (error.code !== "23505") {
      return NextResponse.json(
        { error: "Non sono riuscito a registrare la richiesta. Riprova." },
        { status: 500 }
      );
    }
  }
  return NextResponse.json(
    { error: "Non sono riuscito a registrare la richiesta. Riprova." },
    { status: 500 }
  );
}
