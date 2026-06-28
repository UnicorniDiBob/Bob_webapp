// API: crea un nuovo account customer service.
// Solo admin può chiamare questo endpoint.
// POST /api/admin/cs
// Body: { email, password, fullName }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = createClient();

  // Verifica che chi chiama sia admin (non cs — solo admin può creare account cs)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (userRow?.role !== "admin") {
    return NextResponse.json({ error: "Solo l'admin può creare account CS" }, { status: 403 });
  }

  let body: { email?: string; password?: string; fullName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  if (!body.email || !body.password || !body.fullName) {
    return NextResponse.json({ error: "email, password e fullName sono obbligatori" }, { status: 400 });
  }

  // Usa il service role key per creare utenti senza passare per l'email di conferma
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Crea l'utente in Supabase Auth
  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true, // Nessuna email di conferma necessaria per account CS
    user_metadata: { role: "cs", full_name: body.fullName },
  });

  if (createErr || !newUser.user) {
    return NextResponse.json({ error: createErr?.message ?? "Errore nella creazione" }, { status: 500 });
  }

  // Imposta il ruolo CS nella tabella users
  const { error: roleErr } = await adminClient
    .from("users")
    .update({ role: "cs" })
    .eq("id", newUser.user.id);

  if (roleErr) {
    return NextResponse.json({ error: roleErr.message }, { status: 500 });
  }

  // Aggiorna il profilo con il nome
  await adminClient
    .from("profiles")
    .update({ full_name: body.fullName })
    .eq("user_id", newUser.user.id);

  return NextResponse.json({ ok: true, userId: newUser.user.id });
}

// GET: lista tutti gli account CS (solo admin)
export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (userRow?.role !== "admin") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { data: csUsers } = await supabase
    .from("users")
    .select("id, created_at")
    .eq("role", "cs");

  if (!csUsers || csUsers.length === 0) return NextResponse.json({ cs: [] });

  const ids = csUsers.map((u) => u.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url")
    .in("user_id", ids);

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  const cs = csUsers.map((u) => ({
    id: u.id,
    createdAt: u.created_at,
    fullName: profileMap[u.id]?.full_name ?? "Customer Service",
  }));

  return NextResponse.json({ cs });
}
