"use client";

// Guscio delle IMPOSTAZIONI: intestazione unica + navigazione per sezioni.
//
// PERCHE' E' SEPARATO DALL'AREA DI LAVORO (deciso il 19/08)
// Nella prima versione tutto stava sotto /dashboard, e la barra laterale
// metteva sulla stessa fila "Oggi" e "Accesso e sicurezza": il lavoro di ogni
// giorno accanto a cose che si aprono due volte l'anno. Sono due bisogni
// diversi. Un professionista che apre Bob vuole le richieste e il calendario a
// portata di mano; un cliente vuole cercare un professionista o guardare i suoi
// appuntamenti. La configurazione del proprio account non c'entra con nessuno
// dei due, e mescolarla costringeva entrambi a passarci davanti ogni volta.
//
// Da qui: /dashboard e' il lavoro, /impostazioni e' la configurazione. La
// separazione sta anche negli indirizzi, non solo nel disegno — perche' un
// indirizzo dice a cosa serve una pagina, e /dashboard/accesso non lo diceva.
//
// La navigazione e' un solo elenco per ruolo (NAV_PRO / NAV_CLIENTE /
// NAV_STAFF): per aggiungere una sezione si aggiunge una riga qui e una pagina
// sotto src/app/impostazioni/. Lo stesso elenco disegna la colonna, le pillole
// a 390px e la griglia di /impostazioni (30/09, modello Amazon).
//
// LO STAFF HA LE SUE IMPOSTAZIONI (30/09). Fino a qui il guscio si faceva da
// parte per admin e cs, e le pagine si vedevano senza navigazione: niente
// strada per la password, e dal 30/09 niente strada per uscire, che sta nella
// tendina degli account. Due voci sole: i dati personali e l'accesso. Un
// accesso dedicato allo staff e' un'altra decisione, non presa.

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  CreditCard,
  Images,
  KeyRound,
  LifeBuoy,
  Mail,
  MapPin,
  Store,
  User,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { GuidaBarra } from "@/components/GuidaBarra";
import type { UserRole } from "@/lib/supabase/types";

export interface VoceNav {
  href: string;
  label: string;
  /** Riga di aiuto sotto la voce, solo su desktop: dice cosa ci si trova. */
  hint: string;
  /** Icona del riquadro nella griglia di /impostazioni. */
  icona: LucideIcon;
}

// L'ordine non e' alfabetico: parte da chi sei, poi cosa offri, poi il resto.
const NAV_PRO: VoceNav[] = [
  { href: "/impostazioni/dati", label: "I tuoi dati", hint: "Nome e telefono", icona: User },
  { href: "/impostazioni/azienda", label: "La tua azienda", hint: "Profilo pubblico, servizi, tariffe", icona: Store },
  { href: "/impostazioni/zone", label: "Dove lavori", hint: "Zone, raggio, quanto ti allontani", icona: MapPin },
  { href: "/impostazioni/verifica", label: "Verifica", hint: "Partita IVA, documenti, badge", icona: BadgeCheck },
  { href: "/impostazioni/orari", label: "Orari", hint: "Disponibilità e prenotazione diretta", icona: Clock },
  { href: "/impostazioni/lavori", label: "Lavori", hint: "Le foto dei tuoi interventi", icona: Images },
  { href: "/impostazioni/piano", label: "Piano e pagamenti", hint: "Abbonamento e fatture", icona: CreditCard },
  { href: "/impostazioni/comunicazioni", label: "Comunicazioni", hint: "Cosa ti scriviamo e quando", icona: Mail },
  { href: "/impostazioni/accesso", label: "Accesso e sicurezza", hint: "Email, password, account", icona: KeyRound },
  { href: "/impostazioni/assistenza", label: "Assistenza", hint: "Le tue richieste e le risposte", icona: LifeBuoy },
];

const NAV_CLIENTE: VoceNav[] = [
  { href: "/impostazioni/dati", label: "I tuoi dati", hint: "Nome e informazioni personali", icona: User },
  { href: "/impostazioni/indirizzi", label: "Indirizzi", hint: "Dove ti raggiungono i professionisti", icona: MapPin },
  { href: "/impostazioni/comunicazioni", label: "Comunicazioni", hint: "Cosa ti scriviamo e quando", icona: Mail },
  { href: "/impostazioni/accesso", label: "Accesso e sicurezza", hint: "Email, password, account", icona: KeyRound },
  { href: "/impostazioni/assistenza", label: "Assistenza", hint: "Le tue richieste e le risposte", icona: LifeBuoy },
];

