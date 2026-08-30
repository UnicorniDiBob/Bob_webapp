"use client";

// Sezione "La tua azienda": tutto e solo cio' che un cliente vede di te.
//
// Viene dalla vecchia /dashboard/profilo, che teneva insieme questo, la
// verifica della partita IVA, l'upload dei documenti, la prenotazione diretta
// e gli orari di disponibilita' in una pagina sola. Qui resta il profilo
// pubblico: le altre tre sono diventate /impostazioni/verifica e /impostazioni/orari.
//
// Le colonne sensibili (verifica, tier) restano protette lato database dal
// trigger protect_professional_columns: questa pagina non le tocca.
//
// IL SALVATAGGIO NON RIFIUTA PIU' TUTTO PER UN CAMPO SOLO (30/08).
// Com'era: se mancava il servizio principale, handleSave usciva PRIMA di
// scrivere qualunque cosa. Titolo, «chi sei», anni, tariffe e nota sul prezzo
// non venivano salvati, e uscendo dalla pagina erano persi. Il campo mancante
// sta in cima, il bottone Salva milletrecento pixel piu' giu': si leggeva una
// riga rossa sopra il bottone che parlava di un campo fuori schermo, senza
// nulla che lo segnasse. Segnalato da Lucio il 30/08 con la frase esatta: «se
// esci non puoi proseguire da dove hai terminato».
//
// Com'e' adesso, e perche'. Il servizio decide UNA cosa: se compari nelle
// ricerche (migrazione 062 — pronto = almeno un servizio dichiarato). Non
// decide se il resto del profilo puo' essere salvato. Quindi il resto si salva
// sempre, e il servizio mancante diventa quello che e': un avviso di
// visibilita', con la stessa identica frase che usano la campanella e il
// promemoria (motivoInvisibile, in lib/notifiche.ts).
// Restano bloccanti solo le cose che il database non accetterebbe o che
// renderebbero il profilo pubblico sbagliato: la citta' (NOT NULL su
// professionals) e un titolo leggibile. E quando bloccano, la pagina scorre
// sul campo e ce lo mette dentro il fuoco, invece di scriverlo in fondo.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { SectionHeader } from "@/components/ImpostazioniShell";
import {
  SectionSkeleton,
  SectionError,
  NoProProfile,
} from "@/components/SectionStates";
import { motivoInvisibile } from "@/lib/notifiche";

interface City {
  id: string;
  name: string;
  status: string;
}
interface Service {
  id: string;
  name: string;
  slug: string;
}
interface Subservice {
  id: string;
  service_id: string;
  name: string;
  slug: string;
}

// Scala standard dei tempi di risposta: un'unica tassonomia al posto del
// testo libero, cosi' le card dei professionisti restano confrontabili.
const RESPONSE_OPTIONS = [
  "Risponde in poche ore",
  "Risponde in giornata",
  "Risponde in 24h",
  "Risponde in 48h",
];

type CampoRotto = "citta" | "titolo" | "prezzo" | "servizio" | null;

/** L'anello rosso su un campo che ha fermato il salvataggio. */
const ANELLO = "ring-2 ring-red-400 border-red-300";

/**
 * Porta il campo sotto gli occhi e dentro il fuoco. Un errore scritto in fondo
 * a un modulo alto due schermate non e' un errore: e' un indovinello.
 */
function portaSuCampo(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => (el as HTMLElement).focus({ preventScroll: true }), 300);
}

