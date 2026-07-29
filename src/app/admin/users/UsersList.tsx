"use client";

// Lista utenti con ricerca e filtri (pagina admin "Gestione utenti").
// Filtro per ruolo + ricerca live su nome e telefono, lato client.

import { useMemo, useState } from "react";
import { Phone } from "lucide-react";
import { EditUserButton } from "./EditUserButton";
import { DeleteUserButton } from "./DeleteUserButton";

type UserRole = "customer" | "professional" | "admin" | "cs";

export interface UserListItem {
  id: string;
  role: UserRole;
  created_at: string | null;
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

const FILTERS: { value: UserRole | "all"; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "customer", label: "Clienti" },
  { value: "professional", label: "Professionisti" },
  { value: "cs", label: "CS" },
  { value: "admin", label: "Admin" },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Normalizza per la ricerca: minuscole, senza accenti.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function UsersList({
  users,
  isAdmin,
  viewerId,
}: {
  users: UserListItem[];
  isAdmin: boolean;
  viewerId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users.length };
    for (const u of users) c[u.role] = (c[u.role] ?? 0) + 1;
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    let list = users;
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (q) {
      list = list.filter(
        (u) =>
          norm(u.full_name ?? "").includes(q) ||
          (u.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))
      );
    }
    // Pro e clienti prima, poi cs/admin; a parità, più recenti prima
    const order: Record<UserRole, number> = {
      professional: 0,
      customer: 1,
      cs: 2,
      admin: 3,
    };
    return [...list].sort((a, b) => {
      const o = (order[a.role] ?? 9) - (order[b.role] ?? 9);
      if (o !== 0) return o;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [users, query, roleFilter]);

  return (
    <div className="space-y-4">
      {/* Barra di ricerca + filtri */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome o telefono…"
          className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none focus:border-bob-indigo/40 sm:max-w-xs"
          data-testid="users-search"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setRoleFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                roleFilter === f.value
                  ? "bg-bob-indigo text-white"
                  : "border border-black/10 text-bob-ink/60 hover:bg-black/[0.04]"
              }`}
              data-testid={`users-filter-${f.value}`}
            >
              {f.label}
              {counts[f.value] != null && (
                <span className="ml-1 opacity-60">({counts[f.value] ?? 0})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 py-10 text-center text-sm text-bob-ink/40">
          Nessun utente trovato
          {query ? ` per “${query}”` : ""}.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((u) => (
            <div key={u.id} className="card flex items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bob-indigo-50 text-sm font-bold text-bob-indigo">
                {(u.full_name ?? "?")[0].toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-bob-ink">
                    {u.full_name ?? "Nome non impostato"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_BADGE[u.role]}`}
                  >
                    {ROLE_LABEL[u.role]}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-bob-ink/50">
                  {u.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {u.phone}
                    </span>
                  )}
                  <span>Iscritto {fmtDate(u.created_at)}</span>
                </div>
              </div>

              <EditUserButton
                userId={u.id}
                currentName={u.full_name ?? ""}
                currentPhone={u.phone ?? ""}
                currentAbout={u.about ?? ""}
              />
              {isAdmin && u.id !== viewerId && (
                <DeleteUserButton
                  userId={u.id}
                  userName={u.full_name ?? "questo utente"}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
