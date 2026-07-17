"use client";

// Account cliente: finora i clienti non avevano nessuna pagina per gestire
// i propri dati (/dashboard/profilo è riservata ai professionisti).
// Qui: nome visibile, email (sola lettura) e cambio password in-app.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, fullName, loading, refresh } = useAuth();

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);

  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  // I professionisti gestiscono i dati dal loro profilo; gli ospiti fanno login.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login?returnTo=/dashboard/account");
    else if (role === "professional") router.replace("/dashboard/profilo");
  }, [loading, user, role, router]);

  useEffect(() => {
    setName(fullName ?? "");
  }, [fullName]);

  if (loading || !user || role === "professional") {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
        Carico il tuo account…
      </div>
    );
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameErr(null);
    setNameMsg(null);
    const clean = name.trim();
    if (clean.length < 2) {
      setNameErr("Inserisci il tuo nome.");
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: clean })
      .eq("user_id", user!.id);
    if (error) {
      setNameErr("Non sono riuscito a salvare il nome. Riprova.");
    } else {
      await refresh();
      setNameMsg("Nome aggiornato.");
    }
    setSavingName(false);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdErr(null);
    setPwdMsg(null);
    if (pwd.length < 6) {
      setPwdErr("La password deve avere almeno 6 caratteri.");
      return;
    }
    if (pwd !== pwd2) {
      setPwdErr("Le due password non coincidono.");
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) {
      // Supabase rifiuta la password identica alla precedente.
      setPwdErr(
        /different from the old/i.test(error.message)
          ? "La nuova password deve essere diversa da quella attuale."
          : "Non sono riuscito ad aggiornare la password. Riprova."
      );
    } else {
      setPwd("");
      setPwd2("");
      setPwdMsg("Password aggiornata.");
    }
    setSavingPwd(false);
  }

  return (
    <div className="container-bob py-10">
      <header className="mb-7">
        <span className="section-eyebrow">Account</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          Il tuo account
        </h1>
        <p className="mt-2 text-sm text-bob-ink/60">
          Gestisci i dati con cui i professionisti ti vedono.
        </p>
        <Link
          href="/dashboard"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-bob-indigo hover:underline"
        >
          ← Torna alle richieste
        </Link>
      </header>

      <div className="grid max-w-3xl gap-5 md:grid-cols-2">
        <form onSubmit={saveName} className="card flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
            Dati personali
          </h2>
          <div>
            <label className="label-bob" htmlFor="account-name">
              Nome e cognome
            </label>
            <input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-bob mt-1.5"
              autoComplete="name"
              data-testid="input-account-name"
            />
          </div>
          <div>
            <label className="label-bob" htmlFor="account-email">
              Email
            </label>
            <input
              id="account-email"
              value={user!.email ?? ""}
              readOnly
              disabled
              className="input-bob mt-1.5 bg-black/[0.03] text-bob-ink/60"
              data-testid="input-account-email"
            />
            <p className="mt-1.5 text-xs text-bob-ink/45">
              Per cambiare email scrivici: è legata al tuo accesso.
            </p>
          </div>
          {nameErr && <p className="text-xs text-red-600">{nameErr}</p>}
          {nameMsg && <p className="text-xs text-emerald-700">{nameMsg}</p>}
          <button
            type="submit"
            disabled={savingName}
            className="btn-primary py-2.5"
            data-testid="button-save-name"
          >
            {savingName ? "Salvo…" : "Salva"}
          </button>
        </form>

        <form onSubmit={savePassword} className="card flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
            Password
          </h2>
          <div>
            <label className="label-bob" htmlFor="account-pwd">
              Nuova password
            </label>
            <input
              id="account-pwd"
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="input-bob mt-1.5"
              autoComplete="new-password"
              data-testid="input-account-password"
            />
          </div>
          <div>
            <label className="label-bob" htmlFor="account-pwd2">
              Ripeti la nuova password
            </label>
            <input
              id="account-pwd2"
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              className="input-bob mt-1.5"
              autoComplete="new-password"
              data-testid="input-account-password2"
            />
          </div>
          {pwdErr && <p className="text-xs text-red-600">{pwdErr}</p>}
          {pwdMsg && <p className="text-xs text-emerald-700">{pwdMsg}</p>}
          <button
            type="submit"
            disabled={savingPwd || !pwd}
            className="btn-primary py-2.5"
            data-testid="button-save-password"
          >
            {savingPwd ? "Salvo…" : "Aggiorna password"}
          </button>
        </form>
      </div>
    </div>
  );
}
