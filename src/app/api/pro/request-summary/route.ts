// [F3] API riassunto nuove richieste per il professionista.
// GET: restituisce le richieste assegnate al pro non ancora lette/risposte,
//      con riassunto AI (Claude) e bozza di risposta.
// Richiede autenticazione come professionista.

import { NextResponse } from "next/server";
import { stripAddresses } from "@/lib/redact";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

interface RawRequest {
  id: string;
  problem_description: string | null;
  zone_slug?: string | null;
  postal_code?: string | null;
  urgency: string | null;
  budget_min: number | null;
  budget_max: number | null;
  created_at: string | null;
  services?: { name: string } | null;
  cities?: { name: string } | null;
}

async function buildSummary(
  req: RawRequest,
  apiKey: string | undefined
): Promise<{ summary: string; draftReply: string }> {
  // (41.2) Minimizzazione prima dell'invio al fornitore LLM: via e civico non
  // devono uscire dal nostro perimetro. Vedi src/lib/redact.ts.
  const desc =
    stripAddresses(req.problem_description ?? "") || "(nessuna descrizione)";
  const urgency = req.urgency ?? "non specificata";
  const budget =
    req.budget_min || req.budget_max
      ? `€${req.budget_min ?? 0}–€${req.budget_max ?? "?"}`
      : "non indicato";
  const service = req.services?.name ?? "servizio";
  const city = req.cities?.name ?? "";

  if (!apiKey) {
    // Fallback senza AI: testo strutturato
    return {
      summary: `Richiesta di ${service}${city ? ` a ${city}` : ""}. Urgenza: ${urgency}. Budget: ${budget}. Descrizione: ${desc.slice(0, 200)}.`,
      draftReply: `Ciao! Ho ricevuto la tua richiesta di ${service.toLowerCase()}. Posso aiutarti: sono disponibile per un sopralluogo. Mi fai sapere quando sei libero?`,
    };
  }

  try {
    const client = new Anthropic({ apiKey });
    const completion = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 300,
      temperature: 0.3,
      system:
        "Sei l'assistente di un professionista su un marketplace di servizi. Ricevi una richiesta di un cliente e devi: 1) scrivere un riassunto breve (max 2 frasi) della richiesta, 2) scrivere una bozza di risposta cordiale e professionale (max 3 frasi) da parte del professionista. Rispondi SOLO con JSON: { \"summary\": \"...\", \"draftReply\": \"...\" }",
      messages: [
        {
          role: "user",
          content: `Servizio: ${service}\nCittà: ${city}\nUrgenza: ${urgency}\nBudget: ${budget}\nDescrizione cliente: ${desc}`,
        },
      ],
    });
    const raw = completion.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const obj = JSON.parse(raw.slice(start, end + 1));
      return {
        summary: typeof obj.summary === "string" ? obj.summary : desc.slice(0, 150),
        draftReply: typeof obj.draftReply === "string" ? obj.draftReply : `Ciao! Ho ricevuto la tua richiesta, sono disponibile. Quando possiamo sentirci?`,
      };
    }
  } catch {
    // ignora errori AI, usiamo fallback
  }

  return {
    summary: `${service}${city ? ` a ${city}` : ""} — ${desc.slice(0, 150)}`,
    draftReply: `Ciao! Ho ricevuto la tua richiesta di ${service.toLowerCase()}. Sono disponibile, scriviamo per organizzare.`,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ requests: [] }, { status: 401 });

  // Verifica che l'utente sia un professionista
  const { data: proRow } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!proRow) return NextResponse.json({ requests: [] }, { status: 403 });

  // Recupera le richieste assegnate al pro, non ancora chiuse, max 10 recenti
  const { data: assigned } = await supabase
    .from("request_professionals")
    .select("request_id")
    .eq("professional_id", proRow.id)
    .in("status", ["suggested", "contacted", "quote_requested"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (!assigned || assigned.length === 0)
    return NextResponse.json({ requests: [] });

  const ids = assigned.map((r) => r.request_id);

  const { data: requests } = await supabase
    .from("requests")
    .select(`
      id,
      problem_description,
      urgency,
      budget_min,
      budget_max,
      created_at,
      brief_id,
      zone_slug,
      postal_code,
      services ( name ),
      cities ( name )
    `)
    .in("id", ids)
    .neq("status", "closed")
    .order("created_at", { ascending: false });

  if (!requests || requests.length === 0)
    return NextResponse.json({ requests: [] });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // (022) Contesto del brief di Bob: riassunto + foto (URL firmati, bucket
  // privato brief-photos). Best-effort: senza service role si salta.
  const briefIds = Array.from(
    new Set(
      (requests as unknown as RawRequest[])
        .map((r) => (r as { brief_id?: string | null }).brief_id)
        .filter(Boolean)
    )
  ) as string[];
  const briefById = new Map<
    string,
    { summary: string | null; photos: { url: string; caption: string | null }[] }
  >();
  const svcUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (briefIds.length && svcUrl && svcKey) {
    try {
      const { createClient: createServiceClient } = await import(
        "@supabase/supabase-js"
      );
      const admin = createServiceClient(svcUrl, svcKey);
      const { data: briefs } = await admin
        .from("job_briefs")
        .select("id, summary, photos")
        .in("id", briefIds);
      for (const b of (briefs ?? []) as {
        id: string;
        summary: string | null;
        photos: { storagePath?: string; aiCaption?: string | null }[];
      }[]) {
        const photos: { url: string; caption: string | null }[] = [];
        for (const ph of (b.photos ?? []).slice(0, 3)) {
          if (!ph.storagePath) continue;
          const { data: signed } = await admin.storage
            .from("brief-photos")
            .createSignedUrl(ph.storagePath, 3600);
          if (signed?.signedUrl) {
            photos.push({ url: signed.signedUrl, caption: ph.aiCaption ?? null });
          }
        }
        briefById.set(b.id, { summary: b.summary ?? null, photos });
      }
    } catch {
      // il riassunto funziona anche senza contesto brief
    }
  }

  // Costruisce riassunti per ogni richiesta (in parallelo, max 5 per non abusare)
  const slice = (requests as unknown as RawRequest[]).slice(0, 5);
  const enriched = await Promise.all(
    slice.map(async (req) => {
      const { summary, draftReply } = await buildSummary(req, apiKey);
      const brief = briefById.get(
        ((req as { brief_id?: string | null }).brief_id ?? "") as string
      );
      return {
        id: req.id,
        service: (req.services as { name: string } | null)?.name ?? null,
        city: (req.cities as { name: string } | null)?.name ?? null,
        // (045) quartiere: posizione grossolana, visibile prima della scelta.
        // Via e civico restano chiusi in request_addresses fino
        // all'appuntamento confermato (mig 044).
        zoneSlug: req.zone_slug ?? null,
        postalCode: req.postal_code ?? null,
        urgency: req.urgency,
        budgetMin: req.budget_min,
        budgetMax: req.budget_max,
        createdAt: req.created_at,
        summary,
        draftReply,
        briefSummary: brief?.summary ?? null,
        briefPhotos: brief?.photos ?? [],
      };
    })
  );

  return NextResponse.json({ requests: enriched });
}