const NAV_STAFF: VoceNav[] = [
  { href: "/impostazioni/dati", label: "I tuoi dati", hint: "Nome e informazioni personali", icona: User },
  { href: "/impostazioni/accesso", label: "Accesso e sicurezza", hint: "Email e password", icona: KeyRound },
];

export function isStaff(role: UserRole | null): boolean {
  return role === "admin" || role === "cs";
}

/** Le sezioni che vede chi ha questo ruolo: colonna, pillole e griglia. */
export function vociImpostazioni(role: UserRole | null): VoceNav[] {
  if (isStaff(role)) return NAV_STAFF;
  return role === "professional" ? NAV_PRO : NAV_CLIENTE;
}

/**
 * IL RITORNO, IN FONDO (01/10, Lucio). Qui c'era il cerchio dell'account, che
 * apriva una tendina verso l'alto: l'unica cosa che si muoveva in una pagina
 * fatta di righe ferme, e un secondo posto da cui fare quello che si fa gia'
 * dal cerchio nell'intestazione. Adesso gli account sono una sezione dentro
 * «Accesso e sicurezza» e qui resta solo la cosa che serviva davvero in fondo
 * a una pagina lunga: tornare da dove si veniva.
 *
 * SI VEDE DA md IN SU, non prima, perche' sotto md c'e' gia' lo stesso link in
 * cima alla pagina (quello dentro `md:hidden`): su un telefono due «indietro»
 * identici, uno sopra e uno sotto, sono un doppione — che e' esattamente il
 * difetto che stiamo togliendo.
 *
 * TRANNE PER LO STAFF, che in cima non ce l'ha: quel link e' dentro un
 * `!staff` perche' un admin non ha un'area di lavoro, ha /admin. Per lui
 * questo e' l'unico ritorno, quindi si vede a ogni larghezza — se no un
 * account staff su telefono resta chiuso nelle impostazioni.
 */
