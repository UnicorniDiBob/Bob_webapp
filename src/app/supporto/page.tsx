import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupportoForm } from "@/components/SupportoForm";

export const metadata: Metadata = {
  title: "Assistenza",
  description:
    "Scrivi a BOB: rispondiamo entro un giorno lavorativo. La richiesta e la risposta restano dentro il tuo account.",
  alternates: { canonical: "/supporto" },
};

// Pagina pubblica: si puo' scrivere anche senza account, perche' chi ha un
// problema di accesso e' esattamente chi non riesce a entrare.
export default async function SupportoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="container-bob max-w-2xl py-10 sm:py-14">
      <header className="mb-7">
        <span className="section-eyebrow">Assistenza</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          Come possiamo aiutarti?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-bob-ink/65">
          Scrivici qui: la richiesta arriva a noi con un codice, e la risposta
          la trovi dentro Bob — non serve controllare la posta. Rispondiamo
          entro un giorno lavorativo.
        </p>
        <p className="mt-2 text-sm text-bob-ink/55">
          Se cerchi come funziona qualcosa, molte risposte sono già nelle{" "}
          <Link href="/faq" className="font-medium text-bob-indigo hover:underline">
            domande frequenti
          </Link>
          .
        </p>
      </header>

      <SupportoForm emailUtente={user?.email ?? null} />

      {/* Una cosa che va detta qui e non altrove: se il problema e' urgente e
          riguarda una persona in casa, l'assistenza di un marketplace non e' il
          posto giusto. */}
      <p className="mt-6 rounded-2xl border border-black/[0.07] bg-white p-4 text-sm leading-relaxed text-bob-ink/60">
        Se c&apos;è un&apos;emergenza in corso — una perdita d&apos;acqua che
        sta allagando, una fuga di gas, un rischio per qualcuno — non aspettare
        noi: chiama i numeri di emergenza o il pronto intervento del tuo
        fornitore. Noi ti aiutiamo con Bob, non possiamo intervenire a casa tua.
      </p>
    </div>
  );
}
