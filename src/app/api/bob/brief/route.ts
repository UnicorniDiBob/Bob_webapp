import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_BRIEF, type JobBrief } from "@/lib/bob";

export const runtime = "nodejs";

// Salva il job brief completato (una riga per chat conclusa).
// È il fondamento dati del ranking: logga cosa chiedono i clienti e come.
// Scrittura via service role: la tabella job_briefs non ha policy di insert.
export async function POST(request: Request) {
  let body: { brief?: JobBrief; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const brief: JobBrief = { ...EMPTY_BRIEF, ...(body.brief ?? {}) };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Logging best-effort: senza service role non blocchiamo la UX.
    return NextResponse.json({ saved: false });
  }

  // Se l'utente è loggato, agganciamo il brief al suo account.
  let userId: string | null = null;
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    const admin = createServiceClient(url, serviceKey);
    const { data, error } = await admin
      .from("job_briefs")
      .insert({
        user_id: userId,
        service_slug: brief.serviceSlug,
        subtask_slug: brief.subtaskSlug,
        severity: brief.severity,
        urgency: brief.urgency,
        summary: brief.summary,
        property_type: brief.propertyType,
        access_notes: brief.accessNotes,
        timing_availability: brief.timingAvailability,
        budget_min: brief.budgetMin,
        budget_max: brief.budgetMax,
        budget_flexible: brief.budgetFlexible ?? false,
        city_slug: brief.citySlug,
        zone: brief.zone,
        scope: brief.scope ?? {},
        red_flags: brief.redFlags ?? [],
        photos: brief.photos ?? [],
        field_meta: brief.fieldMeta ?? {},
        source: body.source === "rules" ? "rules" : "ai",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ saved: false });
    return NextResponse.json({ saved: true, id: data.id });
  } catch {
    return NextResponse.json({ saved: false });
  }
}
