"use client";

// GLI ACCOUNT DI QUESTO BROWSER, COME SEZIONE (01/10, Lucio).
//
// PERCHE' NON E' PIU' UNA TENDINA. Fino a ieri in fondo alla colonna delle
// impostazioni c'era il cerchio dell'account, e cliccandolo si apriva verso
// l'alto la stessa tendina dell'intestazione. In una pagina fatta di righe
// ferme, un menu che si apre a meta' schermo e copre il resto e' l'unica cosa
// che si muove: si nota, e si nota nel modo sbagliato. Qui dentro le stesse
// azioni sono righe come le altre — si vedono tutte insieme, senza aprire
// niente.
//
// PERCHE' STA IN «ACCESSO E SICUREZZA» E NON ALTROVE. Perche' e' la stessa
// domanda delle due sezioni sopra: con che email entro, con che password, e
// quali account vivono in questo browser. Metterla in fondo alla colonna la
// rendeva una cosa a parte, raggiungibile da ogni sezione e appartenente a
// nessuna.
//
// QUESTA E' ANCHE L'UNICA PORTA SU TELEFONO. Il cerchio dell'intestazione sta
// in un blocco `hidden md:flex`: sotto i 768px non esiste. Da li' in giu'
// questa sezione e' l'unico posto da cui si cambia account e si esce. Se un
// giorno va spostata, va spostata — non tolta.

import { useMemo, useState } from "react";
import Link from "next/link";
import { LogOut, UserPlus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { scambiaAccount } from "@/lib/sessioni/client";
import { coloreAccount } from "@/lib/coloreAccount";
import { iniziali, percorsoAggiungiAccount } from "@/components/AccountTendina";

function Cerchio({
  testo,
  email,
}: {
  testo: string;
  email: string | null | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: coloreAccount(email) }}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
    >
      {testo}
    </span>
  );
}

export function AccountSezione() {
  const { user, fullName, altroAccount, signOut, loading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function passa() {
    setInCorso(true);
    setErrore(null);
    const r = await scambiaAccount(supabase);
    // Se riesce, la pagina si ricarica da sola sull'altro account.
    if (!r.ok) {
      setInCorso(false);
      setErrore(
        r.motivo === "da_riconnettere"
          ? "Quell'account va riconnesso: sei rimasto su questo."
          : "Non sono riuscito a cambiare account: sei rimasto su questo."
      );
    }
  }

  if (loading || !user) return null;

  const nome = fullName?.trim() || null;
  const email = user.email ?? "";
  const sigla = iniziali(nome, email);

  return (
    <section className="card p-5 sm:p-6" data-testid="sezione-account">
      <h3 className="text-sm font-semibold text-bob-ink">
        Account in questo browser
      </h3>
      <p className="mt-1.5 text-sm text-bob-ink/70">
        Puoi tenerne due e passare dall&apos;uno all&apos;altro senza
        riscrivere la password. Vale solo su questo dispositivo: su un altro
        browser ricominci da capo.
      </p>

      {/* Quello con cui stai lavorando adesso. Non e' un bottone: ci sei gia'. */}
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-black/[0.025] px-3.5 py-3">
        <Cerchio testo={sigla} email={email} />
        <span className="min-w-0">
          {nome && (
            <span className="block truncate text-sm font-semibold text-bob-ink">
              {nome}
            </span>
          )}
          <span className="block truncate text-sm text-bob-ink/70">{email}</span>
          <span className="mt-0.5 block text-xs text-bob-ink/65">
            Stai usando questo
          </span>
        </span>
      </div>

      {/* L'altro, se c'e'. «Da riconnettere» non e' un'etichetta decorativa:
          cambia dove si va cliccando, quindi va detto. */}
      {altroAccount &&
        (altroAccount.daRiconnettere ? (
          <Link
            href={percorsoAggiungiAccount(
              "/impostazioni/accesso",
              altroAccount.email
            )}
            className="mt-2 flex items-center gap-3 rounded-xl border border-black/10 px-3.5 py-3 transition hover:bg-bob-indigo-50"
            data-testid="riga-account-da-riconnettere"
          >
            <Cerchio
              testo={iniziali(null, altroAccount.email)}
              email={altroAccount.email}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm text-bob-ink">
                {altroAccount.email}
              </span>
              <span className="block text-xs text-amber-800">
                Da riconnettere: accedi di nuovo per usarlo
              </span>
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={passa}
            disabled={inCorso}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border border-black/10 px-3.5 py-3 text-left transition hover:bg-bob-indigo-50 disabled:opacity-50"
            data-testid="riga-account-altro"
          >
            <Cerchio
              testo={iniziali(null, altroAccount.email)}
              email={altroAccount.email}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm text-bob-ink">
                {altroAccount.email}
              </span>
              <span className="block text-xs text-bob-ink/65">
                Passa a questo
              </span>
            </span>
          </button>
        ))}

      {errore && (
        <p
          role="alert"
          className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          {errore}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-black/5 pt-4">
        {/* Due account al massimo in un browser: con l'altro gia' dentro,
            aggiungerne un terzo non si puo', quindi il bottone non c'e'. */}
        {!altroAccount && (
          <Link
            href={percorsoAggiungiAccount("/impostazioni/accesso")}
            className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm"
            data-testid="button-aggiungi-account"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Aggiungi un altro account
          </Link>
        )}
        {/* «Esci» esce solo da questo account e solo qui: se ce n'e' un altro,
            diventa attivo quello. */}
        <button
          type="button"
          onClick={() => {
            setInCorso(true);
            setErrore(null);
            void signOut();
          }}
          disabled={inCorso}
          className="btn-ghost inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
          data-testid="button-signout"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Esci
        </button>
      </div>
      <p className="mt-2 text-xs text-bob-ink/65">
        {altroAccount
          ? "Uscendo resti dentro con l'altro account, non ti buttiamo fuori da tutti e due."
          : "Esci solo da qui: gli altri dispositivi restano come sono."}
      </p>
    </section>
  );
}
