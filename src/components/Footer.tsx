import Link from "next/link";
import { Logo } from "./Logo";
import { COMPANY } from "@/lib/company";

/**
 * Il piede del sito.
 *
 * QUATTRO COLONNE, deciso con André il 12 settembre: Esplora, Supporto,
 * Professionisti, Bob Italia. Prima erano tre e mescolate — "Per chi lavora"
 * conteneva anche un paragrafo sulla trasparenza, "Legale" conteneva anche
 * "Chi siamo", che legale non e'.
 *
 * SOLO ROTTE CHE ESISTONO. Ogni voce qui sotto punta a una pagina vera. Le
 * colonne che sembrerebbero piu' ricche con "Blog", "Lavora con noi" o
 * "Requisiti minimi" restano magre finche' quelle pagine non ci sono: un piede
 * che porta a un 404 costa piu' fiducia di quanta ne dia un elenco lungo.
 *
 * FONDO SCURO: chiude la pagina. La home e' costruita su fasce che si
 * alternano, e senza un fondo che la chiuda l'ultima sezione sembra tagliata.
 */
export function Footer() {
  // Niente margine sopra il piede: la home finisce con una fascia colorata a
  // tutta larghezza, e uno spazio qui mostrerebbe il fondo della pagina come
  // una striscia chiara fra le due. Le fasce si toccano.
  return (
    <footer className="bg-bob-ink text-white">
      <div className="container-bob grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] lg:gap-12">
        <div>
          <Logo tinta="chiara" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
            Ciao, sono Bob. Ti aiuto a capire il tuo problema e a trovare il
            professionista giusto, con prezzi chiari e zero attrito.
          </p>
          <p className="mt-4 text-sm text-white/65">
            Scrivici:{" "}
            <a
              href={`mailto:${COMPANY.contactEmail}`}
              className="text-bob-yellow hover:underline"
              data-testid="link-contact-email"
            >
              {COMPANY.contactEmail}
            </a>
          </p>
        </div>

        <Colonna titolo="Esplora">
          <Voce href="/servizi">Servizi</Voce>
          <Voce href="/citta">Città</Voce>
          <Voce href="/professionisti">Professionisti</Voce>
          <Voce href="/come-funziona">Come funziona</Voce>
        </Colonna>

        <Colonna titolo="Supporto">
          <Voce href="/supporto">Assistenza</Voce>
          <Voce href="/faq">Domande frequenti</Voce>
          <Voce href="/privacy">Privacy</Voce>
          <Voce href="/cookie-policy">Cookie policy</Voce>
          <Voce href="/termini">Termini del servizio</Voce>
        </Colonna>

        <Colonna titolo="Professionisti">
          <Voce href="/per-i-professionisti">Come funziona per chi lavora</Voce>
          <Voce href="/login">Iscriviti come professionista</Voce>
          <Voce href="/termini/professionisti">Termini per i professionisti</Voce>
        </Colonna>

        <Colonna titolo="Bob Italia">
          <Voce href="/chi-siamo">Chi siamo</Voce>
        </Colonna>
      </div>

      <div className="border-t border-white/10">
        <div className="container-bob flex flex-col items-center justify-between gap-2 py-6 text-xs text-white/50 sm:flex-row">
          <span>
            © {new Date().getFullYear()} BOB — {COMPANY.legalName} · P.IVA{" "}
            {COMPANY.vat}
          </span>
          <span>Nessuna posizione in elenco è a pagamento</span>
        </div>
      </div>
    </footer>
  );
}

function Colonna({
  titolo,
  children,
}: {
  titolo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-bold text-white">{titolo}</h4>
      <ul className="flex flex-col gap-3 text-sm">{children}</ul>
    </div>
  );
}

function Voce({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-white/65 transition hover:text-bob-yellow">
        {children}
      </Link>
    </li>
  );
}
