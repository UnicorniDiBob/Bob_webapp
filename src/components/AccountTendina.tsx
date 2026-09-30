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
// In fondo, «Aggiungi un altro account» ed «Esci». «Esci» esce solo
// dall'account attivo, solo in questo browser: se ce n'e' un altro, diventa
// attivo quello (NOTE_E_DECISIONI 30/09). «Esci da tutti» non c'e' piu'
// nell'interfaccia.
//
// Due forme, stessa tendina:
//   - «colonna»: il blocco in fondo alla colonna delle impostazioni (e in
//     fondo alla pagina dove la colonna non c'e'); si apre verso l'alto.
//   - «header»: il cerchio con le iniziali nell'intestazione; si apre verso
//     il basso. E' l'unica strada per uscire da una pagina che non sia
//     /impostazioni, e per lo staff, che vive in /admin, e' quella di tutti
//     i giorni.
//
// Nessuna voce «casa»: lo staff non ne ha una (/dashboard lo rimanda in
// /admin), e qui non serve a nessuno.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Settings, UserPlus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { scambiaAccount } from "@/lib/sessioni/client";

/**
 * Dove si va per aggiungere o riconnettere un account. Un punto solo, perche'
 * cambiera': oggi e' il modulo in /impostazioni/accesso, domani il pannello di
 * accesso (R6, feat/aggiungi-account-dal-login).
 */
export function percorsoAggiungiAccount(riconnetti?: string): string {
  return riconnetti
    ? `/impostazioni/accesso?riconnetti=${encodeURIComponent(riconnetti)}#aggiungi-account`
    : "/impostazioni/accesso?aggiungi=1#aggiungi-account";
}

/** Iniziali per il cerchio: dal nome se c'e', altrimenti dall'email. */
export function iniziali(nome: string | null | undefined, email: string | null | undefined): string {
  const parole = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (parole.length >= 2) return (parole[0][0] + parole[parole.length - 1][0]).toUpperCase();
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase();
  const e = (email ?? "").trim();
  return e ? e[0].toUpperCase() : "?";
}

function Cerchio({ testo, piccolo }: { testo: string; piccolo?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-bob-indigo font-semibold text-white ${
        piccolo ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"
      }`}
    >
      {testo}
    </span>
  );
}

export function AccountTendina({ forma }: { forma: "colonna" | "header" }) {
  const { user, fullName, altroAccount, signOut, loading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [aperta, setAperta] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const radice = useRef<HTMLDivElement>(null);
  const bottone = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const idMenu = useId();

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
    <div ref={radice} className="relative" data-testid={`account-tendina-${forma}`}>
      {forma === "colonna" ? (
        <button
          ref={bottone}
          type="button"
          onClick={() => setAperta((a) => !a)}
          onKeyDown={suTastoBottone}
          aria-haspopup="menu"
          aria-expanded={aperta}
          aria-controls={idMenu}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition hover:bg-black/[0.03] focus:outline-none focus:ring-2 focus:ring-bob-indigo/30"
          data-testid="button-account-colonna"
        >
          <Cerchio testo={sigla} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-bob-ink">{mio.nome ?? mio.email}</span>
            <span className="block text-xs text-bob-ink/65">Impostazioni</span>
          </span>
        </button>
      ) : (
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
          <Cerchio testo={sigla} piccolo />
        </button>
      )}

      {aperta && (
        <div
          ref={menu}
          id={idMenu}
          role="menu"
          aria-label="Account in questo browser"
          onKeyDown={suTastoMenu}
          className={`absolute z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-black/10 bg-white py-2 shadow-card-hover ${
            forma === "colonna" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"
          }`}
        >
          {/* Il tuo account, in cima. Non e' una voce: ci sei gia'. */}
          <div className="flex items-center gap-3 px-4 pb-3 pt-1.5">
            <Cerchio testo={sigla} />
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
                  href={percorsoAggiungiAccount(altroAccount.email)}
                  onClick={() => chiudi(false)}
                  className={voce}
                  data-testid="voce-account-da-riconnettere"
                >
                  <Cerchio testo={iniziali(null, altroAccount.email)} piccolo />
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
                  <Cerchio testo={iniziali(null, altroAccount.email)} piccolo />
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
            {forma === "header" && (
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
            )}
            {/* Due account al massimo in un browser: con l'altro gia' dentro,
                aggiungerne un terzo non si puo', quindi la voce non c'e'. */}
            {!altroAccount && (
              <Link
                role="menuitem"
                href={percorsoAggiungiAccount()}
                onClick={() => chiudi(false)}
                className={voce}
                data-testid="voce-aggiungi-account"
              >
                <UserPlus className="h-4 w-4 text-bob-ink/70" aria-hidden="true" />
                Aggiungi un altro account
              </Link>
            )}
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
