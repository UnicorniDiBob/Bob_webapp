// API: aggiorna il piano di abbonamento di un professionista.
// Solo admin e cs possono chiamare questo endpoint.
// PATCH /api/admin/professionals/[id]/tier
// Body: { tier: "free" | "pro" | "business" }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubscriptionTier = "free" | "pro" | "business";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!userRow || !["admin", "cs"].includes(userRow.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  let body: { tier?: SubscriptionTier };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const validTiers: SubscriptionTier[] = ["free", "pro", "business"];
  if (!body.tier || !validTiers.includes(body.tier)) {
    return NextResponse.json({ error: "Piano non valido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("professionals")
    .update({ subscription_tier: body.tier })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, tier: body.tier });
}
