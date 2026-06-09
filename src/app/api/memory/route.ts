// [F2] API memoria cliente: GET legge la memoria, POST la aggiorna.
// Usa la tabella customer_memory su Supabase.
// La tabella va creata con la migrazione SQL inclusa in /supabase/migrations/010_customer_memory.sql

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ memory: null });

  const { data } = await supabase
    .from("customer_memory")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ memory: data ?? null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const patch = {
    user_id: user.id,
    last_service_slug: body.lastServiceSlug ?? null,
    last_city_slug: body.lastCitySlug ?? null,
    last_budget_label: body.lastBudgetLabel ?? null,
    preferred_urgency: body.preferredUrgency ?? null,
    search_count: body.searchCount ?? 1,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("customer_memory")
    .upsert(patch, { onConflict: "user_id" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
