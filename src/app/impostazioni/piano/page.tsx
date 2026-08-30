"use client";

// Sezione "Piano e pagamenti": cosa hai, come l'hai ottenuto, cosa scade.
//
// PERCHE' ESISTE ADESSO, CHE STRIPE NON C'E'
// Il pagamento non e' attivo (M7/12.x): questa pagina sarebbe potuta aspettare
// dicembre. Non aspetta per due ragioni.
// 1. Un professionista oggi non ha NESSUN modo di sapere che piano ha. Il tier
//    lo cambiava lo staff da admin e il pro lo scopriva dalle funzioni che gli
//    comparivano o gli sparivano.
// 2. I fondatori entrano con un codice. Nel database quel codice non ha
//    scadenza (expires_at e' NULL) e non ha tetto di utilizzi (max_uses e'
//    NULL): "Business gratis, revocabile" oggi significa "finche' non lo
//    revoca qualcuno a mano". Va scritto sullo schermo del pro, non lasciato
//    implicito, perche' e' esattamente la cosa che a febbraio diventa una
//    telefonata difficile (P2.16, procedura di decadenza).
//
// DUE COSE CAMBIATE IL 30/08.
// a) I dati del codice arrivano dalla ROUTE, non da una join dal client. La
//    pagina leggeva `promo_redemptions -> promo_codes` dal browser, ma
//    promo_codes non ha nessuna policy per authenticated (solo staff): la
//    join tornava null e la pagina scriveva «Con il codice —». Nessuno se
//    n'era accorto perche' il riquadro appare solo a chi ha un codice, e chi
//    ce l'ha siamo noi due.
// b) SI PUO' CAMBIARE PIANO DA QUI, se con i propri sconti quel piano costa
//    zero. Prima c'era scritto «per cambiare piano scrivici, lo facciamo
//    noi»: vero, ma per i codici al 100% e' una richiesta di permesso senza
//    motivo. Il server accetta solo cio' che non va pagato (migrazione 064).
//
// Il metodo di pagamento e le fatture restano dichiarati "in arrivo" invece di
// essere nascosti: una sezione che non c'e' fa pensare che il prodotto sia
// incompleto per caso; una sezione che dice "arriva con l'abbonamento a
// pagamento" e' un'informazione.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useProfessional } from "@/lib/useProfessional";
import { SectionHeader } from "@/components/ImpostazioniShell";
import {
  SectionSkeleton,
  SectionError,
  NoProProfile,
} from "@/components/SectionStates";
import {
  NESSUNO_SCONTO,
  PIANI,
  costaZero,
  etichettaPrezzo,
  pianoById,
  type ScontiPerPiano,
} from "@/lib/piani";
import type { SubscriptionTier } from "@/lib/supabase/types";

