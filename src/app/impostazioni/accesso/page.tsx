"use client";

// Sezione "Accesso e sicurezza": email di accesso, password, fine dell'account.
//
// PERCHE' E' CONDIVISA FRA I DUE RUOLI
// Queste tre cose non dipendono da cosa fai su Bob. Prima vivevano solo nella
// pagina account del cliente, e la pagina account del cliente rimandava via i
// professionisti alla riga 69 (`if (role === "professional") router.replace(...)`):
// il risultato e' che un professionista non aveva NESSUN modo di cambiare la
// propria password dall'applicazione.
//
// LUNGHEZZA MINIMA DELLA PASSWORD: 8, NON 6.
// Il vecchio form validava a 6 caratteri, ma la soglia su Supabase e' stata
// alzata a 8 il 9 agosto (mitigazione al posto della leaked password
// protection, non disponibile sul piano Free). Il form accettava quindi
// password che il server rifiutava, e l'utente si ritrovava un errore generico
// senza sapere perche'.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { SectionHeader } from "@/components/ImpostazioniShell";

// Deve restare allineata a Supabase > Authentication > Providers > Email.
const PASSWORD_MIN = 8;

export default function AccessoPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const [oldPwd, setOldPwd] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login?returnTo=/impostazioni/accesso");
  }, [loading, user, router]);

  async function salvaEmail(e: React.FormEvent) {
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

  async function salvaPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdErr(null);
    setPwdMsg(null);
    if (!oldPwd) {
      setPwdErr("Inserisci la password attuale.");
      return;
    }
    if (pwd.length < PASSWORD_MIN) {
      setPwdErr(`La nuova password deve avere almeno ${PASSWORD_MIN} caratteri.`);
      return;
    }
    if (pwd !== pwd2) {
      setPwdErr("Le due password nuove non coincidono.");
      return;
    }
    setSavingPwd(true);
    // Supabase non chiede la password attuale per cambiarla: la ri-verifichiamo
    // qui, altrimenti chiunque metta le mani su una sessione aperta puo'
    // prendersi l'account.
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

  if (loading || !user) {
    return (
      <div className="card p-6 text-sm text-bob-ink/50" aria-busy="true">
        Carico…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Accesso e sicurezza">
        Come entri in Bob, e come si chiude.
      </SectionHeader>

      {/* ---- Email di accesso ---- */}
      <section className="card p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-bob-ink">
          Email di accesso
        </h3>
        <p className="mt-1.5 text-sm text-bob-ink/60">
          È l&apos;indirizzo con cui entri e a cui mandiamo le comunicazioni di
          servizio.
        </p>

        <p className="mt-3 rounded-xl bg-black/[0.025] px-3.5 py-2.5 text-sm font-medium text-bob-ink">
          {user.email}
          {user.email_confirmed_at ? (
            <span className="ml-2 text-xs font-normal text-emerald-700">
              confermata
            </span>
          ) : (
            <span className="ml-2 text-xs font-normal text-amber-700">
              da confermare
            </span>
          )}
        </p>

        {!editingEmail ? (
          <button
            onClick={() => setEditingEmail(true)}
            className="btn-secondary mt-3 py-2 text-sm"
            data-testid="button-edit-email"
          >
            Cambia email
          </button>
        ) : (
          <form onSubmit={salvaEmail} className="mt-3 space-y-2">
            <label className="label-bob" htmlFor="ac-email">
              Nuovo indirizzo
            </label>
            <input
              id="ac-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="input-bob"
              autoComplete="email"
              data-testid="input-new-email"
            />
            <p className="text-xs text-bob-ink/50">
              Per sicurezza riceverai un link di conferma sia sull&apos;email
              attuale sia su quella nuova: il cambio avviene solo quando
              confermi da entrambe.
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingEmail}
                className="btn-primary py-2.5 text-sm"
                data-testid="button-save-email"
              >
                {savingEmail ? "Invio…" : "Invia i link di conferma"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingEmail(false);
                  setNewEmail("");
                  setEmailErr(null);
                }}
                className="btn-ghost text-sm"
              >
                Annulla
              </button>
            </div>
          </form>
        )}
        {emailErr && <p className="mt-2 text-sm text-red-600">{emailErr}</p>}
        {emailMsg && (
          <p className="mt-2 text-sm text-emerald-700">{emailMsg}</p>
        )}
      </section>

      {/* ---- Password ---- */}
      <form onSubmit={salvaPassword} className="card p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-bob-ink">Password</h3>
        <p className="mt-1.5 text-sm text-bob-ink/60">
          Per cambiarla serve quella attuale: è il controllo che impedisce a chi
          trova il tuo telefono sbloccato di prendersi l&apos;account.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="label-bob" htmlFor="ac-old">
              Password attuale
            </label>
            <input
              id="ac-old"
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              className="input-bob"
              autoComplete="current-password"
              data-testid="input-old-password"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-bob" htmlFor="ac-new">
                Nuova password
              </label>
              <input
                id="ac-new"
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="input-bob"
                autoComplete="new-password"
                data-testid="input-new-password"
              />
              <p className="mt-1 text-xs text-bob-ink/45">
                Almeno {PASSWORD_MIN} caratteri.
              </p>
            </div>
            <div>
              <label className="label-bob" htmlFor="ac-new2">
                Ripetila
              </label>
              <input
                id="ac-new2"
                type="password"
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                className="input-bob"
                autoComplete="new-password"
                data-testid="input-new-password-2"
              />
            </div>
          </div>
        </div>

        {pwdErr && <p className="mt-3 text-sm text-red-600">{pwdErr}</p>}
        {pwdMsg && <p className="mt-3 text-sm text-emerald-700">{pwdMsg}</p>}

        <button
          type="submit"
          disabled={savingPwd}
          className="btn-primary mt-4 py-2.5 text-sm"
          data-testid="button-save-password"
        >
          {savingPwd ? "Aggiorno…" : "Aggiorna password"}
        </button>
      </form>

      {/* ---- Chiusura dell'account ----
          Dichiarata, non nascosta. Il diritto alla cancellazione esiste
          indipendentemente dal fatto che il bottone ci sia (art. 17 GDPR), e
          una pagina "sicurezza" che non lo menziona lascia credere il
          contrario. Oggi la strada e' manuale e va detto: il percorso
          self-service ha una dipendenza aperta (le recensioni vanno
          de-identificate, non cancellate) e finche' non c'e' quella, un
          bottone qui distruggerebbe dati che devono restare. */}
      <section className="card p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-bob-ink">
          Chiudere l&apos;account
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/60">
          Puoi chiedere in qualsiasi momento la cancellazione del tuo account e
          dei dati collegati. Non è ancora un bottone: ci stiamo lavorando, e
          preferiamo dirtelo invece di far finta che la voce non esista. Nel
          frattempo la richiesta si fa scrivendoci dall&apos;indirizzo di questo
          account, e la eseguiamo entro trenta giorni.
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-bob-ink/60">
          Cosa succede: spariscono profilo, richieste, messaggi e appuntamenti.
          Le fatture, se ce ne sono, restano per il tempo che ci impone la legge.
          Le recensioni che hai scritto restano visibili senza il tuo nome,
          perché appartengono anche al professionista che le ha ricevute.
        </p>
        <Link
          href="/privacy"
          className="btn-secondary mt-4 py-2.5 text-sm"
        >
          Come esercitare i tuoi diritti
        </Link>
      </section>
    </div>
  );
}
