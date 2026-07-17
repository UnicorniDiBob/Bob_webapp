"use client";

// Account cliente v2 — layout a colonna singola, meno affollato.
// Novità rispetto alla v1: indirizzi salvati multipli con predefinito
// (tabella customer_addresses, migration 020 — Bob li propone in chat),
// cambio password protetto dalla password attuale (re-autenticazione),
// cambio email self-service con doppia conferma via mail.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

interface CityOption {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface SavedAddress {
  id: string;
  label: string;
  address_line: string;
  city_slug: string | null;
  is_default: boolean;
}

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, fullName, loading, refresh } = useAuth();

  // --- dati personali ---
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);

  // --- email ---
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  // --- indirizzi ---
  const [cities, setCities] = useState<CityOption[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addrLabel, setAddrLabel] = useState("Casa");
  const [addrLine, setAddrLine] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrErr, setAddrErr] = useState<string | null>(null);

  // --- password ---
  const [oldPwd, setOldPwd] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login?returnTo=/dashboard/account");
    else if (role === "professional") router.replace("/dashboard/profilo");
  }, [loading, user, role, router]);

  useEffect(() => {
    setName(fullName ?? "");
  }, [fullName]);

  const loadAddresses = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("customer_addresses")
      .select("id,label,address_line,city_slug,is_default")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    setAddresses((data as SavedAddress[]) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || role === "professional") return;
    loadAddresses();
    (async () => {
      const { data } = await supabase
        .from("cities")
        .select("id,name,slug,status")
        .order("name");
      setCities((data as CityOption[]) ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, loadAddresses]);

  if (loading || !user || role === "professional") {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
        Carico il tuo account…
      </div>
    );
  }

  const firstName = (fullName ?? "").split(" ")[0] || "!";

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
    if (error) setNameErr("Non sono riuscito a salvare il nome. Riprova.");
    else {
      await refresh();
      setNameMsg("Nome aggiornato.");
    }
    setSavingName(false);
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailErr(null);
    setEmailMsg(null);
    const clean = newEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setEmailErr("Scrivi un indirizzo email valido.");
      return;
    }
    if (clean === user!.email) {
      setEmailErr("È già la tua email attuale.");
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: clean });
    if (error) {
      setEmailErr(
        /already registered|already been registered/i.test(error.message)
          ? "Questa email è già usata da un altro account."
          : "Non sono riuscito ad avviare il cambio email. Riprova."
      );
    } else {
      setEmailMsg(
        `Ti ho inviato un link di conferma sia a ${user!.email} sia a ${clean}: conferma da entrambe le caselle per completare il cambio.`
      );
      setEditingEmail(false);
      setNewEmail("");
    }
    setSavingEmail(false);
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddrErr(null);
    const line = addrLine.trim();
    if (line.length < 5) {
      setAddrErr("Scrivi l'indirizzo (via e numero civico).");
      return;
    }
    setSavingAddr(true);
    const { error } = await supabase.from("customer_addresses").insert({
      user_id: user!.id,
      label: addrLabel.trim() || "Casa",
      address_line: line,
      city_slug: addrCity || null,
      is_default: addresses.length === 0, // il primo diventa predefinito
    });
    if (error) setAddrErr("Non sono riuscito a salvare l'indirizzo. Riprova.");
    else {
      setAddrLine("");
      setAddrLabel("Casa");
      setAddrCity("");
      await loadAddresses();
    }
    setSavingAddr(false);
  }

  async function makeDefault(id: string) {
    // Prima azzera il vecchio default, poi imposta il nuovo
    // (l'indice unico parziale ammette un solo default per utente).
    await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("user_id", user!.id)
      .eq("is_default", true);
    await supabase
      .from("customer_addresses")
      .update({ is_default: true })
      .eq("id", id);
    await loadAddresses();
  }

  async function removeAddress(id: string) {
    const wasDefault = addresses.find((a) => a.id === id)?.is_default;
    await supabase.from("customer_addresses").delete().eq("id", id);
    if (wasDefault) {
      const next = addresses.find((a) => a.id !== id);
      if (next) {
        await supabase
          .from("customer_addresses")
          .update({ is_default: true })
          .eq("id", next.id);
      }
    }
    await loadAddresses();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdErr(null);
    setPwdMsg(null);
    if (!oldPwd) {
      setPwdErr("Inserisci la password attuale.");
      return;
    }
    if (pwd.length < 6) {
      setPwdErr("La nuova password deve avere almeno 6 caratteri.");
      return;
    }
    if (pwd !== pwd2) {
      setPwdErr("Le due password nuove non coincidono.");
      return;
    }
    setSavingPwd(true);
    // Verifica della password attuale: Supabase non la richiede da solo,
    // quindi re-autentichiamo prima di aggiornare.
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user!.email ?? "",
      password: oldPwd,
    });
    if (authErr) {
      setPwdErr("La password attuale non è corretta.");
      setSavingPwd(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) {
      setPwdErr(
        /different from the old/i.test(error.message)
          ? "La nuova password deve essere diversa da quella attuale."
          : "Non sono riuscito ad aggiornare la password. Riprova."
      );
    } else {
      setOldPwd("");
      setPwd("");
      setPwd2("");
      setPwdMsg("Password aggiornata.");
    }
    setSavingPwd(false);
  }

  const cityName = (slug: string | null) =>
    cities.find((c) => c.slug === slug)?.name ?? null;

  return (
    <div className="container-bob py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <span className="section-eyebrow">Account</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
            Ciao {firstName} 👋
          </h1>
          <p className="mt-2 text-sm text-bob-ink/60">
            Qui gestisci i tuoi dati, gli indirizzi che Bob usa per cercare i
            professionisti e la sicurezza del tuo accesso.
          </p>
          <Link
            href="/dashboard"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-bob-indigo hover:underline"
          >
            ← Torna alle richieste
          </Link>
        </header>

        <div className="flex flex-col gap-6">
          {/* ---- Dati personali ---- */}
          <form onSubmit={saveName} className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
              Dati personali
            </h2>
            <p className="mt-1 text-xs text-bob-ink/45">
              È il nome che i professionisti vedono nei messaggi.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
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
              <button
                type="submit"
                disabled={savingName}
                className="btn-primary py-2.5 sm:w-auto"
                data-testid="button-save-name"
              >
                {savingName ? "Salvo…" : "Salva"}
              </button>
            </div>
            {nameErr && <p className="mt-2 text-xs text-red-600">{nameErr}</p>}
            {nameMsg && (
              <p className="mt-2 text-xs text-emerald-700">{nameMsg}</p>
            )}
          </form>

          {/* ---- Email ---- */}
          <section className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
              Email di accesso
            </h2>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-bob-ink">{user!.email}</p>
              {!editingEmail && (
                <button
                  onClick={() => {
                    setEditingEmail(true);
                    setEmailMsg(null);
                  }}
                  className="btn-secondary py-2 text-sm"
                  data-testid="button-edit-email"
                >
                  Cambia email
                </button>
              )}
            </div>
            {editingEmail && (
              <form onSubmit={saveEmail} className="mt-4">
                <label className="label-bob" htmlFor="account-new-email">
                  Nuova email
                </label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="account-new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nuova@email.it"
                    className="input-bob flex-1"
                    autoComplete="email"
                    data-testid="input-new-email"
                  />
                  <button
                    type="submit"
                    disabled={savingEmail || !newEmail.trim()}
                    className="btn-primary py-2.5"
                    data-testid="button-save-email"
                  >
                    {savingEmail ? "Invio…" : "Invia conferma"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEmail(false);
                      setEmailErr(null);
                    }}
                    className="btn-ghost py-2.5"
                  >
                    Annulla
                  </button>
                </div>
                <p className="mt-2 text-xs text-bob-ink/45">
                  Per sicurezza riceverai un link di conferma sia sulla email
                  attuale sia su quella nuova.
                </p>
              </form>
            )}
            {emailErr && <p className="mt-2 text-xs text-red-600">{emailErr}</p>}
            {emailMsg && (
              <p className="mt-2 text-xs text-emerald-700">{emailMsg}</p>
            )}
          </section>

          {/* ---- Indirizzi ---- */}
          <section className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
              I tuoi indirizzi
            </h2>
            <p className="mt-1 text-xs text-bob-ink/45">
              Bob li usa quando cerchi un professionista: quello predefinito
              viene proposto per primo in chat.
            </p>

            {addresses.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {addresses.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 bg-black/[0.015] px-3.5 py-2.5"
                    data-testid={`address-${a.id}`}
                  >
                    <span className="text-lg">📍</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-bob-ink">
                        {a.label}
                        {a.is_default && (
                          <span className="ml-2 rounded-full bg-bob-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-bob-indigo">
                            Predefinito
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-bob-ink/60">
                        {a.address_line}
                        {cityName(a.city_slug)
                          ? ` · ${cityName(a.city_slug)}`
                          : ""}
                      </p>
                    </div>
                    {!a.is_default && (
                      <button
                        onClick={() => makeDefault(a.id)}
                        className="text-xs font-medium text-bob-indigo hover:underline"
                        data-testid={`address-default-${a.id}`}
                      >
                        Usa come predefinito
                      </button>
                    )}
                    <button
                      onClick={() => removeAddress(a.id)}
                      className="rounded-lg px-2 py-1 text-xs text-bob-ink/40 hover:bg-black/5 hover:text-red-600"
                      aria-label={`Elimina ${a.label}`}
                      data-testid={`address-delete-${a.id}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={addAddress} className="mt-4 rounded-xl bg-bob-indigo-50/50 p-4">
              <p className="text-xs font-semibold text-bob-ink/60">
                Aggiungi un indirizzo
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[110px_1fr_150px]">
                <input
                  value={addrLabel}
                  onChange={(e) => setAddrLabel(e.target.value)}
                  placeholder="Etichetta"
                  className="input-bob py-2.5"
                  data-testid="input-address-label"
                />
                <input
                  value={addrLine}
                  onChange={(e) => setAddrLine(e.target.value)}
                  placeholder="Via e numero civico"
                  className="input-bob py-2.5"
                  autoComplete="street-address"
                  data-testid="input-address-line"
                />
                <select
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  className="input-bob py-2.5"
                  data-testid="select-address-city"
                >
                  <option value="">Città…</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                      {c.status !== "active" ? " (in arrivo)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              {addrErr && <p className="mt-2 text-xs text-red-600">{addrErr}</p>}
              <button
                type="submit"
                disabled={savingAddr || !addrLine.trim()}
                className="btn-secondary mt-3 py-2 text-sm"
                data-testid="button-add-address"
              >
                {savingAddr ? "Salvo…" : "+ Salva indirizzo"}
              </button>
            </form>
          </section>

          {/* ---- Password ---- */}
          <form onSubmit={savePassword} className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
              Password
            </h2>
            <p className="mt-1 text-xs text-bob-ink/45">
              Per cambiarla serve la password attuale.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label-bob" htmlFor="account-old-pwd">
                  Password attuale
                </label>
                <input
                  id="account-old-pwd"
                  type="password"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  className="input-bob mt-1.5"
                  autoComplete="current-password"
                  data-testid="input-old-password"
                />
              </div>
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
                  Ripeti la nuova
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
            </div>
            {pwdErr && <p className="mt-2 text-xs text-red-600">{pwdErr}</p>}
            {pwdMsg && <p className="mt-2 text-xs text-emerald-700">{pwdMsg}</p>}
            <button
              type="submit"
              disabled={savingPwd || !oldPwd || !pwd}
              className="btn-primary mt-4 py-2.5"
              data-testid="button-save-password"
            >
              {savingPwd ? "Salvo…" : "Aggiorna password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
