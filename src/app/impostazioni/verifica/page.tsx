"use client";

// Sezione "Verifica": partita IVA, documenti, e cosa cambia una volta ottenuta.
//
// PERCHE' E' UNA PAGINA SUA
// Prima era il penultimo blocco di /dashboard/profilo, sotto la tariffa e i
// sottoservizi: la cosa che decide se un estraneo ti sceglie stava dopo dieci
// campi di testo. Adesso ha un posto, e sopra c'e' scritto a cosa serve —
// perche' "verificati" senza dire cosa si ottiene non convince nessuno.
//
// La verifica e' esclusiva dei piani a pagamento (decisione 14/08): al piano
// Free si dice cosa si sbloccherebbe, senza aprire un percorso che finirebbe
// contro un muro.
//
// L'EMAIL CONFERMATA E' UN REQUISITO, IL CONSENSO NO.
// Una verifica produce comunicazioni dovute (esito, richiesta di documenti,
// decadenza): se l'indirizzo non e' raggiungibile, la pratica si blocca e non
// lo sa nessuno. Quindi chiediamo un'email confermata, che e' raggiungibilita'
// ed e' legittimo pretenderla. Non chiediamo il consenso a ricevere
// comunicazioni: condizionare un servizio a un consenso che quel servizio non
// richiede lo rende nullo (art. 7(4) GDPR), e le comunicazioni di servizio non
// hanno bisogno di consenso perche' la base giuridica e' il contratto.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useProfessional } from "@/lib/useProfessional";
import { SectionHeader } from "@/components/ImpostazioniShell";
import {
  SectionSkeleton,
  SectionError,
  NoProProfile,
  UpgradeNeeded,
} from "@/components/SectionStates";
import { VerificationLevelBadge } from "@/components/ui";
import VatVerification from "@/components/VatVerification";
import VerificationDocuments from "@/components/VerificationDocuments";

type Livello = "none" | "vat_verified" | "documents_verified";

export default function VerificaPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const { pro, loading, failed, reload } = useProfessional();

  const [livello, setLivello] = useState<Livello>("none");
  const [verificatoIl, setVerificatoIl] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?returnTo=/impostazioni/verifica");
    else if (role && role !== "professional") router.replace("/dashboard");
  }, [authLoading, user, role, router]);

  useEffect(() => {
    if (!pro) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("professional_verification")
        .select("level, vat_checked_at")
        .eq("professional_id", pro.id)
        .maybeSingle();
      if (!active) return;
      const v = (data ?? {}) as Record<string, unknown>;
      setLivello((v.level as Livello) ?? "none");
      setVerificatoIl((v.vat_checked_at as string) ?? null);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pro?.id]);

  if (loading) return <SectionSkeleton rows={3} />;
  if (failed) return <SectionError onRetry={reload} />;
  if (!pro) return <NoProProfile />;

  const emailConfermata = Boolean(user?.email_confirmed_at);

  return (
    <div className="space-y-5">
      <SectionHeader title="Verifica">
        È la sola cosa che permette a un cliente di scegliere fra cinque nomi
        che non conosce. La partita IVA la controlliamo sul VIES: se risponde,
        il badge arriva senza che nessuno di noi tocchi niente.
      </SectionHeader>

      {/* Stato attuale, in cima e in chiaro: prima bisognava dedurlo. */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-bob-ink/50">
            Il tuo livello adesso
          </p>
          <div className="mt-1.5">
            <VerificationLevelBadge level={livello} verifiedAt={verificatoIl} />
          </div>
        </div>
        <Link
          href={`/professionisti/${pro.id}`}
          className="btn-ghost text-sm"
        >
          Come lo vede un cliente →
        </Link>
      </div>

      {/* Cosa cambia: tre righe, nessuna promessa che il prodotto non mantenga. */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-bob-ink">
          Cosa cambia quando sei verificato
        </h3>
        <ul className="mt-2.5 space-y-2 text-sm leading-relaxed text-bob-ink/70">
          <li>
            Il badge compare sul tuo profilo e nei risultati di ricerca, accanto
            al tuo nome.
          </li>
          <li>
            Il livello di verifica è la prima cosa che ordina i risultati: a
            parità di tutto il resto, un profilo verificato viene prima.
          </li>
          <li>
            Puoi caricare i documenti per il livello superiore, quando lo
            attiveremo.
          </li>
        </ul>
      </div>

      {pro.tier === "free" ? (
        <UpgradeNeeded what="La verifica della partita IVA">
          Il piano Free ti fa ricevere richieste e messaggi, ma non include la
          verifica né il badge. Non è un limite tecnico: è quello che distingue
          i piani.
        </UpgradeNeeded>
      ) : (
        <>
          {/* Requisito di raggiungibilita': se l'email non e' confermata, gli
              esiti della pratica non arrivano da nessuna parte. */}
          {!emailConfermata && (
            <div
              className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5"
              data-testid="email-non-confermata"
            >
              <p className="text-sm font-semibold text-amber-900">
                Prima conferma il tuo indirizzo email
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-900/80">
                La verifica produce comunicazioni che devi ricevere: l&apos;esito,
                un&apos;eventuale richiesta di documenti, il rinnovo. Se
                l&apos;indirizzo non è confermato non abbiamo dove scriverti.
                Non è un consenso a ricevere comunicazioni commerciali: quello è
                separato, facoltativo, e lo gestisci in{" "}
                <Link
                  href="/impostazioni/comunicazioni"
                  className="font-medium underline"
                >
                  Comunicazioni
                </Link>
                .
              </p>
              <Link
                href="/impostazioni/accesso"
                className="btn-secondary mt-3.5 py-2.5"
              >
                Vai a Accesso e sicurezza
              </Link>
            </div>
          )}

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-bob-ink">
              Partita IVA
            </h3>
            <div className="mt-2">
              <VatVerification professionalId={pro.id} />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-bob-ink">
              Documenti
            </h3>
            <p className="mt-1 text-sm text-bob-ink/55">
              Servono solo se ti chiediamo un controllo in più: in quel caso te
              lo scriviamo e ti diciamo cosa caricare.
            </p>
            <div className="mt-3">
              <VerificationDocuments professionalId={pro.id} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
