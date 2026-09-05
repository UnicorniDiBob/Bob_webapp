"use client";

// AREA DI LAVORO. Smista per ruolo:
// - Professionista → ProWorkspace (richieste, calendario, giornata)
// - Cliente → CustomerHome (Da fare ora, lavori in corso, appuntamenti,
//   professionisti di fiducia, storico) — vive in components/CustomerHome.tsx
//
// Le impostazioni NON stanno qui: dal 19/08 vivono sotto /impostazioni, con un
// guscio proprio. Prima erano nella stessa navigazione, e il risultato era
// "Oggi" accanto a "Accesso e sicurezza" — il lavoro di ogni giorno sulla
// stessa fila di cose che si aprono due volte l'anno.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ProWorkspace } from "@/components/ProWorkspace";
import { CustomerHome } from "@/components/CustomerHome";
import GuidaPrimoAccesso from "@/components/GuidaPrimoAccesso";
import { leggiProgresso } from "@/lib/guidaProgresso";

interface ProProfile {
  id: string;
  user_id: string;
  headline: string | null;
  bio: string | null;
  verification_status: "unverified" | "pending" | "verified";
  /** Livello del blocco 10: decide sia il badge sia l'invito alla verifica. */
  verification_level: "none" | "vat_verified" | "documents_verified";
  subscription_tier: "free" | "pro" | "business";
  /** Quando ha visto la guida del primo accesso (057). null = non ancora. */
  onboarding_completed_at: string | null;
  city: { name: string } | null;
}

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, fullName, loading } = useAuth();

  const [proProfile, setProProfile] = useState<ProProfile | null>(null);
  const [proRating, setProRating] = useState<{ avg: number | null; n: number }>({
    avg: null,
    n: 0,
  });
  const [loadingPro, setLoadingPro] = useState(true);
  // La guida del primo accesso: si apre da sola se il profilo non l'ha ancora
  // vista, e si puo' riaprire dal link in fondo all'area di lavoro.
  const [guidaAperta, setGuidaAperta] = useState(false);
  const [guidaVista, setGuidaVista] = useState(false);
  // Il giro era in corso ed e' andato a sistemare qualcosa: si riprende dalle
  // cose da fare, non dalla spiegazione che ha gia' visto.
  const [riprendiGuida, setRiprendiGuida] = useState(false);

  useEffect(() => {
    const progresso = leggiProgresso();
    if (progresso?.attiva) {
      setRiprendiGuida(true);
      setGuidaAperta(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Gli account staff non hanno un'area personale: dritti al pannello admin.
  useEffect(() => {
    if (!loading && (role === "admin" || role === "cs")) {
      router.replace("/admin");
    }
  }, [loading, role, router]);

  useEffect(() => {
    if (!user || role !== "professional") {
      setLoadingPro(false);
      return;
    }
    let active = true;

    (async () => {
      setLoadingPro(true);
      const { data: prof } = await supabase
        .from("professionals")
        .select(
          "id, user_id, headline, bio, verification_status, verification_level, subscription_tier, onboarding_completed_at, cities ( name )"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (prof) {
        const p = prof as Record<string, unknown>;
        // LO STATO DELLA VERIFICA NON SI LEGGE PIU' QUI (30/08). Era servito a
        // un riquadro sulla dashboard; adesso e' una notifica di servizio come
        // le altre e la legge lib/notifiche.ts, in un posto solo per tutte.
        const cityObj = p.cities as { name: string } | null;
        if (active) {
          setProProfile({
            id: p.id as string,
            user_id: p.user_id as string,
            headline: (p.headline as string) ?? null,
            bio: (p.bio as string) ?? null,
            verification_status:
              (p.verification_status as ProProfile["verification_status"]) ??
              "unverified",
            verification_level:
              (p.verification_level as ProProfile["verification_level"]) ??
              "none",
            subscription_tier:
              (p.subscription_tier as ProProfile["subscription_tier"]) ?? "free",
            onboarding_completed_at:
              (p.onboarding_completed_at as string | null) ?? null,
            city: cityObj ? { name: cityObj.name } : null,
          });
        }

        const { data: ratings } = await supabase
          .from("ratings")
          .select("score")
          .eq("professional_id", p.id as string);
        const arr = (ratings ?? []) as { score: number }[];
        const avg =
          arr.length > 0
            ? Math.round(
                (arr.reduce((s, r) => s + r.score, 0) / arr.length) * 10
              ) / 10
            : null;
        if (active) setProRating({ avg, n: arr.length });
      }

      if (active) setLoadingPro(false);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  if (loading || (!user && !loading) || role === "admin" || role === "cs") {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/50" aria-busy="true">
        Carico la tua area personale…
      </div>
    );
  }

  const isPro = role === "professional";
  const nome = fullName?.trim().split(" ")[0];

  return (
    <div className="container-bob py-8 sm:py-10">
      {/* AREA DI LAVORO, non impostazioni (separazione decisa il 19/08).
          Qui sta solo cio' che serve oggi: al professionista le richieste e il
          calendario, al cliente i lavori in corso e la ricerca. La
          configurazione dell'account vive sotto /impostazioni e si raggiunge
          dall'icona nel header — e da qui sotto, per chi non la nota. */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="section-eyebrow">
            {isPro ? "Il mio lavoro" : "I miei lavori"}
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
            {nome ? `Ciao ${nome}` : "Ciao"}
          </h1>
          <p className="mt-1.5 text-sm text-bob-ink/60">
            {isPro
              ? "Le richieste che ti riguardano e la tua giornata."
              : "Il punto della situazione sui tuoi lavori."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* IL BOTTONE «CERCA UN PROFESSIONISTA» NON E' PIU' QUI (05/09).
              Puntava a /#bob, cioe' esattamente dove porta «Parla con Bob»
              nell'header: due bottoni primari, stessa destinazione, stesso
              schermo, a pochi centimetri l'uno dall'altro. Un cliente che ne
              vede due si chiede in cosa differiscano, e la risposta era: in
              niente. Resta quello dell'header, che c'e' su ogni pagina.
              Segnalato da Lucio il 05/09. */}
          {/* IMPOSTAZIONI, UNA VOLTA SOLA PER SCHERMO (29/08). Questo link
              conviveva con la rotella dell'header, a due centimetri di
              distanza e con lo stesso data-testid: due bottoni identici nello
              stesso angolo, e un test che non sapeva quale dei due stesse
              cliccando. La rotella pero' vive dentro un blocco `hidden
              md:flex`: su telefono sparisce e resta solo la voce nel menu ☰.
              Quindi il link resta, ma solo sotto md, dove la rotella non c'e'. */}
          <Link
            href="/impostazioni/dati"
            className="btn-ghost text-sm md:hidden"
            data-testid="link-impostazioni-dashboard"
          >
            Impostazioni
          </Link>
        </div>
      </header>

      {role === "professional" ? (
        loadingPro ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="card h-28 animate-pulse bg-black/[0.03]" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* L'INVITO ALLA VERIFICA NON E' PIU' QUI (30/08). Era una fascia
                sopra l'area di lavoro, cioe' l'unica notifica di servizio con
                una casa propria: adesso sta nella campanella insieme alle
                risposte dello staff e allo stato del profilo. Le regole (solo
                a chi ha un piano che la include, quattro stati diversi per
                quattro momenti della pratica) sono le stesse, scritte in
                lib/notifiche.ts. */}
            <ProWorkspace
              profile={proProfile}
              rating={proRating}
              name={fullName ?? "Professionista"}
            />

            {proProfile && (
              <p className="text-center text-xs text-bob-ink/40">
                <button
                  type="button"
                  onClick={() => {
                    setRiprendiGuida(false);
                    setGuidaAperta(true);
                  }}
                  className="font-medium text-bob-ink/50 underline-offset-2 transition hover:text-bob-indigo hover:underline"
                  data-testid="button-rivedi-guida"
                >
                  Rivedi la guida
                </button>
              </p>
            )}

            {/* La guida illumina elementi gia' in pagina e legge lo stato del
                profilo per sapere cosa manca: da li' nascono i passi che
                accompagnano. Si apre da sola al primo accesso, oppure quando un
                giro lasciato a meta' chiede di riprendere. */}
            {proProfile &&
              user &&
              (guidaAperta ||
                (!guidaVista && proProfile.onboarding_completed_at === null)) && (
                <GuidaPrimoAccesso
                  professionalId={proProfile.id}
                  userId={user.id}
                  nome={fullName ?? "Professionista"}
                  riprendi={riprendiGuida}
                  onChiudi={() => {
                    setGuidaAperta(false);
                    setRiprendiGuida(false);
                    setGuidaVista(true);
                  }}
                />
              )}
          </div>
        )
      ) : (
        <CustomerHome />
      )}
    </div>
  );
}
