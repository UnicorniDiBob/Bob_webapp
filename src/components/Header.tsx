"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, LogIn, Settings, UserCog } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "./AuthProvider";
import { AccountTendina } from "./AccountTendina";
import { NotificheCampanella } from "./NotificheCampanella";
import { useNotifiche } from "./NotificheProvider";
import { VERIFICATION_LABEL } from "@/lib/vat";
import { BadgeCheck } from "lucide-react";

// Quattro voci e non di piu', decise con André il 12 settembre. Prima erano
// quattro diverse (Come funziona, Città, Servizi, Professionisti) e mescolavano
// due pubblici: chi cerca un servizio e chi lavora.
//
// «Città» esce dalla barra: adesso vive nel piede e nella sitemap. È la voce
// che serviva meno finché il pilota è una città sola.
const NAV = [
  { href: "/servizi", label: "Servizi" },
  { href: "/per-i-professionisti", label: "Per i professionisti" },
  // «Aiuto» punta all'assistenza esistente. Quella vera — parlare con Bob dei
  // problemi della piattaforma, non dei servizi — è un lavoro a sé.
  { href: "/supporto", label: "Aiuto" },
];

/**
 * Una voce del menu del telefono (15/10): a tutta larghezza, almeno 48px.
 * Icona e scritta stanno insieme in un gruppo che tiene la sua larghezza
 * naturale (flex-auto); l'eventuale contatore o etichetta sta in fondo alla
 * riga e, se non c'e' posto, scende sotto invece di stringere la scritta. Con
 * un testo enorme la scritta va a capo accanto alla sua icona, mai schiacciata.
 */
