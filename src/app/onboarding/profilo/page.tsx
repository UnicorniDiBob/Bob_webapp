"use client";

// Onboarding professionista, passo 2: il questionario.
//
// PERCHÉ QUESTA PAGINA
// Poche domande che servono davvero al servizio: che lavoro fai e dove — senza
// queste due il matching non può proporti a nessuno — più anzianità (mostrata
// sul profilo) e canale di provenienza (facoltativo, per capire cosa funziona).
// Flusso deciso con Lucio il 14/08: piano → questionario → dashboard.
//
// COSA FA DAVVERO
// 1. salva le risposte in onboarding_answers (RLS: solo tu e lo staff);
// 2. crea la riga professionals se manca — è QUESTO il momento in cui il
//    profilo pro nasce, prima lo creava lo staff a mano;
// 3. scrive il NOME DELL'ATTIVITÀ (065) e, se lo dai, il CELLULARE;
// 4. sincronizza il tier con gli eventuali codici promo riscattati al passo 1
//    (il tier è protetto da trigger: passa dal server, non da qui).
//
// I DUE CAMPI AGGIUNTI IL 30/08, e perché.
//
// NOME DELL'ATTIVITÀ — non c'era, e il risultato era che la scheda pubblica si
// intitolava con il nome e il cognome della persona iscritta. Il nome con cui
// un professionista si presenta ai clienti è la prima cosa che deve leggersi;
// il nome del titolare serve a noi (assistenza, verifica, fatturazione) e non
// ha motivo di stare su una pagina pubblica. È obbligatorio ma non è un
// ostacolo: arriva già scritto con «Nome Cognome» e chi ha una ditta lo
// cambia. Vedi migrazione 065.
//
// CELLULARE — facoltativo, e resta facoltativo. Non lo vede il cliente: serve
// a noi per l'assistenza e per la prenotazione diretta. Chiederlo qui evita
// che resti una spunta rossa nella checklist per settimane; renderlo
// obbligatorio sarebbe raccogliere un contatto per una funzione che ancora non
// esiste (DATA_COMPLIANCE §2: minimizzazione). Stessa finalità e stessa riga
// di RoPA della 051, nessun trattamento nuovo.
//
// PRIVACY (DATA_COMPLIANCE §2): base giuridica contratto per mestiere/città/
// zona/esperienza; heard_from è facoltativo (legittimo interesse, metrica di
// canale). Retention: vita dell'account, cancellazione a cascata. Riga RoPA
// in docs/legal/ROPA.md nello stesso commit.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";

interface CityRow {
  id: string;
  name: string;
  status: string | null;
}
interface ServiceRow {
  id: string;
  name: string;
  slug: string;
}

const CANALI = [
  "Passaparola",
  "Ricerca Google",
  "Social (Instagram, Facebook…)",
  "Un altro professionista",
  "Stampa o news",
  "Altro",
];

export default function OnboardingProfiloPage() {
  return (
    <Suspense
      fallback={
        <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
          Carico…
        </div>
      }
    >
      <ProfiloInner />
    </Suspense>
  );
}

function ProfiloInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const piano = params.get("piano") ?? "free";

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [profession, setProfession] = useState("");
  const [professionAltro, setProfessionAltro] = useState("");
  const [cityId, setCityId] = useState("");
  const [zone, setZone] = useState("");
  const [years, setYears] = useState("");
  const [heardFrom, setHeardFrom] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?mode=signup&role=professional");
        return;
      }
      const [{ data: roleRow }, citiesRes, servicesRes, profRes, proRes] =
        await Promise.all([
          supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
          supabase.from("cities").select("id, name, status").order("name"),
          supabase.from("services").select("id, name, slug").order("name"),
          supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("professionals")
            .select("business_name")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);
      if (roleRow?.role !== "professional") {
        router.replace("/dashboard");
        return;
      }
      setUserId(user.id);
      // Precompilato con il nome della persona: chi lavora in proprio non deve
      // inventarsi niente, chi ha una ditta lo sovrascrive. Se il campo è già
      // stato compilato (questionario rifatto) vince quello che c'è.
      setBusinessName(
        ((proRes.data as { business_name?: string | null } | null)
          ?.business_name ??
          (profRes.data as { full_name?: string | null } | null)?.full_name ??
          "").trim()
      );
      setCities((citiesRes.data ?? []) as CityRow[]);
      setServices((servicesRes.data ?? []) as ServiceRow[]);
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    setError(null);
    try {
      // Il select porta l'id del servizio (serve per professional_services);
      // il questionario conserva il nome, che è ciò che il pro ha letto.
      const attivita = businessName.trim().replace(/\s+/g, " ");
      if (attivita.length < 2 || attivita.length > 80) {
        setError(
          "Scrivi il nome con cui ti presenti ai clienti: da 2 a 80 caratteri."
        );
        setSubmitting(false);
        return;
      }
      // Facoltativo, ma se c'è deve essere un numero: un campo che accetta
      // qualunque cosa produce contatti inutilizzabili e nessun avviso.
      const tel = phone.replace(/[\s./-]/g, "");
      if (tel && !/^\+?\d{8,15}$/.test(tel)) {
        setError("Il numero non mi torna. Solo cifre, con o senza +39.");
        setSubmitting(false);
        return;
      }

      const servizioScelto =
        profession === "__altro__"
          ? null
          : services.find((s) => s.id === profession) ?? null;
      const professionValue =
        profession === "__altro__"
          ? professionAltro.trim()
          : servizioScelto?.name ?? "";
      if (!professionValue) {
        setError("Dicci che lavoro fai: serve per proporti alle persone giuste.");
        setSubmitting(false);
        return;
      }
      if (!cityId) {
        setError("Scegli la città in cui lavori.");
        setSubmitting(false);
        return;
      }

      // 1. Risposte del questionario (upsert: ricompilare non è un errore).
      const { error: ansErr } = await supabase.from("onboarding_answers").upsert({
        user_id: userId,
        role: "professional",
        profession: professionValue,
        city: cities.find((c) => c.id === cityId)?.name ?? null,
        zone: zone.trim() || null,
        years_experience: years ? Number(years) : null,
        heard_from: heardFrom || null,
        chosen_plan: piano,
      });
      if (ansErr) throw ansErr;

      // 2. La riga professionals nasce qui, se non c'è già.
      const { data: existing } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      let professionalId: string | null = existing?.id ?? null;
      if (!professionalId) {
        const { data: creato, error: insErr } = await supabase
          .from("professionals")
          .insert({
            user_id: userId,
            city_id: cityId,
            business_name: attivita,
            years_experience: years ? Number(years) : null,
            verification_status: "unverified",
            subscription_tier: "free",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        professionalId = creato?.id ?? null;
      } else {
        // Questionario rifatto: il nome dell'attività è l'unica cosa che ha
        // senso riscrivere (città ed esperienza si cambiano da /impostazioni).
        const { error: updErr } = await supabase
          .from("professionals")
          .update({ business_name: attivita })
          .eq("id", professionalId);
        if (updErr) throw updErr;
      }

      // 2-bis. Il cellulare, se l'ha dato. Non blocca: se la scrittura fallisce
      // il primo ingresso non si ferma per un campo facoltativo — resta nella
      // checklist con il suo link, che è esattamente cosa serve.
      if (tel) {
        await supabase.from("profile_phone").upsert(
          { user_id: userId, phone: tel, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      }

      // 3. IL SERVIZIO. Senza una riga in professional_services il profilo
      //    non compare in nessuna ricerca: getProfessionals() costruisce la
      //    card dal primo servizio dichiarato e filtra su quello
      //    (src/lib/data.ts). Fino al 27/08 il mestiere finiva solo in
      //    onboarding_answers, come testo: si completava l'iscrizione e si
      //    restava invisibili. Verificato in produzione con un account vero.
      //    Chi scrive un mestiere fuori catalogo non ha un service_id da
      //    collegare: la riga non si crea, e glielo diciamo nel form.
      if (professionalId && servizioScelto) {
        const { count } = await supabase
          .from("professional_services")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", professionalId);
        if (!count) {
          const { error: svcErr } = await supabase
            .from("professional_services")
            .insert({
              professional_id: professionalId,
              service_id: servizioScelto.id,
              city_id: cityId,
            });
          if (svcErr) throw svcErr;
        }
      }

      // 4. Applica IL PIANO SCELTO al passo precedente, adesso che la riga
      //    professionals esiste. Fino al 30/08 qui si chiamava "sync", che
      //    applicava il piano piu' alto fra quelli concessi dai codici
      //    riscattati: chi entrava con il codice dei fondatori e sceglieva
      //    Free finiva Business lo stesso. Adesso si chiede il piano che ha
      //    scelto lui, e il server lo concede solo se con i suoi sconti costa
      //    zero (migrazione 064).
      await fetch("/api/onboarding/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scegli", piano }),
      });

      // FINISCE NELL'AREA DI LAVORO, non su un form di impostazioni. Fino a
      // oggi si atterrava su /impostazioni/azienda: la prima cosa che un
      // professionista vedeva di Bob era una pagina di campi, senza sapere
      // dove arrivano le richieste. Ora si arriva in /dashboard, che apre da
      // sola la guida del primo accesso (GuidaPrimoAccesso) e da lì manda
      // dove serve.
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
        Carico…
      </div>
    );
  }

  return (
    <div className="container-bob flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
      <div className="w-full max-w-lg">
        <div className="card p-7">
          <div className="mb-5 text-center">
            <LogoMark className="mx-auto mb-3" />
            <h1 className="text-xl font-bold text-bob-ink">
              Come ti presentiamo ai clienti
            </h1>
            <p className="mt-1 text-sm text-bob-ink/55">
              Poche cose, e ci siamo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="label-bob" htmlFor="businessName">
                Nome della tua attività
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="input-bob"
                maxLength={80}
                placeholder="Es. IdroMilano Express"
                data-testid="input-business-name"
                required
              />
              <p className="mt-1 text-xs text-bob-ink/50">
                È il titolo della tua scheda: i clienti vedono questo. Se
                lavori in proprio va benissimo il tuo nome.
              </p>
            </div>

            <div>
              <label className="label-bob" htmlFor="profession">
                Che lavoro fai?
              </label>
              <select
                id="profession"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="input-bob"
                data-testid="input-profession"
                required
              >
                <option value="">Scegli la categoria…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="__altro__">Altro…</option>
              </select>
              {profession === "__altro__" && (
                <input
                  type="text"
                  value={professionAltro}
                  onChange={(e) => setProfessionAltro(e.target.value)}
                  className="input-bob mt-2"
                  placeholder="Scrivi il tuo mestiere"
                  data-testid="input-profession-altro"
                />
              )}
              {profession === "__altro__" && (
                <p className="mt-1 text-xs text-bob-ink/50">
                  Le categorie fuori elenco le colleghiamo a mano: per
                  comparire subito nelle ricerche scegli quella più vicina al
                  tuo lavoro.
                </p>
              )}
            </div>

            <div>
              <label className="label-bob" htmlFor="city">
                In che città lavori?
              </label>
              <select
                id="city"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="input-bob"
                data-testid="input-city"
                required
              >
                <option value="">Scegli la città…</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status !== "active" ? " (prossimamente)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-bob" htmlFor="zone">
                Zona o quartiere <span className="font-normal text-bob-ink/40">(facoltativo)</span>
              </label>
              <input
                id="zone"
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="input-bob"
                placeholder="Es. Isola, Navigli, hinterland nord…"
                data-testid="input-zone"
              />
            </div>

            <div>
              <label className="label-bob" htmlFor="phone">
                Cellulare{" "}
                <span className="font-normal text-bob-ink/40">(facoltativo)</span>
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-bob"
                placeholder="Es. 348 1234567"
                data-testid="input-phone"
              />
              <p className="mt-1 text-xs text-bob-ink/50">
                Non lo vede il cliente: serve a noi per l&apos;assistenza e per
                la prenotazione diretta.
              </p>
            </div>

            <div>
              <label className="label-bob" htmlFor="years">
                Da quanti anni fai questo lavoro?
              </label>
              <select
                id="years"
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="input-bob"
                data-testid="input-years"
              >
                <option value="">Preferisco non dirlo</option>
                {[1, 2, 3, 5, 10, 15, 20, 25, 30].map((y) => (
                  <option key={y} value={String(y)}>
                    {y === 30 ? "30 o più" : `${y}${y === 1 ? " anno" : " anni"}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-bob" htmlFor="heardFrom">
                Come ci hai conosciuto? <span className="font-normal text-bob-ink/40">(facoltativo)</span>
              </label>
              <select
                id="heardFrom"
                value={heardFrom}
                onChange={(e) => setHeardFrom(e.target.value)}
                className="input-bob"
                data-testid="input-heard-from"
              >
                <option value="">Scegli…</option>
                {CANALI.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full disabled:opacity-50"
              data-testid="button-completa-onboarding"
            >
              {submitting ? "Salvo…" : "Completa e vai al profilo"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
