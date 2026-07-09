import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCityBySlug } from "@/lib/data";

export const runtime = "nodejs";

// Iscrizione alla lista d'attesa di una città non ancora attiva.
// Scrittura via service role: city_waitlist non ha policy pubbliche
// (vedi migrations/014_city_waitlist.sql), quindi il client anon non può
// né inserire né leggere le email degli altri.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let body: { email?: string; citySlug?: string; website?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  // Honeypot anti-bot: il campo "website" è invisibile agli umani.
  // Se è compilato, rispondiamo ok senza salvare nulla.
  if (body.website) {
    return NextResponse.json({ ok: true });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const citySlug = (body.citySlug ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Inserisci un indirizzo email valido." },
      { status: 400 }
    );
  }
  if (!citySlug) {
    return NextResponse.json({ error: "Città mancante." }, { status: 400 });
  }

  // Accettiamo solo città reali e non ancora attive.
  const city = await getCityBySlug(citySlug);
  if (!city) {
    return NextResponse.json({ error: "Città non trovata." }, { status: 404 });
  }
  if (city.status === "active") {
    return NextResponse.json(
      { error: "BOB è già attivo in questa città." },
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

  const { error } = await admin
    .from("city_waitlist")
    .insert({ email, city_slug: citySlug });

  // Email già iscritta per questa città: per l'utente è comunque un successo.
  if (error && error.code !== "23505") {
    return NextResponse.json(
      { error: "Non sono riuscito a salvare l'iscrizione. Riprova." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
