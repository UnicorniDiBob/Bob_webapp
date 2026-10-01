"use client";

// LA TENDINA DEGLI ACCOUNT (30/09) — traccia Client/Pro, di André.
//
// Il modello e' Gmail: clicchi il tuo nome e vedi gli account di questo
// browser, il tuo in cima e gli altri sotto; clicchi quello che vuoi e ci
// passi. Niente etichette «attivo» / «in attesa» (sono parole nostre, non
// dell'utente) e niente pulsante «Passa a X»: e' l'account stesso a essere
// cliccabile. «Da riconnettere» invece resta, perche' cambia cosa succede se
// ci clicchi.
//
// In fondo, «Impostazioni» ed «Esci». «Esci» esce solo dall'account attivo,
// solo in questo browser: se ce n'e' un altro, diventa attivo quello
// (NOTE_E_DECISIONI 30/09). «Esci da tutti» non c'e' piu' nell'interfaccia.
//
// UNA FORMA SOLA, E «AGGIUNGI UN ALTRO ACCOUNT» NON STA PIU' QUI (01/10,
// Lucio e André). La tendina esisteva in due forme: questa, nel cerchio
// dell'intestazione, e una «colonna» in fondo alle impostazioni. Due posti da
// cui si fa la stessa cosa sono due posti in cui cercarla, e la seconda si
// apriva per giunta verso l'alto in mezzo a una pagina di impostazioni, dove
// tutto il resto sono righe ferme. Adesso il cerchio resta la via rapida —
// cambia account, vai nelle impostazioni, esci — mentre GESTIRE gli account
// (aggiungerne uno, riconnetterlo) e' una sezione vera in
// /impostazioni/accesso: vedi `AccountSezione.tsx`.
//
// ATTENZIONE, SE TOCCHI QUESTO FILE: il cerchio sta in un blocco
// `hidden md:flex` dell'header, quindi su telefono NON c'e'. Da li' in giu'
// l'unica strada per uscire e per cambiare account e' quella sezione delle
// impostazioni. Toglierla senza rimpiazzarla lascia chi usa il telefono
// dentro l'account, senza porta.
//
// Nessuna voce «casa»: lo staff non ne ha una (/dashboard lo rimanda in
// /admin), e qui non serve a nessuno.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { scambiaAccount } from "@/lib/sessioni/client";
import { coloreAccount } from "@/lib/coloreAccount";

/**
 * Dove si va per aggiungere o riconnettere un account: il pannello di accesso
 * in modalita' «aggiungi» (R6, AccessoAggiuntivo), che alla fine riporta a
 * `ritorno` con l'account attivo intatto. Il ritorno lo ricontrolla /login
 * (ritornoInterno): qui non ci si fida di se stessi.
 */
export function percorsoAggiungiAccount(ritorno: string, riconnetti?: string): string {
  const q = new URLSearchParams({ aggiungi: "1", returnTo: ritorno });
  if (riconnetti) q.set("email", riconnetti);
  return `/login?${q.toString()}`;
}

/** Iniziali per il cerchio: dal nome se c'e', altrimenti dall'email. */
export function iniziali(nome: string | null | undefined, email: string | null | undefined): string {
  const parole = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (parole.length >= 2) return (parole[0][0] + parole[parole.length - 1][0]).toUpperCase();
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase();
  const e = (email ?? "").trim();
  return e ? e[0].toUpperCase() : "?";
}

/**
 * Il cerchio con le iniziali. IL COLORE VIENE DALL'EMAIL (01/10, Lucio): con
 * due account nello stesso browser due cerchi identici obbligano a leggere le
 * iniziali per sapere dove sei. Vedi `lib/coloreAccount.ts` per il perche'
 * l'email e non una colonna sul profilo.
 */
