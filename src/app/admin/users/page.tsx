// Pagina admin: gestione utenti.
// Fetch lato server; ricerca e filtri sono nel componente client UsersList.

import { createClient } from "@/lib/supabase/server";
import { UsersList, type UserListItem } from "./UsersList";

export const revalidate = 0;

type UserRole = "customer" | "professional" | "admin" | "cs";

interface UserRow {
  id: string;
  role: UserRole;
  created_at: string | null;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  about: string | null;
}

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // Ruolo di chi sta guardando: solo admin vede il bottone Elimina
  const { data: { user: viewer } } = await supabase.auth.getUser();
  const { data: viewerRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", viewer?.id ?? "")
    .maybeSingle();
  const isAdmin = viewerRow?.role === "admin";

  const { data: users } = await supabase
    .from("users")
    .select("id, role, created_at")
    .order("created_at", { ascending: false });

  const rows = (users ?? []) as UserRow[];
  const ids = rows.map((u) => u.id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone, about")
    .in("user_id", ids);

  const profileMap = Object.fromEntries(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.user_id, p])
  );

  const items: UserListItem[] = rows.map((u) => {
    const p = profileMap[u.id];
    return {
      id: u.id,
      role: u.role,
      created_at: u.created_at,
      full_name: p?.full_name ?? null,
      phone: p?.phone ?? null,
      about: p?.about ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">
          Gestione utenti
        </h1>
        <p className="mt-1 text-sm text-bob-ink/55">
          {rows.length} utenti registrati. Cerca, filtra per ruolo e modifica i profili.
        </p>
      </div>

      <UsersList users={items} isAdmin={isAdmin} viewerId={viewer?.id ?? null} />
    </div>
  );
}
