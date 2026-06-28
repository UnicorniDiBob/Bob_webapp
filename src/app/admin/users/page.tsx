// Pagina admin: gestione utenti.
// Mostra tutti gli utenti con i loro profili e permette di modificarli.

import { createClient } from "@/lib/supabase/server";
import { EditUserButton } from "./EditUserButton";

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

const ROLE_BADGE: Record<UserRole, string> = {
  customer: "bg-black/5 text-bob-ink/60",
  professional: "bg-bob-indigo-50 text-bob-indigo",
  admin: "bg-bob-indigo text-white",
  cs: "bg-purple-50 text-purple-700",
};

const ROLE_LABEL: Record<UserRole, string> = {
  customer: "Cliente",
  professional: "Professionista",
  admin: "Admin",
  cs: "Customer Service",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminUsersPage() {
  const supabase = await createClient();

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

  // Raggruppa: prima pro e clienti, poi admin/cs
  const sorted = [...rows].sort((a, b) => {
    const order = { professional: 0, customer: 1, cs: 2, admin: 3 };
    return (order[a.role] ?? 9) - (order[b.role] ?? 9);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">
          Gestione utenti
        </h1>
        <p className="mt-1 text-sm text-bob-ink/55">
          {rows.length} utenti registrati. Puoi visualizzare e modificare i loro profili.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((u) => {
          const profile = profileMap[u.id];
          return (
            <div key={u.id} className="card flex items-center gap-4 px-5 py-4">
              {/* Avatar placeholder */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bob-indigo-50 text-sm font-bold text-bob-indigo">
                {(profile?.full_name ?? "?")[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-bob-ink">
                    {profile?.full_name ?? "Nome non impostato"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_BADGE[u.role]}`}
                  >
                    {ROLE_LABEL[u.role]}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-bob-ink/50">
                  {profile?.phone && <span>📞 {profile.phone}</span>}
                  <span>Iscritto {fmtDate(u.created_at)}</span>
                </div>
              </div>

              {/* Bottone modifica */}
              <EditUserButton
                userId={u.id}
                currentName={profile?.full_name ?? ""}
                currentPhone={profile?.phone ?? ""}
                currentAbout={profile?.about ?? ""}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
