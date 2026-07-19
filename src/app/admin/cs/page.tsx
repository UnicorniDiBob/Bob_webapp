// Pagina admin: gestione del team interno (admin e customer service).
// Solo admin può accedere. Permette di invitare nuovi membri via email
// e vedere quelli esistenti con lo stato dell'invito.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StaffRole = "admin" | "cs";

interface StaffAccount {
  id: string;
  role: StaffRole;
  fullName: string;
  email: string | null;
  createdAt: string | null;
  invitePending: boolean;
}

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  cs: "Customer Service",
};

const ROLE_BADGE: Record<StaffRole, string> = {
  admin: "bg-bob-indigo text-white",
  cs: "bg-purple-50 text-purple-700",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminTeamPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form invito
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("cs");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadStaff() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff");
      if (res.status === 403) {
        // Non admin: reindirizza alla dashboard
        router.replace("/admin");
        return;
      }
      const json = await res.json();
      setStaff(json.staff ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: name, role }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Errore nell'invio dell'invito");
      } else {
        setSuccess(
          `Invito inviato a ${email}. ${name} riceverà una mail per impostare la password.`
        );
        setName("");
        setEmail("");
        setRole("cs");
        loadStaff();
      }
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">
          Team
        </h1>
        <p className="mt-1 text-sm text-bob-ink/55">
          Invita e gestisci gli account interni (admin e customer service).
          Questa pagina è visibile solo all&apos;admin.
        </p>
      </div>

      {/* Lista membri del team */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-bob-ink">
          Membri del team
        </h2>
        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-black/[0.03]" />
        ) : staff.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 py-8 text-center text-sm text-bob-ink/40">
            Nessun membro ancora. Invita qualcuno qui sotto.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {staff.map((s) => (
              <div key={s.id} className="card flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-sm font-bold text-purple-700">
                  {s.fullName[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-bob-ink">{s.fullName}</p>
                    {s.invitePending && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Invito in sospeso
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-bob-ink/50">
                    {s.email ?? "—"} · Creato {fmtDate(s.createdAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_BADGE[s.role]}`}
                >
                  {ROLE_LABEL[s.role]}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Form invito nuovo membro */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-bob-ink">
          Invita un nuovo membro
        </h2>
        <div className="card p-6">
          <form onSubmit={invite} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label-bob">Nome e cognome</label>
                <input
                  className="input-bob"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mario Rossi"
                  required
                  minLength={2}
                />
              </div>
              <div>
                <label className="label-bob">Email</label>
                <input
                  className="input-bob"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mario@meetonda.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label-bob">Ruolo</label>
              <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRole("cs")}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                    role === "cs"
                      ? "border-bob-indigo bg-bob-indigo-50/50 ring-1 ring-bob-indigo"
                      : "border-black/10 hover:border-black/20"
                  }`}
                >
                  <span className="font-semibold text-bob-ink">Customer Service</span>
                  <p className="mt-0.5 text-xs text-bob-ink/50">
                    Vede verifiche e utenti, può modificare i profili. Non può
                    invitare o eliminare.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                    role === "admin"
                      ? "border-bob-indigo bg-bob-indigo-50/50 ring-1 ring-bob-indigo"
                      : "border-black/10 hover:border-black/20"
                  }`}
                >
                  <span className="font-semibold text-bob-ink">Admin</span>
                  <p className="mt-0.5 text-xs text-bob-ink/50">
                    Accesso completo: gestisce team, elimina utenti, tutte le
                    funzioni della dashboard.
                  </p>
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                ✓ {success}
              </p>
            )}

            <button
              type="submit"
              disabled={inviting}
              className="btn-primary w-full py-3"
            >
              {inviting ? "Invio l'invito…" : "Invia invito via email"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
