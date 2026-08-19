"use client";

// Guscio dell'area personale: intestazione unica + navigazione per sezioni.
//
// PERCHE' ESISTE
// Prima di questo guscio l'area personale era due pagine lunghissime:
// /dashboard/profilo impilava citta', servizio, titolo, bio, esperienza,
// tempo di risposta, tariffa, sottoservizi, verifica P.IVA, upload documenti,
// prenotazione diretta e orari in 514 righe; /dashboard/account impilava dati
// personali, email, indirizzi e password in 562. Si scorreva per trovare le
// cose, e un professionista non aveva NESSUNA pagina account (il link
// "Gestisci il tuo account" era condizionato al ruolo non professionista:
// non poteva nemmeno cambiare la password).
//
// Ogni voce qui sotto e' una pagina che carica solo i propri dati. Costa una
// navigazione in piu' e restituisce tre cose: si trova quello che si cerca,
// ogni sezione ha il suo stato di caricamento e di errore invece di uno
// condiviso, e una modifica a una sezione non puo' rompere le altre.
//
// La navigazione e' un solo elenco (NAV_PRO / NAV_CLIENTE): per aggiungere una
// sezione si aggiunge una riga qui e una pagina sotto src/app/dashboard/.

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

interface VoceNav {
  href: string;
  label: string;
  /** Riga di aiuto sotto la voce, solo su desktop: dice cosa ci si trova. */
  hint: string;
}

// L'ordine non e' alfabetico: e' la frequenza d'uso. "Oggi" e' quello che
// serve ogni giorno, "Accesso e sicurezza" quello che si apre due volte l'anno.
const NAV_PRO: VoceNav[] = [
  { href: "/dashboard", label: "Oggi", hint: "Richieste, calendario, giornata" },
  { href: "/dashboard/dati", label: "I tuoi dati", hint: "Nome e telefono" },
  { href: "/dashboard/azienda", label: "La tua azienda", hint: "Profilo pubblico, servizi, tariffe" },
  { href: "/dashboard/verifica", label: "Verifica", hint: "Partita IVA, documenti, badge" },
  { href: "/dashboard/orari", label: "Orari", hint: "Disponibilità e prenotazione diretta" },
  { href: "/dashboard/lavori", label: "Lavori", hint: "Le foto dei tuoi interventi" },
  { href: "/dashboard/piano", label: "Piano e pagamenti", hint: "Abbonamento e fatture" },
  { href: "/dashboard/comunicazioni", label: "Comunicazioni", hint: "Cosa ti scriviamo e quando" },
  { href: "/dashboard/accesso", label: "Accesso e sicurezza", hint: "Email, password, account" },
];

const NAV_CLIENTE: VoceNav[] = [
  { href: "/dashboard", label: "Oggi", hint: "I tuoi lavori e appuntamenti" },
  { href: "/dashboard/dati", label: "I tuoi dati", hint: "Nome e informazioni personali" },
  { href: "/dashboard/indirizzi", label: "Indirizzi", hint: "Dove ti raggiungono i professionisti" },
  { href: "/dashboard/comunicazioni", label: "Comunicazioni", hint: "Cosa ti scriviamo e quando" },
  { href: "/dashboard/accesso", label: "Accesso e sicurezza", hint: "Email, password, account" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, fullName, loading } = useAuth();

  // Lo staff non ha area personale (la pagina lo rimanda su /admin): senza
  // questa uscita il guscio disegnerebbe per un istante una navigazione da
  // cliente addosso a un amministratore.
  if (role === "admin" || role === "cs") {
    return <>{children}</>;
  }

  const nav = role === "professional" ? NAV_PRO : NAV_CLIENTE;
  const nome = fullName?.trim().split(" ")[0];

  // Match esatto: /dashboard non deve risultare attivo mentre si sta su
  // /dashboard/azienda, e nessuna sezione e' annidata piu' in profondita'.
  const attivo = (href: string) => pathname === href;

  return (
    <div className="container-bob py-8 sm:py-10">
      <header className="mb-6">
        <span className="section-eyebrow">Area personale</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          {loading ? "…" : nome ? `Ciao ${nome}` : "Ciao"}
        </h1>
      </header>

      {/* Mobile (fino a lg): fila di sezioni scorrevole. Sborda oltre il
          padding del contenitore di proposito, cosi' a 390px si capisce che
          si scorre invece di sembrare tagliata. */}
      <nav
        aria-label="Sezioni dell'area personale"
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
        {/* Desktop: colonna laterale che resta ferma mentre il contenuto scorre. */}
        <nav
          aria-label="Sezioni dell'area personale"
          className="hidden lg:block"
        >
          <ul className="sticky top-24 space-y-1">
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
                  <span className="mt-0.5 block text-xs leading-snug text-bob-ink/45">
                    {v.hint}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
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
        <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/60">
          {children}
        </p>
      )}
    </div>
  );
}
