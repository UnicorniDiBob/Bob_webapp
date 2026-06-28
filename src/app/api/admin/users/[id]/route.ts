// API: aggiorna il profilo di un utente (nome, bio, telefono, ecc.).
// Solo admin e cs possono chiamare questo endpoint.
// PATCH /api/admin/users/[id]
// Body: { fullName?, phone?, about?, headline?, bio? }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  // Aggiorna il profilo (nome, telefono, bio)
  const profilePatch: Record<string, string> = {};
  if (body.fullName !== undefined) profilePatch.full_name = body.fullName;
  if (body.phone !== undefined) profilePatch.phone = body.phone;
  if (body.about !== undefined) profilePatch.about = body.about;

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(profilePatch)
      .eq("user_id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Se ci sono campi del professionista (headline, bio) li aggiorna anche lì
  const proPatch: Record<string, string> = {};
  if (body.headline !== undefined) proPatch.headline = body.headline;
  if (body.bio !== undefined) proPatch.bio = body.bio;

  if (Object.keys(proPatch).length > 0) {
    await supabase
      .from("professionals")
      .update(proPatch)
      .eq("user_id", params.id);
  }

  return NextResponse.json({ ok: true });
}
