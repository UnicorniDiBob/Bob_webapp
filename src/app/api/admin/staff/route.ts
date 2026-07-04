// API: gestione del team interno (admin e customer service).
// Solo admin può chiamare questi endpoint.
//
// GET  /api/admin/staff        → lista account admin/cs (con email e stato invito)
// POST /api/admin/staff        → invita un nuovo membro via email
//   Body: { email, fullName, role: "admin" | "cs" }
//   La persona riceve una mail di invito e imposta la password da sola.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (userRow?.role !== "admin") {
    return NextResponse.json({ error: "Solo l'admin può gestire il team" }, { status: 403 });
  }
  return null;
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { email?: string; fullName?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  if (!body.email || !body.fullName || !body.role) {
    return NextResponse.json({ error: "email, fullName e role sono obbligatori" }, { status: 400 });
  }
  if (!["admin", "cs"].includes(body.role)) {
    return NextResponse.json({ error: "role deve essere 'admin' o 'cs'" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  // Invita via email: il trigger handle_new_user legge role e full_name
  // da raw_user_meta_data e crea le righe in users e profiles.
  const { data, error } = await adminClient().auth.admin.inviteUserByEmail(body.email, {
    data: { role: body.role, full_name: body.fullName },
    redirectTo: `${origin}/auth/imposta-password`,
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Errore nell'invito" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = createClient();
  const { data: staffRows } = await supabase
    .from("users")
    .select("id, role, created_at")
    .in("role", ["admin", "cs"]);

  if (!staffRows || staffRows.length === 0) return NextResponse.json({ staff: [] });

  const ids = staffRows.map((u) => u.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.user_id, p.full_name])
  );

  // Email e stato invito arrivano da auth.users (serve il service role)
  const { data: authList } = await adminClient().auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const authMap = Object.fromEntries(
    (authList?.users ?? []).map((u) => [u.id, u])
  );

  const staff = staffRows.map((u) => ({
    id: u.id,
    role: u.role as "admin" | "cs",
    createdAt: u.created_at,
    fullName: profileMap[u.id] ?? "—",
    email: authMap[u.id]?.email ?? null,
    // Invito ancora in sospeso se la persona non ha mai fatto login
    invitePending: !authMap[u.id]?.last_sign_in_at,
  }));

  return NextResponse.json({ staff });
}
