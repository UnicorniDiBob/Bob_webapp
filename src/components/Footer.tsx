import Link from "next/link";
import { Logo } from "./Logo";
import { COMPANY } from "@/lib/company";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-black/5 bg-white">
      <div className="container-bob grid grid-cols-1 gap-8 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-bob-ink/60">
            Ciao, sono Bob. Ti aiuto a capire il tuo problema e a trovare il
            professionista giusto, con prezzi chiari e zero attrito.
          </p>
          <p className="mt-3 text-sm text-bob-ink/60">
            Scrivici:{" "}
            <a
              href={`mailto:${COMPANY.contactEmail}`}
              className="text-bob-indigo hover:underline"
              data-testid="link-contact-email"
            >
              {COMPANY.contactEmail}
            </a>
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-bob-ink">Esplora</h4>
          <ul className="space-y-2 text-sm text-bob-ink/60">
            <li><Link href="/servizi" className="hover:text-bob-indigo">Servizi</Link></li>
            <li><Link href="/citta" className="hover:text-bob-indigo">Città</Link></li>
            <li><Link href="/professionisti" className="hover:text-bob-indigo">Professionisti</Link></li>
            <li><Link href="/come-funziona" className="hover:text-bob-indigo">Come funziona</Link></li>
            <li><Link href="/faq" className="hover:text-bob-indigo">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-bob-ink">Per chi lavora</h4>
          <ul className="space-y-2 text-sm text-bob-ink/60">
            <li><Link href="/per-i-professionisti" className="hover:text-bob-indigo">Diventa professionista</Link></li>
            <li><Link href="/login" className="hover:text-bob-indigo">Accedi</Link></li>
          </ul>
          <h4 className="mb-3 mt-6 text-sm font-semibold text-bob-ink">Trasparenza</h4>
          <p className="text-sm text-bob-ink/60">
            Nessun lead a pagamento. La fee si applica solo quando un lavoro si
            chiude davvero.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-bob-ink">Legale</h4>
          <ul className="space-y-2 text-sm text-bob-ink/60">
            <li><Link href="/chi-siamo" className="hover:text-bob-indigo">Chi siamo</Link></li>
            <li><Link href="/privacy" className="hover:text-bob-indigo">Privacy</Link></li>
            <li><Link href="/cookie-policy" className="hover:text-bob-indigo">Cookie policy</Link></li>
            <li><Link href="/termini" className="hover:text-bob-indigo">Termini del servizio</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-black/5">
        <div className="container-bob flex flex-col items-center justify-between gap-2 py-5 text-xs text-bob-ink/50 sm:flex-row">
          <span>
            © {new Date().getFullYear()} BOB — {COMPANY.legalName} · P.IVA{" "}
            {COMPANY.vat}
          </span>
          <span>Pilota a Milano · Roma e Torino in arrivo</span>
        </div>
      </div>
    </footer>
  );
}
