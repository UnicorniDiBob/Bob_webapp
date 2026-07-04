// Pagina di attivazione account: chi riceve un invito via email arriva qui
// e imposta la propria password. Funziona sia con link PKCE (?code=) sia
// con token nell'hash (#access_token), gestiti automaticamente da supabase-js.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "done";

export default function ImpostaPasswordPage() {
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
      // Caso PKCE: il link di invito reindirizza con ?code=
      const code = new URL(window.location.href).searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => null);
      }

      // Caso hash (#access_token): supabase-js lo gestisce da solo,
      // qui verifichiamo semplicemente se esiste una sessione.
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) setStatus(session ? "ready" : "invalid");
    }

    // Se la sessione arriva in ritardo (detectSessionInUrl è asincrono)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session && !cancelled) setStatus("ready");
      }
    );

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

    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
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
      setTimeout(() => router.replace("/admin"), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="card p-8">
        <h1 className="mb-1 text-xl font-bold tracking-tight text-bob-ink">
          Benvenuto nel team Bob
        </h1>

        {status === "checking" && (
          <p className="mt-4 text-sm text-bob-ink/55">Verifico il link…</p>
        )}

        {status === "invalid" && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Link non valido o scaduto. Chiedi all&apos;admin di inviarti un
            nuovo invito.
          </p>
        )}

        {status === "done" && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✓ Password impostata! Ti porto alla dashboard…
          </p>
        )}

        {status === "ready" && (
          <>
            <p className="mb-6 text-sm text-bob-ink/55">
              Imposta la password per attivare il tuo account.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="label-bob">Nuova password</label>
                <input
                  className="input-bob"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Almeno 8 caratteri"
                  required
                  minLength={8}
                  autoFocus
                />
              </div>
              <div>
                <label className="label-bob">Conferma password</label>
                <input
                  className="input-bob"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Ripeti la password"
                  required
                  minLength={8}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full py-3"
              >
                {saving ? "Salvo…" : "Imposta password e accedi"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