function Cerchio({
  testo,
  email,
  piccolo,
}: {
  testo: string;
  email: string | null | undefined;
  piccolo?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: coloreAccount(email) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        piccolo ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"
      }`}
    >
      {testo}
    </span>
  );
}

export function AccountTendina() {
  const { user, fullName, altroAccount, signOut, loading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [aperta, setAperta] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const radice = useRef<HTMLDivElement>(null);
  const bottone = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const idMenu = useId();
  const pathname = usePathname();

  const voci = () =>
    Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  function chiudi(riportaIlFuoco = true) {
    setAperta(false);
    if (riportaIlFuoco) bottone.current?.focus();
  }

  // Click fuori: chiude, senza rubare il fuoco a dove l'utente ha cliccato.
  useEffect(() => {
    if (!aperta) return;
    const fuori = (e: MouseEvent | TouchEvent) => {
      if (radice.current && !radice.current.contains(e.target as Node)) chiudi(false);
    };
    document.addEventListener("mousedown", fuori);
    document.addEventListener("touchstart", fuori);
    return () => {
      document.removeEventListener("mousedown", fuori);
      document.removeEventListener("touchstart", fuori);
    };
  }, [aperta]);

  // Aperta da tastiera o col mouse, il fuoco va alla prima voce: cosi' le
  // frecce funzionano subito.
  useEffect(() => {
    if (aperta) voci()[0]?.focus();
  }, [aperta]);

  function suTastoBottone(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAperta(true);
    }
  }

  function suTastoMenu(e: React.KeyboardEvent) {
    const elenco = voci();
    const i = elenco.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      chiudi();
    } else if (e.key === "Tab") {
      chiudi(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      elenco[(i + 1) % elenco.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      elenco[(i - 1 + elenco.length) % elenco.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      elenco[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      elenco[elenco.length - 1]?.focus();
    }
  }

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

  async function esci() {
    setInCorso(true);
    setErrore(null);
    // signOut ricarica la pagina: sull'altro account se c'e', se no verso la home.
    await signOut();
  }

  if (loading || !user) return null;

  const mio = { nome: fullName?.trim() || null, email: user.email ?? "" };
  const sigla = iniziali(mio.nome, mio.email);

  const voce =
    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-bob-ink transition hover:bg-bob-indigo-50 focus:bg-bob-indigo-50 focus:outline-none disabled:opacity-50";

  return (
    <div ref={radice} className="relative" data-testid="account-tendina-header">
      <button
        ref={bottone}
        type="button"
        onClick={() => setAperta((a) => !a)}
        onKeyDown={suTastoBottone}
        aria-haspopup="menu"
        aria-expanded={aperta}
        aria-controls={idMenu}
        aria-label={`Account: ${mio.nome ?? mio.email}`}
        title={mio.nome ?? mio.email}
        className="rounded-full p-1 transition hover:bg-bob-indigo-50 focus:outline-none focus:ring-2 focus:ring-bob-indigo/30"
        data-testid="button-account-header"
        data-tour="impostazioni"
      >
        <Cerchio testo={sigla} email={mio.email} piccolo />
      </button>

      {aperta && (
        <div
          ref={menu}
          id={idMenu}
          role="menu"
          aria-label="Account in questo browser"
          onKeyDown={suTastoMenu}
          className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-black/10 bg-white py-2 shadow-card-hover"
        >
          {/* Il tuo account, in cima. Non e' una voce: ci sei gia'. */}
          <div className="flex items-center gap-3 px-4 pb-3 pt-1.5">
            <Cerchio testo={sigla} email={mio.email} />
            <span className="min-w-0">
              {mio.nome && <span className="block truncate text-sm font-semibold text-bob-ink">{mio.nome}</span>}
              <span className="block truncate text-xs text-bob-ink/70">{mio.email}</span>
            </span>
          </div>

          {altroAccount && (
            <div className="border-t border-black/5 py-1">
              {altroAccount.daRiconnettere ? (
                <Link
                  role="menuitem"
                  href={percorsoAggiungiAccount(pathname, altroAccount.email)}
                  onClick={() => chiudi(false)}
                  className={voce}
                  data-testid="voce-account-da-riconnettere"
                >
                  <Cerchio
                    testo={iniziali(null, altroAccount.email)}
                    email={altroAccount.email}
                    piccolo
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{altroAccount.email}</span>
                    <span className="block text-xs text-amber-800">
                      Da riconnettere: accedi di nuovo per usarlo
                    </span>
                  </span>
                </Link>
              ) : (
                <button
                  role="menuitem"
                  type="button"
                  onClick={passa}
                  disabled={inCorso}
                  className={voce}
                  data-testid="voce-account-altro"
                >
                  <Cerchio
                    testo={iniziali(null, altroAccount.email)}
                    email={altroAccount.email}
                    piccolo
                  />
                  <span className="block min-w-0 truncate">{altroAccount.email}</span>
                </button>
              )}
            </div>
          )}

          {errore && (
            <p role="alert" className="mx-4 my-1 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {errore}
            </p>
          )}

          <div className="border-t border-black/5 pt-1">
            <Link
              role="menuitem"
              href="/impostazioni"
              onClick={() => chiudi(false)}
              className={voce}
              data-testid="voce-impostazioni"
            >
              <Settings className="h-4 w-4 text-bob-ink/70" aria-hidden="true" />
              Impostazioni
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={esci}
              disabled={inCorso}
              className={voce}
              data-testid="button-signout"
            >
              <LogOut className="h-4 w-4 text-bob-ink/70" aria-hidden="true" />
              Esci
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
