import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { HOME_FAQ } from "@/lib/faqData";

export const metadata: Metadata = {
  title: "Domande frequenti",
  description:
    "Risposte alle domande più comuni su BOB: costi, prezzi trasparenti, professionisti verificati e città attive.",
};

const EXTRA_FAQ = [
  {
    q: "Come faccio a contattare un professionista?",
    a: "Apri la scheda del professionista e premi 'Contatta'. Bob prepara un primo messaggio che puoi modificare prima di inviarlo. Per inviarlo basta accedere o registrarsi.",
  },
  {
    q: "Posso contattare più professionisti?",
    a: "Sì. Puoi inviare richieste a più professionisti e confrontare risposte, disponibilità e preventivi dalla tua area personale.",
  },
  {
    q: "I miei dati sono al sicuro?",
    a: "Condividiamo con il professionista solo le informazioni necessarie a rispondere alla tua richiesta. Gestisci tutto dalla tua area personale.",
  },
];

export default function FaqPage() {
  return (
    <div className="container-bob py-12">
      <header className="mx-auto max-w-2xl text-center">
        <span className="section-eyebrow">FAQ</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-bob-ink sm:text-4xl">
          Domande frequenti
        </h1>
        <p className="mt-3 text-base text-bob-ink/65">
          Tutto quello che c&apos;è da sapere su come funziona BOB.
        </p>
      </header>

      <div className="mt-9">
        <Faq items={[...HOME_FAQ, ...EXTRA_FAQ]} />
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm text-bob-ink/60">Non hai trovato la risposta?</p>
        <Link
          href="/"
          className="mt-2 inline-block btn-primary px-6 py-3"
          data-testid="cta-parla-con-bob"
        >
          Chiedi a Bob
        </Link>
      </div>
    </div>
  );
}
