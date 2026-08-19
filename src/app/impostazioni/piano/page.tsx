"use client";

// Sezione "Piano e pagamenti": cosa hai, come l'hai ottenuto, cosa scade.
//
// PERCHE' ESISTE ADESSO, CHE STRIPE NON C'E'
// Il pagamento non e' attivo (M7/12.x): questa pagina sarebbe potuta aspettare
// dicembre. Non aspetta per due ragioni.
// 1. Un professionista oggi non ha NESSUN modo di sapere che piano ha. Il tier
//    lo cambiava lo staff da admin e il pro lo scopriva dalle funzioni che gli
//    comparivano o gli sparivano.
// 2. I fondatori entrano con un codice promo. Nel database quel codice non ha
//    scadenza (expires_at e' NULL) e non ha tetto di utilizzi (max_uses e'
//    NULL): "Business gratis, revocabile" oggi significa "finche' non lo
//    revoca qualcuno a mano". Va scritto sullo schermo del pro, non lasciato
//    implicito, perche' e' esattamente la cosa che a febbraio diventa una
//    telefonata difficile (P2.16, procedura di decadenza).
//
// Il metodo di pagamento e le fatture sono dichiarati "in arrivo" invece di
// essere nascosti: una sezione che non c'e' fa pensare che il prodotto sia
// incompleto per caso; una sezione che dice "arriva con l'abbonamento a
// pagamento" e' un'informazione.

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
} from "@/components/SectionStates";
import { PIANI, pianoById } from "@/lib/piani";

interface Promo {
  redeemedAt: string;
  code: string;
  description: string | null;
  expiresAt: string | null;
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

  const [promo, setPromo] = useState<Promo | null>(null);
  const [cambiato, setCambiato] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?returnTo=/impostazioni/piano");
    else if (role && role !== "professional") router.replace("/dashboard");
  }, [authLoading, user, role, router]);

  useEffect(() => {
    if (!user || !pro) return;
    let active = true;
    (async () => {
      const [{ data: red }, { data: ev }] = await Promise.all([
        supabase
          .from("promo_redemptions")
          .select("redeemed_at, promo_codes ( code, description, expires_at )")
          .eq("user_id", user.id)
          .order("redeemed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("subscription_tier_events")
          .select("changed_at")
          .eq("professional_id", pro.id)
          .order("changed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!active) return;

      if (red) {
        const r = red as Record<string, unknown>;
        const c = (r.promo_codes ?? {}) as Record<string, unknown>;
        setPromo({
          redeemedAt: r.redeemed_at as string,
          code: (c.code as string) ?? "—",
          description: (c.description as string) ?? null,
          expiresAt: (c.expires_at as string) ?? null,
        });
      }
      if (ev) setCambiato((ev as { changed_at: string }).changed_at);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pro?.id]);

  if (loading) return <SectionSkeleton rows={3} />;
  if (failed) return <SectionError onRetry={reload} />;
  if (!pro) return <NoProProfile />;

  const attuale = pianoById(pro.tier);

  return (
    <div className="space-y-5">
      <SectionHeader title="Piano e pagamenti">
        Che piano hai, da quando, e cosa succede quando finisce.
      </SectionHeader>

      {/* Il piano attuale, con dentro cosa include: prima non c'era nessun
          posto dove leggerlo. */}
      <div className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-bob-ink/50">
              Il tuo piano
            </p>
            <p className="mt-1 text-xl font-bold text-bob-ink">
              {attuale.nome}
            </p>
          </div>
          <p className="text-sm text-bob-ink/55">
            {attuale.prezzo}
            {attuale.nota ? ` · ${attuale.nota}` : ""}
          </p>
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

      {/* Come l'ha ottenuto. Se e' un promo, la scadenza va detta - anche
          quando la scadenza non c'e', che e' il caso di oggi. */}
      {promo && (
        <div className="card p-5" data-testid="promo-attivo">
          <h3 className="text-sm font-semibold text-bob-ink">
            Come hai questo piano
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/70">
            Con il codice <span className="font-semibold">{promo.code}</span>,
            riscattato il {fmtData(promo.redeemedAt)}.
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

      {/* Gli altri piani, per confronto. Nessun bottone "passa a": non c'e'
          ancora niente dietro, e un bottone che non fa niente e' peggio della
          sua assenza. */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-bob-ink">Gli altri piani</h3>
        <p className="mt-1 text-sm text-bob-ink/55">
          Per cambiare piano, oggi, scrivici: lo facciamo noi.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PIANI.filter((p) => p.id !== pro.tier).map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-black/[0.07] p-4"
            >
              <p className="font-semibold text-bob-ink">{p.nome}</p>
              <p className="text-sm text-bob-ink/55">
                {p.prezzo}
                {p.nota ? ` · ${p.nota}` : ""}
              </p>
              <ul className="mt-2.5 space-y-1 text-sm text-bob-ink/65">
                {p.punti.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
          ))}
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
