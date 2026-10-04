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
// sotto src/app/impostazioni/. Lo stesso elenco disegna le pillole in cima a
// ogni sezione e la griglia di /impostazioni (30/09, modello Amazon; la
// colonna laterale da desktop e' stata tolta il 04/10).
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

/** Le sezioni che vede chi ha questo ruolo: pillole e griglia. */
export function vociImpostazioni(role: UserRole | null): VoceNav[] {
  if (isStaff(role)) return NAV_STAFF;
  return role === "professional" ? NAV_PRO : NAV_CLIENTE;
}

/**
 * IL RITORNO, IN CIMA E UNO SOLO (04/10, Lucio). Il 01/10 stava in fondo alla
 * colonna, sotto un filetto, e per non sdoppiarsi con quello in cima alla
 * pagina cambiava a seconda della larghezza: in fondo da md in su, in cima
 * sotto md, in fondo sempre per lo staff. Tre posti e una regola per fascia di
 * schermo per una cosa sola. Adesso e' in cima, per tutti e a ogni larghezza:
 * e' la prima cosa della pagina, prima del titolo, e da qui si esce piu'
 * spesso di quanto si entri.
 *
 * Lo staff torna in /admin e non in /dashboard: non ha un'area di lavoro qui,
 * e /dashboard lo rimanderebbe comunque li'.
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
  // di una fila vuota.
  const nav = loading ? [] : vociImpostazioni(role);
  const attivo = (href: string) => pathname === href;
  // /impostazioni nuda e' la griglia: li' le pillole ripeterebbero i riquadri.
  const radice = pathname === "/impostazioni";

  return (
    <div className="container-bob py-8 sm:py-10">
      {/* Se il professionista e' arrivato qui dalla guida, la pagina lo dice e
          gli tiene aperta la strada del ritorno. Sta sopra tutto: e' il motivo
          per cui e' su questa pagina. */}
      <GuidaBarra />

      <header className="mb-6">
        <RitornoIndietro staff={staff} isPro={isPro} loading={loading} />
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
        children
      ) : (
        <>
          {/* UNA SOLA NAVIGAZIONE, IN ALTO, A OGNI LARGHEZZA (04/10, Lucio).
              Da lg in su c'era anche una colonna laterale con le sezioni, e
              due navigazioni per la stessa cosa erano una di troppo: la
              colonna si mangiava 228px accanto al contenuto e si leggeva come
              una barra in piu'. Adesso c'e' solo la fila di pillole: sotto lg
              scorre e sborda oltre il padding di proposito, cosi' a 390px si
              capisce che si scorre invece di sembrare tagliata; da lg in su
              va a capo e sta tutta nella pagina. */}
          <nav
            aria-label="Sezioni delle impostazioni"
            className="-mx-5 mb-6 overflow-x-auto px-5 lg:mx-0 lg:overflow-visible lg:px-0"
          >
            <ul className="flex w-max gap-2 pb-1 lg:w-auto lg:flex-wrap">
              {nav.map((v) => (
                <li key={v.href}>
                  <Link
                    href={v.href}
                    aria-current={attivo(v.href) ? "page" : undefined}
                    title={v.hint}
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

          <div className="min-w-0">{children}</div>
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