export default function AziendaPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const [booted, setBooted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [serviceRowId, setServiceRowId] = useState<string | null>(null);

  const [cities, setCities] = useState<City[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [subservices, setSubservices] = useState<Subservice[]>([]);

  const [cityId, setCityId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState("");
  const [responseLabel, setResponseLabel] = useState(RESPONSE_OPTIONS[2]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [subSlugs, setSubSlugs] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  /** Quale campo ha fermato il salvataggio: si colora e prende il fuoco. */
  const [campoRotto, setCampoRotto] = useState<CampoRotto>(null);
  /** Salvato, ma c'e' una conseguenza da dire. Non e' un errore. */
  const [avviso, setAvviso] = useState<string | null>(null);
  /**
   * L'istantanea dei campi come stavano all'ultimo salvataggio (o al
   * caricamento). Serve a sapere se c'e' qualcosa di non salvato: senza, la
   * pagina non puo' avvertire chi sta per uscire.
   */
  const [salvato, setSalvato] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login?returnTo=/impostazioni/azienda");
    else if (role && role !== "professional") router.replace("/dashboard");
  }, [loading, user, role, router]);

  useEffect(() => {
    if (loading || !user || role !== "professional") return;
    let active = true;
    (async () => {
      const [{ data: cs }, { data: svcs }, { data: subs }, { data: prof, error: pErr }] =
        await Promise.all([
          supabase.from("cities").select("id, name, status").order("name"),
          supabase.from("services").select("id, name, slug").order("name"),
          supabase
            .from("subservices")
            .select("id, service_id, name, slug")
            .order("name"),
          supabase
            .from("professionals")
            .select(
              "id, city_id, headline, bio, years_experience, response_time_label, subservice_slugs"
            )
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);
      if (!active) return;

      if (pErr) {
        setFailed(true);
        setBooted(true);
        return;
      }

      setCities((cs ?? []) as City[]);
      setServices((svcs ?? []) as Service[]);
      setSubservices((subs ?? []) as Subservice[]);

      if (prof) {
        const p = prof as Record<string, unknown>;
        setProfileId(p.id as string);
        setCityId((p.city_id as string) ?? "");
        setHeadline((p.headline as string) ?? "");
        setBio((p.bio as string) ?? "");
        setYears(p.years_experience != null ? String(p.years_experience) : "");
        if (p.response_time_label)
          setResponseLabel(p.response_time_label as string);
        setSubSlugs((p.subservice_slugs as string[]) ?? []);

        const { data: ps } = await supabase
          .from("professional_services")
          .select("id, service_id, min_price, max_price, price_note")
          .eq("professional_id", p.id as string)
          .limit(1)
          .maybeSingle();
        if (active && ps) {
          const s = ps as Record<string, unknown>;
          setServiceRowId(s.id as string);
          setServiceId((s.service_id as string) ?? "");
          setMinPrice(s.min_price != null ? String(s.min_price) : "");
          setMaxPrice(s.max_price != null ? String(s.max_price) : "");
          setPriceNote((s.price_note as string) ?? "");
        }
      }
      setBooted(true);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, role]);

  // L'impronta dei campi: cambia a ogni tasto, e confrontata con l'ultima
  // salvata dice se c'e' del lavoro che uscendo si perderebbe.
  const impronta = useMemo(
    () =>
      JSON.stringify([
        cityId,
        serviceId,
        headline,
        bio,
        years,
        responseLabel,
        minPrice,
        maxPrice,
        priceNote,
        [...subSlugs].sort(),
      ]),
    [
      cityId,
      serviceId,
      headline,
      bio,
      years,
      responseLabel,
      minPrice,
      maxPrice,
      priceNote,
      subSlugs,
    ]
  );

  // Alla fine del caricamento l'impronta di partenza e' quella che c'e' scritto
  // nel database: da li' in poi ogni differenza e' roba non salvata.
  useEffect(() => {
    if (booted && salvato === null) setSalvato(impronta);
  }, [booted, salvato, impronta]);

  const nonSalvato = salvato !== null && impronta !== salvato;

  // L'avviso del browser prima di chiudere o ricaricare. Non copre la
  // navigazione interna di Next (non c'e' un gancio per farlo in App Router):
  // per quella c'e' la riga visibile accanto al bottone. Meglio due mezze
  // reti dichiarate che una promessa che non regge.
  useEffect(() => {
    if (!nonSalvato) return;
    function avvisa(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [nonSalvato]);

  const serviceSubs = useMemo(
    () => subservices.filter((s) => s.service_id === serviceId),
    [subservices, serviceId]
  );

  function toggleSub(slug: string) {
    setSubSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function ferma(campo: Exclude<CampoRotto, null>, id: string, messaggio: string) {
    setCampoRotto(campo);
    setError(messaggio);
    portaSuCampo(id);
  }

  async function handleSave() {
    if (!user || !profileId || saving) return;
    setError(null);
    setAvviso(null);
    setCampoRotto(null);
    setSavedAt(null);

    // BLOCCANTI: solo cio' che il database rifiuterebbe (city_id e' NOT NULL su
    // professionals) o che renderebbe pubblico un profilo sbagliato.
    if (!cityId) {
      return ferma("citta", "az-city", "Scegli la tua citta: senza, il profilo non si puo salvare.");
    }
    if (headline.trim().length < 5) {
      return ferma(
        "titolo",
        "az-headline",
        "Scrivi un titolo di almeno 5 caratteri: e la prima riga che legge un cliente."
      );
    }
    const minP = minPrice ? Number(minPrice) : null;
    const maxP = maxPrice ? Number(maxPrice) : null;
    if (minP != null && maxP != null && minP > maxP) {
      return ferma(
        "prezzo",
        "az-min-price",
        "Il prezzo minimo non puo superare il massimo."
      );
    }

    setSaving(true);
    try {
      const { error: upErr } = await supabase
        .from("professionals")
        .update({
          city_id: cityId,
          headline: headline.trim(),
          bio: bio.trim() || null,
          years_experience: years ? Number(years) : null,
          response_time_label: responseLabel,
          subservice_slugs: subSlugs,
        })
        .eq("id", profileId);
      if (upErr) throw upErr;

      // IL SERVIZIO NON BLOCCA IL SALVATAGGIO, decide la visibilita'. Se manca,
      // tutto il resto e' gia' scritto qui sopra: si dice la conseguenza e si
      // segna il campo, non si butta via il lavoro.
      if (!serviceId) {
        setSalvato(impronta);
        setSavedAt(Date.now());
        setCampoRotto("servizio");
        setAvviso(
          motivoInvisibile({ servizi: 0, disattivato: false }) ??
            "manca il servizio principale"
        );
        return;
      }

      const serviceFields = {
        professional_id: profileId,
        service_id: serviceId,
        city_id: cityId,
        min_price: minP,
        max_price: maxP,
        price_note: priceNote.trim() || null,
      };
      if (serviceRowId) {
        const { error: sErr } = await supabase
          .from("professional_services")
          .update(serviceFields)
          .eq("id", serviceRowId);
        if (sErr) throw sErr;
      } else {
        const { data: sIns, error: sErr } = await supabase
          .from("professional_services")
          .insert(serviceFields)
          .select("id")
          .single();
        if (sErr) throw sErr;
        setServiceRowId((sIns as { id: string }).id);
      }

      setSalvato(impronta);
      setSavedAt(Date.now());
    } catch {
      setError("Non sono riuscito a salvare. Controlla i campi e riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !booted) return <SectionSkeleton rows={4} />;
  if (failed) return <SectionError onRetry={() => router.refresh()} />;
  if (!profileId) return <NoProProfile />;

  return (
    <div>
      <SectionHeader title="La tua azienda">
        Queste informazioni sono quelle che un cliente legge prima di
        scriverti. Le modifiche sono online appena salvi.
      </SectionHeader>

      <div className="card space-y-5 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-bob" htmlFor="az-city">
              Città
            </label>
            <select
              id="az-city"
              value={cityId}
              onChange={(e) => {
                setCityId(e.target.value);
                if (campoRotto === "citta") setCampoRotto(null);
              }}
              aria-invalid={campoRotto === "citta"}
              className={`input-bob ${campoRotto === "citta" ? ANELLO : ""}`}
              data-testid="profile-city"
            >
              <option value="">Scegli…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.status !== "active" ? " (lista d'attesa)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-bob" htmlFor="az-service">
              Servizio principale{" "}
              <span className="font-normal text-bob-ink/45">
                {"\u2014 senza, non compari nelle ricerche"}
              </span>
            </label>
            <select
              id="az-service"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSubSlugs([]);
                if (campoRotto === "servizio") {
                  setCampoRotto(null);
                  setAvviso(null);
                }
              }}
              aria-invalid={campoRotto === "servizio"}
              className={`input-bob ${campoRotto === "servizio" ? ANELLO : ""}`}
              data-testid="profile-service"
            >
              <option value="">Scegli…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {serviceSubs.length > 0 && (
          <div>
            <span className="label-bob">Di cosa ti occupi</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {serviceSubs.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSub(s.slug)}
                  className={`chip ${
                    subSlugs.includes(s.slug)
                      ? "bg-bob-indigo text-white"
                      : "hover:bg-bob-indigo-100"
                  }`}
                  aria-pressed={subSlugs.includes(s.slug)}
                  data-testid={`profile-sub-${s.slug}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label-bob" htmlFor="az-headline">
            Titolo del profilo
          </label>
          <input
            id="az-headline"
            value={headline}
            onChange={(e) => {
              setHeadline(e.target.value);
              if (campoRotto === "titolo") setCampoRotto(null);
            }}
            maxLength={80}
            placeholder="Es. Interventi idraulici rapidi in città"
            aria-invalid={campoRotto === "titolo"}
            className={`input-bob ${campoRotto === "titolo" ? ANELLO : ""}`}
            data-testid="profile-headline"
          />
        </div>

        <div>
          <label className="label-bob" htmlFor="az-bio">
            Chi sei
          </label>
          <textarea
            id="az-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={600}
            rows={4}
            placeholder="Es. Idraulico con 10 anni di esperienza su appartamenti e piccoli condomini…"
            className="input-bob resize-none"
            data-testid="profile-bio"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-bob" htmlFor="az-years">
              Anni di esperienza
            </label>
            <input
              id="az-years"
              type="number"
              min={0}
              max={60}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              className="input-bob"
              data-testid="profile-years"
            />
          </div>
          <div>
            <label className="label-bob" htmlFor="az-response">
              Tempo di risposta
            </label>
            <select
              id="az-response"
              value={responseLabel}
              onChange={(e) => setResponseLabel(e.target.value)}
              className="input-bob"
              data-testid="profile-response"
            >
              {RESPONSE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="label-bob">Tariffa indicativa (€/h)</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="az-min-price"
              type="number"
              min={0}
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value);
                if (campoRotto === "prezzo") setCampoRotto(null);
              }}
              placeholder="Min"
              aria-invalid={campoRotto === "prezzo"}
              className={`input-bob ${campoRotto === "prezzo" ? ANELLO : ""}`}
              aria-label="Tariffa minima oraria"
              data-testid="profile-min-price"
            />
            <span className="text-bob-ink/40">–</span>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              className="input-bob"
              aria-label="Tariffa massima oraria"
              data-testid="profile-max-price"
            />
          </div>
          <input
            value={priceNote}
            onChange={(e) => setPriceNote(e.target.value)}
            maxLength={120}
            placeholder="Nota sul prezzo (es. sopralluogo incluso entro Milano città)"
            className="input-bob mt-2"
            aria-label="Nota sul prezzo"
            data-testid="profile-price-note"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-bob-ink/45">
            I clienti su BOB scelgono chi è trasparente: una forbice onesta
            porta richieste più in linea con le tue tariffe.
          </p>
        </div>

        {error && (
          <p
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
            data-testid="profile-error"
          >
            {error}
          </p>
        )}

        {/* SALVATO, MA C'E' UNA CONSEGUENZA. Il verde direbbe «fatto» e
            basterebbe a chiudere la pagina credendo di essere online; il rosso
            direbbe «errore» e non e' vero, perche' e' tutto salvato. Un terzo
            stato per una terza cosa. */}
        {savedAt && avviso && !error && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
            role="status"
            data-testid="profile-salvato-invisibile"
          >
            <p>
              <span className="font-semibold">
                {"\u2713 Salvato, ma i clienti non ti trovano:"}
              </span>{" "}
              {avviso}.
            </p>
            <button
              type="button"
              onClick={() => portaSuCampo("az-service")}
              className="mt-1.5 font-semibold underline-offset-2 hover:underline"
              data-testid="profile-vai-al-servizio"
            >
              {"Scegli il servizio \u2192"}
            </button>
          </div>
        )}

        {savedAt && !avviso && !error && (
          <p
            className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            role="status"
          >
            ✓ Salvato. Le modifiche sono già online.
          </p>
        )}

        {nonSalvato && !saving && (
          <p
            className="text-sm text-bob-ink/55"
            data-testid="profile-non-salvato"
          >
            {"Ci sono modifiche non salvate."}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 py-3"
            data-testid="profile-save"
          >
            {saving ? "Salvo…" : "Salva le modifiche"}
          </button>
          <Link
            href={`/professionisti/${profileId}`}
            className="btn-secondary flex-1 py-3 text-center"
          >
            Vedi come ti vedono
          </Link>
        </div>
      </div>
    </div>
  );
}
