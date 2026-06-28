// Pagina admin: gestione account Customer Service.
// Solo admin può accedere. Permette di creare nuovi account CS e vedere quelli esistenti.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CsAccount {
  id: string;
  fullName: string;
  createdAt: string | null;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminCsPage() {
  const router = useRouter();
  const [csAccounts, setCsAccounts] = useState<CsAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form nuovo CS
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cs");
      if (res.status === 403) {
        // Non admin: reindirizza alla dashboard
        router.replace("/admin");
        return;
      }
      const json = await res.json();
      setCsAccounts(json.cs ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCs(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/cs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName: name }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Errore nella creazione");
      } else {
        setSuccess(`Account CS per ${name} creato con successo.`);
        setName("");
        setEmail("");
        setPassword("");
        loadAccounts();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">
          Team Customer Service
        </h1>
        <p className="mt-1 text-sm text-bob-ink/55">
          Crea e gestisci gli account del team CS. Questa pagina è visibile solo all&apos;admin.
        </p>
      </div>

      {/* Lista account CS esistenti */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-bob-ink">
          Account attivi
        </h2>
        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-black/[0.03]" />
        ) : csAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 py-8 text-center text-sm text-bob-ink/40">
            Nessun account CS ancora. Creane uno qui sotto.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {csAccounts.map((cs) => (
              <div key={cs.id} className="card flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-sm font-bold text-purple-700">
                  {cs.fullName[0]?.toUpperCase() ?? "C"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-bob-ink">{cs.fullName}</p>
                  <p className="text-xs text-bob-ink/50">
                    Customer Service · Creato {fmtDate(cs.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                  CS
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Form creazione nuovo CS */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-bob-ink">
          Crea nuovo account CS
        </h2>
        <div className="card p-6">
          <form onSubmit={createCs} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                  placeholder="cs@meetonda.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label-bob">Password temporanea</label>
              <input
                className="input-bob"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Almeno 8 caratteri"
                required
                minLength={8}
              />
              <p className="mt-1 text-xs text-bob-ink/45">
                La persona dovrà cambiare la password al primo accesso.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                ✓ {success}
              </p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="btn-primary w-full py-3"
            >
              {creating ? "Creo l'account…" : "Crea account CS"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