function RigaMenu({
  href,
  icona,
  etichetta,
  coda,
  attiva,
  onClick,
  colore = attiva ? "text-bob-ink" : "text-bob-ink/80",
  peso = "font-medium",
  testId,
}: {
  href: string;
  icona?: React.ReactNode;
  etichetta: string;
  coda?: React.ReactNode;
  attiva: boolean;
  onClick: () => void;
  colore?: string;
  peso?: string;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={attiva ? "page" : undefined}
      className={`flex min-h-[48px] w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm transition hover:bg-bob-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40 ${peso} ${colore} ${
        attiva ? "bg-bob-indigo-50/70" : ""
      }`}
      data-testid={testId}
    >
      <span className="flex min-w-0 flex-auto items-center gap-3">
        {icona}
        <span className="min-w-0">{etichetta}</span>
      </span>
      {coda && <span className="ml-auto shrink-0">{coda}</span>}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  /** La pagina corrente: l'indirizzo stesso o una sua sotto-pagina. */
  const corrente = (href: string) =>
    pathname === href || Boolean(pathname?.startsWith(`${href}/`));
  const { user, role, verificationLevel, loading } = useAuth();
  const { daContare } = useNotifiche();
  const [open, setOpen] = useState(false);
  const chiudi = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/85 backdrop-blur-md">
      <div className="container-bob flex h-20 items-center justify-between gap-4">
        <Link href="/" className="flex items-center" data-testid="link-home">
          <Logo dimensione="grande" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-base font-medium transition ${
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
              {/* LA CASETTA (30/09). Al posto di «Il mio lavoro» / «I miei
                  lavori»: con un ruolo per account /dashboard ha un
                  significato solo, e l'icona basta (spike doppio cappello
                  §9, voce 2). Lo staff non ha casa: /dashboard lo rimanda
                  in /admin, che ha gia' la sua voce. */}
              {role !== "admin" && role !== "cs" && (
                <Link
                  href="/dashboard"
                  className="rounded-xl p-2.5 text-bob-ink/70 transition hover:bg-bob-indigo-50 hover:text-bob-indigo"
                  aria-label="La tua area"
                  title="La tua area"
                  data-testid="link-dashboard"
                >
                  <House className="h-5 w-5" aria-hidden="true" />
                </Link>
              )}
              {/* IL CERCHIO DELL'ACCOUNT (30/09, modello Gmail). Al posto
                  dell'icona delle impostazioni e del pulsante «Esci»: apre la
                  tendina con gli account di questo browser, le impostazioni
                  ed «Esci». «Esci» non sta piu' nell'header da solo
                  (NOTE_E_DECISIONI 30/09). Vale anche per lo staff, che vive
                  in /admin e da li' deve poter uscire.
                  «Aggiungi un altro account» non e' piu' qui dentro (01/10):
                  stava anche in fondo alle impostazioni, e due posti per la
                  stessa cosa sono due posti in cui cercarla. Adesso e' uno
                  solo, in Impostazioni → Accesso e sicurezza. */}
              <AccountTendina />
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
          {/* IL MENU DEL TELEFONO E' UN ELENCO (15/10). Le voci dell'account
              stavano su una riga sola in flex-wrap, con due bottoni flex-1
              che prendevano la larghezza avanzata dagli altri: sul telefono
              di André, con il testo di sistema grande, «Parla con Bob» e «La
              tua area» andavano a capo su TRE righe dentro i bottoni. Ogni
              combinazione di nome, contatore e dimensione del testo poteva
              rifarlo. Adesso ogni voce ha la sua riga a tutta larghezza: sulla
              stessa riga stanno solo l'icona, la scritta e il suo contatore, e
              «Parla con Bob» chiude l'elenco, da solo. */}
          <nav className="container-bob flex flex-col gap-1 py-3" aria-label="Menu">
            {NAV.map((item) => (
              <RigaMenu
                key={item.href}
                href={item.href}
                etichetta={item.label}
                attiva={corrente(item.href)}
                onClick={chiudi}
              />
            ))}
            {(role === "admin" || role === "cs") && (
              <RigaMenu
                href="/admin"
                icona={<Settings className="h-5 w-5 shrink-0" aria-hidden="true" />}
                etichetta="Admin"
                attiva={corrente("/admin")}
                onClick={chiudi}
                colore="text-bob-indigo"
                peso="font-semibold"
              />
            )}

            <hr className="my-2 border-black/5" />

            {user ? (
              <>
                {role !== "admin" && role !== "cs" && (
                  <RigaMenu
                    href="/dashboard"
                    icona={<House className="h-5 w-5 shrink-0" aria-hidden="true" />}
                    etichetta="La tua area"
                    attiva={corrente("/dashboard")}
                    onClick={chiudi}
                    testId="link-dashboard-mobile"
                    coda={
                      // Il professionista verificato se lo vede scritto anche
                      // qui, in fondo alla riga e non attaccato al nome.
                      role === "professional" &&
                      verificationLevel &&
                      verificationLevel !== "none" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700">
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          {VERIFICATION_LABEL[verificationLevel]}
                        </span>
                      ) : undefined
                    }
                  />
                )}
                {/* Su mobile l'icona da sola sarebbe un bersaglio ambiguo in
                    mezzo al menu: qui la voce e' scritta. */}
                {role !== "admin" && role !== "cs" && (
                  <RigaMenu
                    href="/notifiche"
                    icona={<Bell className="h-5 w-5 shrink-0" aria-hidden="true" />}
                    etichetta="Notifiche"
                    attiva={corrente("/notifiche")}
                    onClick={chiudi}
                    testId="link-notifiche-mobile"
                    coda={
                      daContare > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-bob-indigo px-1.5 text-2xs font-bold leading-none text-white">
                          {daContare > 9 ? "9+" : daContare}
                          <span className="sr-only"> da leggere</span>
                        </span>
                      ) : undefined
                    }
                  />
                )}
                {/* Su telefono il cerchio dell'account non c'e' (sta nel
                    blocco `hidden md:flex` qui sopra): cambiare account e
                    uscire si fa da Impostazioni → Accesso e sicurezza, ed e'
                    questa la voce che ci porta. */}
                <RigaMenu
                  href="/impostazioni"
                  icona={<UserCog className="h-5 w-5 shrink-0" aria-hidden="true" />}
                  etichetta="Impostazioni"
                  attiva={corrente("/impostazioni")}
                  onClick={chiudi}
                  testId="link-impostazioni-mobile"
                />
              </>
            ) : (
              <RigaMenu
                href="/login"
                icona={<LogIn className="h-5 w-5 shrink-0" aria-hidden="true" />}
                etichetta="Accedi"
                attiva={corrente("/login")}
                onClick={chiudi}
              />
            )}

            {(!user || (role !== "professional" && role !== "admin" && role !== "cs")) && (
              <Link
                href="/#bob"
                onClick={chiudi}
                className="btn-primary mt-3 min-h-[48px] w-full"
                data-testid="link-talk-to-bob-mobile"
              >
                Parla con Bob
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
