"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Settings, UserCog } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "./AuthProvider";
import { NotificheCampanella } from "./NotificheCampanella";
import { useNotifiche } from "./NotificheProvider";
import { VERIFICATION_LABEL } from "@/lib/vat";
import { BadgeCheck } from "lucide-react";

const NAV = [
  { href: "/come-funziona", label: "Come funziona" },
  { href: "/citta", label: "Città" },
  { href: "/servizi", label: "Servizi" },
  { href: "/professionisti", label: "Professionisti" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, verificationLevel, signOut, loading } = useAuth();
  const { daContare } = useNotifiche();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/85 backdrop-blur-md">
      <div className="container-bob flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center" data-testid="link-home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "text-bob-indigo"
                    : "text-bob-ink/70 hover:text-bob-indigo"
                }`}
                data-testid={`nav-${item.href.slice(1)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {(role === "admin" || role === "cs") && (
            <Link
              href="/admin"
              className="btn-ghost inline-flex items-center gap-1.5 font-semibold text-bob-indigo"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Admin
            </Link>
          )}
          {!loading && user ? (
            <div className="flex items-center gap-2">
              {role !== "professional" && role !== "admin" && role !== "cs" && (
                <Link
                  href="/#bob"
                  className="btn-primary py-2"
                  data-testid="link-talk-to-bob-auth"
                >
                  Parla con Bob
                </Link>
              )}
              {/* Il professionista verificato deve vederselo scritto: è la
                  stessa etichetta che vedono i clienti sul suo profilo. */}
              {role === "professional" &&
                verificationLevel &&
                verificationLevel !== "none" && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                    title="Il tuo profilo è verificato: i clienti vedono questa etichetta con la data del controllo."
                    data-testid="header-verification-level"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {VERIFICATION_LABEL[verificationLevel]}
                  </span>
                )}
              {/* IL BOTTONE VISIBILE E' IL LAVORO, NON L'ACCOUNT (19/08).
                  Prima c'era una sola voce, «Account», identica per cliente e
                  professionista: non diceva ne' cosa ci fosse dentro ne' per
                  chi. Adesso il bottone porta a cio' che serve ogni giorno e
                  l'etichetta dipende dal ruolo; la configurazione sta
                  nell'icona accanto. */}
              {/* LA CAMPANELLA (30/08). Le comunicazioni di servizio —
                  verifica, risposte dell'assistenza, profilo invisibile —
                  vivevano su quattro pagine diverse e si vedevano solo per
                  caso. Sta qui perche' l'header e' l'unico posto presente su
                  ogni pagina, e prima del bottone del lavoro perche' e'
                  un avviso, non una destinazione. Gli account staff non ne
                  hanno: le loro cose stanno in /admin. */}
              {role !== "admin" && role !== "cs" && <NotificheCampanella />}
              <Link
                href="/dashboard"
                className="btn-secondary py-2"
                data-testid="link-dashboard"
              >
                {role === "professional" ? "Il mio lavoro" : "I miei lavori"}
              </Link>
              {/* Icona e non parola: si apre raramente e non deve competere col
                  bottone del lavoro. UserCog e non Settings perche' quella
                  chiave e' gia' usata sopra per il pannello Admin, e due
                  ingranaggi diversi nello stesso header si confondono. */}
              <Link
                href="/impostazioni/dati"
                className="rounded-xl p-2.5 text-bob-ink/55 transition hover:bg-bob-indigo-50 hover:text-bob-indigo"
                aria-label="Impostazioni del tuo account"
                title="Impostazioni"
                data-testid="link-impostazioni"
                data-tour="impostazioni"
              >
                <UserCog className="h-5 w-5" aria-hidden="true" />
              </Link>
              <button
                onClick={handleSignOut}
                className="btn-ghost"
                data-testid="button-signout"
              >
                Esci
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn-ghost" data-testid="link-login">
                Accedi
              </Link>
              <Link
                href="/#bob"
                className="btn-primary py-2"
                data-testid="link-talk-to-bob"
              >
                Parla con Bob
              </Link>
            </div>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-bob-ink md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Apri menu"
          data-testid="button-menu"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-black/5 bg-white md:hidden">
          <div className="container-bob flex flex-col gap-1 py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-bob-ink/80 hover:bg-bob-indigo-50"
              >
                {item.label}
              </Link>
            ))}
            {(role === "admin" || role === "cs") && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-bob-indigo hover:bg-bob-indigo-50"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Admin
              </Link>
            )}
            {/* flex-wrap: con la campanella le voci sono cinque e su un
                telefono stretto si schiacciavano l'una sull'altra. */}
            <div className="mt-2 flex flex-wrap gap-2">
              {user ? (
                <>
                  {role !== "professional" && role !== "admin" && role !== "cs" && (
                    <Link href="/#bob" onClick={() => setOpen(false)} className="btn-primary flex-1 py-2" data-testid="link-talk-to-bob-mobile">
                      Parla con Bob
                    </Link>
                  )}
                  <Link href="/dashboard" onClick={() => setOpen(false)} className="btn-secondary flex-1 py-2">
                    {role === "professional" ? "Il mio lavoro" : "I miei lavori"}
                    {role === "professional" &&
                      verificationLevel &&
                      verificationLevel !== "none" &&
                      ` · ${VERIFICATION_LABEL[verificationLevel]}`}
                  </Link>
                  {/* Su mobile l'icona da sola sarebbe un bersaglio ambiguo in
                      mezzo al menu: qui la voce e' scritta. */}
                  {role !== "admin" && role !== "cs" && (
                    <Link
                      href="/notifiche"
                      onClick={() => setOpen(false)}
                      className="btn-ghost inline-flex items-center gap-1.5"
                      data-testid="link-notifiche-mobile"
                    >
                      <Bell className="h-4 w-4" aria-hidden="true" />
                      Notifiche
                      {daContare > 0 && (
                        <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-bob-indigo px-1 text-[10px] font-bold leading-none text-white">
                          {daContare > 9 ? "9+" : daContare}
                        </span>
                      )}
                    </Link>
                  )}
                  <Link
                    href="/impostazioni/dati"
                    onClick={() => setOpen(false)}
                    className="btn-ghost inline-flex items-center gap-1.5"
                    data-testid="link-impostazioni-mobile"
                  >
                    <UserCog className="h-4 w-4" aria-hidden="true" />
                    Impostazioni
                  </Link>
                  <button onClick={handleSignOut} className="btn-ghost">
                    Esci
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost flex-1 py-2">
                    Accedi
                  </Link>
                  <Link href="/#bob" onClick={() => setOpen(false)} className="btn-primary flex-1 py-2">
                    Parla con Bob
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