function RitornoIndietro({
  staff,
  isPro,
  loading,
}: {
  staff: boolean;
  isPro: boolean;
  loading: boolean;
}) {
  const href = staff ? "/admin" : "/dashboard";
  const label = loading
    ? "Indietro"
    : staff
      ? "Pannello staff"
      : isPro
        ? "Il mio lavoro"
        : "I miei lavori";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-bob-ink/70 transition hover:text-bob-indigo"
      data-testid="link-ritorno-impostazioni"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

export function ImpostazioniShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, loading } = useAuth();

  const isPro = role === "professional";
  const staff = isStaff(role);
  // Finche' il ruolo non e' arrivato nessun elenco: disegnare quello del
  // cliente per un istante addosso a un professionista o a un admin e' peggio
  // di una colonna vuota.
  const nav = loading ? [] : vociImpostazioni(role);
  const attivo = (href: string) => pathname === href;
  // /impostazioni nuda e' la griglia: li' la colonna ripeterebbe i riquadri.
  const radice = pathname === "/impostazioni";
  // Il ritorno in fondo si vede da md in su, dove quello in cima non c'e'
  // (`md:hidden`). Per lo staff si vede sempre: in cima non ne ha mai uno.
  // Sta sul CONTENITORE e non sul link, se no sotto md resterebbe in pagina il
  // filetto grigio sopra il vuoto.
  const mostraRitorno = staff ? "" : "hidden md:block";

  return (
    <div className="container-bob py-8 sm:py-10">
      {/* Se il professionista e' arrivato qui dalla guida, la pagina lo dice e
          gli tiene aperta la strada del ritorno. Sta sopra tutto: e' il motivo
          per cui e' su questa pagina. */}
      <GuidaBarra />

      <header className="mb-6">
        {/* Il ritorno al lavoro sta in cima e per primo: da qui si esce piu'
            spesso di quanto si entri, e l'etichetta dice dove si torna.
            SOLO SOTTO md (05/09), esattamente come il link «Impostazioni»
            della dashboard il 29/08. Da md in su l'header mostra gia' un
            bottone con la STESSA etichetta e la STESSA destinazione — «Il mio
            lavoro» / «I miei lavori» verso /dashboard — e su ogni pagina
            /impostazioni/* i due si vedevano insieme. Sotto md quel bottone
            vive dentro un blocco `hidden md:flex` e sparisce nel menu ☰:
            li' questo link e' l'unica strada di ritorno visibile, quindi
            resta. Terzo doppione nato da 58f4ca5, dopo Impostazioni (29/08) e
            «Cerca un professionista» (05/09). */}
        {/* Lo staff non ha un'area di lavoro qui: /dashboard lo rimanda in
            /admin, che ha la sua voce nel menu. */}
        {!staff && (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-bob-ink/70 transition hover:text-bob-indigo md:hidden"
            data-testid="link-torna-al-lavoro"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {loading ? "Indietro" : isPro ? "Il mio lavoro" : "I miei lavori"}
          </Link>
        )}
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          Impostazioni
        </h1>
        <p className="mt-1.5 text-sm text-bob-ink/70">
          {isPro
            ? "Il tuo account, il tuo profilo pubblico e come lavori."
            : staff
              ? "Il tuo account."
              : "Il tuo account e le tue preferenze."}
        </p>
      </header>

      {radice ? (
        <>
          {children}
          <div className={`mt-8 ${mostraRitorno}`}>
            <RitornoIndietro staff={staff} isPro={isPro} loading={loading} />
          </div>
        </>
      ) : (
        <>
          {/* Mobile (fino a lg): fila di sezioni scorrevole. Sborda oltre il
              padding del contenitore di proposito, cosi' a 390px si capisce che
              si scorre invece di sembrare tagliata. */}
          <nav
            aria-label="Sezioni delle impostazioni"
            className="-mx-5 mb-6 overflow-x-auto px-5 lg:hidden"
          >
            <ul className="flex w-max gap-2 pb-1">
              {nav.map((v) => (
                <li key={v.href}>
                  <Link
                    href={v.href}
                    aria-current={attivo(v.href) ? "page" : undefined}
                    className={`inline-flex whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition ${
                      attivo(v.href)
                        ? "bg-bob-indigo text-white shadow-sm"
                        : "border border-black/10 bg-white text-bob-ink/70 hover:border-bob-indigo/30 hover:text-bob-indigo"
                    }`}
                    data-testid={`nav-${v.href.split("/").pop()}`}
                  >
                    {v.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:grid lg:grid-cols-[228px_1fr] lg:gap-8">
            {/* Desktop: colonna laterale che resta ferma mentre il contenuto
                scorre, e in fondo il blocco dell'account (modello ProntoPro):
                sempre li', da qualunque sezione. */}
            <div className="hidden lg:block">
              <div className="sticky top-24 space-y-4">
                <nav aria-label="Sezioni delle impostazioni">
                  <ul className="space-y-1">
                    {nav.map((v) => (
                      <li key={v.href}>
                        <Link
                          href={v.href}
                          aria-current={attivo(v.href) ? "page" : undefined}
                          className={`block rounded-xl px-3.5 py-2.5 transition ${
                            attivo(v.href)
                              ? "bg-bob-indigo-50 text-bob-indigo"
                              : "text-bob-ink/70 hover:bg-black/[0.03] hover:text-bob-ink"
                          }`}
                          data-testid={`nav-desktop-${v.href.split("/").pop()}`}
                        >
                          <span className="block text-sm font-semibold">{v.label}</span>
                          <span className="mt-0.5 block text-xs leading-snug text-bob-ink/65">
                            {v.hint}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
                <div className="border-t border-black/5 pt-3">
                  <RitornoIndietro staff={staff} isPro={isPro} loading={loading} />
                </div>
              </div>
            </div>

            <div className="min-w-0">{children}</div>
          </div>

          {/* Sotto lg la colonna non c'e': il ritorno sta in fondo alla pagina. */}
          <div className={`mt-8 border-t border-black/5 pt-4 lg:hidden ${mostraRitorno}`}>
            <RitornoIndietro staff={staff} isPro={isPro} loading={loading} />
          </div>
        </>
      )}
    </div>
  );
}

// Intestazione di sezione: la usano tutte le pagine, cosi' il titolo e la
// riga di spiegazione hanno la stessa forma da una sezione all'altra.
export function SectionHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold tracking-tight text-bob-ink sm:text-xl">
        {title}
      </h2>
      {children && (
        <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/70">
          {children}
        </p>
      )}
    </div>
  );
}
