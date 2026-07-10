// Pagina di reset password: chi clicca "Password dimenticata?" nel login
// riceve una mail con un link che arriva qui e sceglie una nuova password.
// Funziona sia con link PKCE (?code=) sia con token nell'hash (#access_token),
// gestiti automaticamente da supabase-js (stesso meccanismo di imposta-password).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "done";

export default function ReimpostaPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Caso PKCE: il link di reset reindirizza con ?code=
      const code = new URL(window.location.href).searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => null);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setStatus(session ? "ready" : "invalid");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !cancelled) setStatus("ready");
    });

    init();
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La password deve avere almeno 6 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le due password non coincidono.");
      return;
    }

    setSaving(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      setStatus("done");
      setTimeout(() => router.replace("/dashboard"), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="card p-8">
        <h1 className="mb-1 text-xl font-bold tracking-tight text-bob-ink">
          Reimposta la password
        </h1>

        {status === "checking" && (
          <p className="mt-4 text-sm text-bob-ink/55">Verifico il link…</p>
        )}

        {status === "invalid" && (
          <div className="mt-4">
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              Link non valido o scaduto. Richiedi un nuovo link dalla pagina di
              accesso.
            </p>
            <Link
              href="/login"
              className="btn-secondary mt-4 block w-full py-2.5 text-center"
            >
              Torna al login
            </Link>
          </div>
        )}

        {status === "done" && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✓ Password aggiornata! Ti porto alla tua area personale…
          </p>
        )}

        {status === "ready" && (
          <>
            <p className="mb-6 text-sm text-bob-ink/55">
              Scegli una nuova password per il tuo account.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="label-bob" htmlFor="new-password">
                  Nuova password
                </label>
                <input
                  id="new-password"
                  className="input-bob"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Almeno 6 caratteri"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              <div>
                <label className="label-bob" htmlFor="confirm-password">
                  Conferma password
                </label>
                <input
                  id="confirm-password"
                  className="input-bob"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Ripeti la password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full py-3"
                data-testid="button-save-password"
              >
                {saving ? "Salvo…" : "Salva la nuova password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
