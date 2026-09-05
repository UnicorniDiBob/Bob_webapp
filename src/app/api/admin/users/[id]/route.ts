// API: aggiorna il profilo di un utente (nome, bio, telefono, ecc.).
// Solo admin e cs possono chiamare questo endpoint.
// PATCH  /api/admin/users/[id]  — Body: { fullName?, phone?, about?, headline?, bio? }
// DELETE /api/admin/users/[id]  — elimina definitivamente l'utente (solo admin)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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

  // IL NOME VUOTO SI FERMA QUI (05/09). Questa rotta scriveva qualunque cosa
  // le arrivasse, stringa vuota compresa, e un full_name vuoto faceva lanciare
  // l'iniziale in /admin/users portando giu' l'intera pagina — per admin e per
  // cs, cioe' proprio la pagina da cui si sarebbe rimediato. Il form adesso
  // non lo manda piu', ma il form e' una cortesia: la rotta e' la porta che
  // nessuno puo' aggirare, e per questo il controllo vive qui.
  if (body.fullName !== undefined && body.fullName.trim() === "") {
    return NextResponse.json(
      { error: "Il nome non puo' essere vuoto." },
      { status: 400 }
    );
  }

  // Aggiorna il profilo (nome, bio). Il telefono vive altrove dalla 051.
  const profilePatch: Record<string, string> = {};
  if (body.fullName !== undefined) {
    profilePatch.full_name = body.fullName.trim().replace(/\s+/g, " ");
  }
  if (body.about !== undefined) profilePatch.about = body.about;

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(profilePatch)
      .eq("user_id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Telefono: profile_phone (mig 051), RLS "Staff updates phones" per
  // admin/cs. Upsert perche' un utente senza telefono non ha ancora riga.
  if (body.phone !== undefined) {
    const { error } = await supabase
      .from("profile_phone")
      .upsert({ user_id: params.id, phone: body.phone, updated_at: new Date().toISOString() });
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

// Elimina definitivamente un utente: account auth + tutti i dati collegati
// (profilo, professionista, richieste, valutazioni) via cascade sul database.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // Solo admin può eliminare utenti (non cs)
  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (userRow?.role !== "admin") {
    return NextResponse.json({ error: "Solo l'admin può eliminare utenti" }, { status: 403 });
  }

  // Non puoi eliminare il tuo stesso account
  if (params.id === user.id) {
    return NextResponse.json({ error: "Non puoi eliminare il tuo account" }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Elimina da Supabase Auth: la FK users.id → auth.users(id) on delete cascade
  // rimuove a catena users, profiles, professionals, requests, ratings, ecc.
  const { error } = await adminClient.auth.admin.deleteUser(params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