interface Codice {
  code: string;
  description: string | null;
  expiresAt: string | null;
  redeemedAt: string;
}

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function PianoDashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const { pro, loading, failed, reload } = useProfessional();

  const [sconti, setSconti] = useState<ScontiPerPiano>(NESSUNO_SCONTO);
  const [codici, setCodici] = useState<Codice[]>([]);
  const [cambiato, setCambiato] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState<SubscriptionTier | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?returnTo=/impostazioni/piano");
    else if (role && role !== "professional") router.replace("/dashboard");
  }, [authLoading, user, role, router]);

  const leggiCodici = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stato" }),
      });
      const json = (await res.json()) as {
        sconti?: ScontiPerPiano;
        codici?: Codice[];
      };
      if (json.sconti) setSconti(json.sconti);
      if (json.codici) setCodici(json.codici);
    } catch {
      // Senza codici la pagina mostra il listino pieno: nessun blocco.
    }
  }, []);

  useEffect(() => {
    if (!user || !pro) return;
    let active = true;
    (async () => {
      await leggiCodici();
      const { data: ev } = await supabase
        .from("subscription_tier_events")
        .select("changed_at")
        .eq("professional_id", pro.id)
        .order("changed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active && ev) setCambiato((ev as { changed_at: string }).changed_at);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pro?.id]);

  async function passaA(piano: SubscriptionTier) {
    if (inCorso) return;
    setInCorso(piano);
    setErrore(null);
    try {
      const res = await fetch("/api/onboarding/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scegli", piano }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErrore(json.error ?? "Non sono riuscito a cambiare piano.");
        return;
      }
      // Il piano decide cosa vede in mezza applicazione (verifica, portfolio,
      // prenotazione diretta): si rilegge tutto, non solo questa pagina.
      await reload();
      router.refresh();
    } catch {
      setErrore("Errore di rete: riprova.");
    } finally {
      setInCorso(null);
    }
  }

  if (loading) return <SectionSkeleton rows={3} />;
  if (failed) return <SectionError onRetry={reload} />;
  if (!pro) return <NoProProfile />;

  const attuale = pianoById(pro.tier);
  const etichettaAttuale = etichettaPrezzo(attuale, sconti);
  const promo = codici[0] ?? null;

  return (
    <div className="space-y-5">
      <SectionHeader title="Piano e pagamenti">
        Che piano hai, da quando, e cosa succede quando finisce.
      </SectionHeader>

      <div className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-bob-ink/50">
              Il tuo piano
            </p>
            <p className="mt-1 text-xl font-bold text-bob-ink">{attuale.nome}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-bob-ink/70">
              <span className="font-semibold">{etichettaAttuale.attuale}</span>
              {etichettaAttuale.listino && (
                <span className="ml-1.5 text-bob-ink/40 line-through">
                  {etichettaAttuale.listino}
                </span>
              )}
            </p>
            {etichettaAttuale.nota && (
              <p className="text-xs text-bob-ink/45">{etichettaAttuale.nota}</p>
            )}
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 border-t border-black/5 pt-4 text-sm text-bob-ink/70">
          {attuale.punti.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden="true" className="text-bob-indigo">
                ✓
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>

        {cambiato && (
          <p className="mt-4 text-xs text-bob-ink/45">
            Attivo dal {fmtData(cambiato)}.
          </p>
        )}
      </div>

      {/* Come l'ha ottenuto. Se c'e' un codice, la scadenza va detta - anche
          quando la scadenza non c'e', che e' il caso di oggi. */}
      {promo && (
        <div className="card p-5" data-testid="promo-attivo">
          <h3 className="text-sm font-semibold text-bob-ink">
            Il codice che hai
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/70">
            <span className="font-semibold">{promo.code}</span>, riscattato il{" "}
            {fmtData(promo.redeemedAt)}.
            {promo.description ? ` ${promo.description}.` : ""}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-bob-ink/60">
            {promo.expiresAt ? (
              <>
                Scade il <strong>{fmtData(promo.expiresAt)}</strong>: da quel
                giorno serve un abbonamento per tenere le funzioni che stai
                usando. Te lo scriviamo prima, non dopo.
              </>
            ) : (
              <>
                Non ha una data di scadenza: resta attivo finché non lo
                disattiviamo noi. Se lo faremo, te lo scriveremo prima, con il
                motivo e con il tempo per decidere — mai da un giorno
                all&apos;altro e mai senza dirtelo.
              </>
            )}
          </p>
        </div>
      )}

      {/* Metodo di pagamento: dichiarato, non nascosto. */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-bob-ink">
          Metodo di pagamento
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/60">
          Non ce n&apos;è ancora bisogno: in questa fase i piani si attivano con
          un codice e non ti chiediamo una carta. Quando apriremo gli
          abbonamenti a pagamento potrai aggiungerla qui, e vedrai le fatture
          nello stesso posto.
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-bob-ink/55">
          In arrivo
        </p>
      </div>

      {/* Gli altri piani. Il bottone c'e' solo dove porta davvero da qualche
          parte: un "passa a" che apre un modulo di contatto e' peggio della
          sua assenza. */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-bob-ink">Gli altri piani</h3>
        <p className="mt-1 text-sm text-bob-ink/55">
          Quello che il tuo codice copre lo attivi da qui, subito. Per il resto,
          scrivici: finché i pagamenti non sono attivi lo facciamo noi.
        </p>
        {errore && (
          <p className="mt-2 text-sm text-red-600" data-testid="errore-cambio-piano">
            {errore}
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PIANI.filter((p) => p.id !== pro.tier).map((p) => {
            const et = etichettaPrezzo(p, sconti);
            const gratis = costaZero(p, sconti);
            return (
              <div
                key={p.id}
                className="flex flex-col rounded-xl border border-black/[0.07] p-4"
              >
                <p className="font-semibold text-bob-ink">{p.nome}</p>
                <p className="text-sm text-bob-ink/55">
                  {et.attuale}
                  {et.listino && (
                    <span className="ml-1.5 line-through opacity-60">
                      {et.listino}
                    </span>
                  )}
                  {et.nota ? ` · ${et.nota}` : ""}
                </p>
                <ul className="mt-2.5 flex-1 space-y-1 text-sm text-bob-ink/65">
                  {p.punti.map((x) => (
                    <li key={x}>· {x}</li>
                  ))}
                </ul>
                {gratis && (
                  <button
                    type="button"
                    onClick={() => passaA(p.id)}
                    disabled={inCorso !== null}
                    className="btn-secondary mt-3 py-2 text-sm disabled:opacity-50"
                    data-testid={`passa-a-${p.id}`}
                  >
                    {inCorso === p.id ? "Cambio…" : `Passa a ${p.nome}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-bob-ink/45">
          Il listino completo, con le funzioni in arrivo, è su{" "}
          <Link
            href="/per-i-professionisti"
            className="font-medium text-bob-indigo hover:underline"
          >
            per i professionisti
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
