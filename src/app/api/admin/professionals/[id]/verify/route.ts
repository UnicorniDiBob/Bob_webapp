// API: aggiorna lo stato di verifica di un professionista.
// Solo admin e cs possono chiamare questo endpoint.
// PATCH /api/admin/professionals/[id]/verify
// Body: { status: "verified" | "pending" | "unverified" }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type VerificationStatus = "verified" | "pending" | "unverified";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  // Verifica autenticazione
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // Verifica ruolo admin o cs
  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!userRow || !["admin", "cs"].includes(userRow.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  // Legge il nuovo status dal body
  let body: { status?: VerificationStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const validStatuses: VerificationStatus[] = ["verified", "pending", "unverified"];
  if (!body.status || !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Status non valido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("professionals")
    .update({ verification_status: body.status })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: body.status });
}
