// POST /api/upload/immagine — L'UNICO PUNTO DA CUI UN'IMMAGINE ENTRA NELLO
// STORAGE (16/10, strip-exif-server-endpoint).
//
// multipart/form-data con due campi: `file` e `bucket`. Il file passa da
// src/lib/immagini.ts (tipo dai byte, tetti, orientamento applicato, metadati
// buttati: GPS, dispositivo, data) e solo l'immagine ri-codificata viene
// scritta, col service role, in `<userId>/<uuid>.<jpg|png>` — la stessa
// cartella per utente che le policy dello storage gia' richiedono.
//
// Dal 16/10 (strip-exif-client-switch) ci passano ProPortfolio e
// VerificationDocuments; /api/bob/chat pulisce da se' con la stessa
// funzione, perche' la foto arriva dentro il JSON della conversazione.
//
// UNA ECCEZIONE, SOLO PER verifica-documenti: i PDF (visure, attestati).
// Riconosciuti dai byte, controllati nel peso, NON ri-codificati: vedi
// src/lib/pdf.ts. In portfolio e brief-photos un PDF resta un 415.
//
// Chi chiama: chiamante() (cookie del sito o Bearer validato da Supabase), il
// Bearer e' la strada dell'app nativa, che non ha un canvas per pulire da se'.
//
// Senza service role: 503. MAI un ripiego che scrive il file grezzo — e'
// esattamente la cosa che questa route esiste per impedire.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { chiamante } from "@/lib/supabase/chiamante";
import { ImmagineRifiutata, pulisciImmagine, type MotivoRifiuto } from "@/lib/immagini";
import { ePdf, verificaPdf } from "@/lib/pdf";
import { ACTOR_LIMITS, MAX_BODY_BYTES, checkActorRateLimit, readBytesWithLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Chi puo' scrivere dove. La lista e' chiusa: un bucket che non e' qui non
// esiste per questa route.
//   portfolio          PUBBLICO: solo il professionista, sul proprio profilo
//   verifica-documenti privato: solo il pro titolare della pratica
//   brief-photos       privato (014): qualunque account, nella propria cartella
const BUCKET = ["portfolio", "verifica-documenti", "brief-photos"] as const;
type Bucket = (typeof BUCKET)[number];
const SOLO_PRO: ReadonlySet<Bucket> = new Set(["portfolio", "verifica-documenti"]);
const PUBBLICO: ReadonlySet<Bucket> = new Set(["portfolio"]);

const STATO_RIFIUTO: Record<MotivoRifiuto, { status: number; error: string }> = {
  troppo_grande: { status: 413, error: "Il file supera 8 MB" },
  tipo_non_ammesso: { status: 415, error: "Formato non supportato: carica una foto JPG, PNG o WebP" },
  troppi_pixel: { status: 422, error: "Immagine troppo grande: oltre 50 megapixel" },
  illeggibile: { status: 422, error: "Immagine danneggiata o illeggibile" },
};

const errore = (status: number, error: string, headers?: Record<string, string>) =>
  NextResponse.json({ error }, { status, headers });

export async function POST(request: Request) {
  const { user } = await chiamante(request);
  if (!user) return errore(401, "Non autenticato");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[upload/immagine] service role assente: nessun caricamento (503).");
    return errore(503, "Servizio temporaneamente non disponibile");
  }
  const admin = createServiceClient(url, serviceKey);

  // Prima del corpo: fermare un flood costa meno che leggere 8 MB per volta.
  // Chiude su errore o timeout come chat e brief (097, src/lib/rate-limit.ts).
  const limite = await checkActorRateLimit(admin, `user:${user.id}`, "upload", ACTOR_LIMITS.upload.authenticated);
  if (!limite.allowed) {
    return errore(429, "Troppi caricamenti, riprova fra poco", {
      "Retry-After": String(limite.retryAfterSeconds),
    });
  }

  const letto = await readBytesWithLimit(request, MAX_BODY_BYTES.upload);
  if (!letto.ok) return errore(413, "Il file supera 8 MB");

  let form: FormData;
  try {
    form = await new Response(letto.bytes, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return errore(400, "Serve un modulo multipart/form-data con i campi file e bucket");
  }

  const bucket = form.get("bucket");
  if (typeof bucket !== "string" || !(BUCKET as readonly string[]).includes(bucket)) {
    return errore(400, "Bucket non ammesso");
  }
  const b = bucket as Bucket;

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return errore(400, "Manca il file");

  if (SOLO_PRO.has(b)) {
    const { data: pro, error } = await admin
      .from("professionals")
      .select("id, deactivated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("[upload/immagine] lettura professionals fallita:", error.message);
      return errore(500, "Errore interno");
    }
    // Un profilo spento da una richiesta di cancellazione (056) non carica
    // piu' niente: ne' foto pubbliche, ne' documenti.
    if (!pro || pro.deactivated_at) {
      return errore(403, "Solo il professionista titolare del profilo puo' caricare qui");
    }
  }

  // Il content-type dichiarato e il nome del file non si leggono nemmeno:
  // il tipo lo dicono i byte.
  const grezzo = Buffer.from(await file.arrayBuffer());

  if (b === "verifica-documenti" && ePdf(grezzo)) {
    const esito = verificaPdf(grezzo);
    if (esito === "troppo_grande") return errore(413, "Il PDF supera 4 MB: riducilo o dividilo");
    if (esito !== "ok") return errore(415, "Formato non supportato");
    return scrivi(admin, b, user.id, grezzo, "application/pdf", "pdf");
  }

  let pulita;
  try {
    pulita = await pulisciImmagine(grezzo);
  } catch (e) {
    if (e instanceof ImmagineRifiutata) {
      const r = STATO_RIFIUTO[e.motivo];
      return errore(r.status, r.error);
    }
    console.error("[upload/immagine] pulizia fallita:", e instanceof Error ? e.message : e);
    return errore(500, "Errore interno");
  }

  const estensione = pulita.contentType === "image/png" ? "png" : "jpg";
  return scrivi(admin, b, user.id, pulita.buffer, pulita.contentType, estensione);
}

async function scrivi(
  admin: SupabaseClient,
  b: Bucket,
  userId: string,
  contenuto: Buffer,
  contentType: string,
  estensione: string
) {
  const path = `${userId}/${randomUUID()}.${estensione}`;
  const { error: upErr } = await admin.storage
    .from(b)
    .upload(path, contenuto, { contentType, upsert: false });
  if (upErr) {
    console.error("[upload/immagine] scrittura fallita:", upErr.message);
    return errore(500, "Caricamento non riuscito");
  }

  if (PUBBLICO.has(b)) {
    const { data } = admin.storage.from(b).getPublicUrl(path);
    return NextResponse.json({ path, publicUrl: data.publicUrl });
  }
  return NextResponse.json({ path });
}
