"use client";

// «Dove lavori»: mappa e zone sullo stesso schermo.
//
// COME FUNZIONA
// Due viste dello stesso dato. Il cerchio (centro + raggio) accende le zone
// che ci cadono dentro; le zone si possono anche scegliere a mano, e in quel
// momento il cerchio smette di comandare. Chi lavora su un'area larga —
// tutta la città, la provincia, l'Italia — non disegna niente: scegle
// l'ampiezza e basta.
//
// CHI DECIDE QUANTO LARGO. Non il professionista: il catalogo
// (services.max_coverage_scope). Un fotografo copre l'Italia, un idraulico
// no, altrimenti il cliente di Milano si ritrova l'idraulico di Bari.
//
// COSA SALVA. Una riga in professional_coverage, che è PRIVATA: centro e
// raggio non escono da lì, perché il centro può essere casa sua. Il trigger
// della 057 ricalcola le zone lato database e pubblica solo i gettoni in
// professional_coverage_public. Dopo il salvataggio ricarichiamo da lì: se il
// conto del browser e quello del database divergono, vince il database e si
// vede subito.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  RAGGIO_DEFAULT,
  RAGGIO_MAX,
  RAGGIO_MIN,
  SCOPE_LABEL,
  SCOPE_ORDINE,
  zoneNelCerchio,
  type CittaRow,
  type Scope,
  type ZonaRow,
} from "@/lib/copertura";
import MappaCopertura from "@/components/MappaCopertura";

interface Props {
  professionalId: string;
  cityIdIniziale: string | null;
}

export default function AreaLavoroEditor({ professionalId, cityIdIniziale }: Props) {
  const supabase = createClient();

  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvato, setSalvato] = useState(false);

  const [citta, setCitta] = useState<CittaRow[]>([]);
  const [cityId, setCityId] = useState<string | null>(cityIdIniziale);
  const [zone, setZone] = useState<ZonaRow[]>([]);
  const [maxScope, setMaxScope] = useState<Scope | null>(null);

  const [rigaId, setRigaId] = useState<string | null>(null);
  const [rigaScope, setRigaScope] = useState<Scope | null>(null);
  const [scope, setScope] = useState<Scope>("zones");
  const [modo, setModo] = useState<"circle" | "zones">("circle");
  const [zoneSlugs, setZoneSlugs] = useState<string[]>([]);
  const [centro, setCentro] = useState<{ lat: number; lng: number } | null>(null);
  const [raggioM, setRaggioM] = useState(RAGGIO_DEFAULT);
  const [aDistanza, setADistanza] = useState(false);
  const [gettoni, setGettoni] = useState<string[]>([]);

  const cittaScelta = useMemo(
    () => citta.find((c) => c.id === cityId) ?? null,
    [citta, cityId]
  );

  // Ampiezze ammesse: dal catalogo, non dal professionista.
  const scopeAmmessi = useMemo(() => {
    if (!maxScope) return SCOPE_ORDINE;
    const tetto = SCOPE_ORDINE.indexOf(maxScope);
    return SCOPE_ORDINE.slice(0, tetto + 1);
  }, [maxScope]);

  const carica = useCallback(async () => {
    setCaricando(true);
    setErrore(null);
    try {
      const [cittaRes, copRes, svcRes, pubRes] = await Promise.all([
        supabase
          .from("cities")
          .select("id, name, slug, status, province, region, macro_region, coverage_keys")
          .order("name"),
        supabase
          .from("professional_coverage")
          .select(
            "id, scope, city_id, mode, zone_slugs, center_lat, center_lng, radius_m, works_remote"
          )
          .eq("professional_id", professionalId),
        supabase
          .from("professional_services")
          .select("services ( max_coverage_scope )")
          .eq("professional_id", professionalId)
          .limit(1),
        supabase
          .from("professional_coverage_public")
          .select("coverage_keys")
          .eq("professional_id", professionalId)
          .maybeSingle(),
      ]);

      const listaCitta = (cittaRes.data ?? []) as CittaRow[];
      setCitta(listaCitta);
      setGettoni((pubRes.data?.coverage_keys as string[] | undefined) ?? []);

      const svc = svcRes.data?.[0] as
        | { services: { max_coverage_scope: Scope | null } | null }
        | undefined;
      setMaxScope(svc?.services?.max_coverage_scope ?? null);

      const righe = (copRes.data ?? []) as {
        id: string;
        scope: Scope;
        city_id: string | null;
        mode: "zones" | "circle" | "polygon";
        zone_slugs: string[];
        center_lat: number | null;
        center_lng: number | null;
        radius_m: number | null;
        works_remote: boolean;
      }[];

      const riga = righe[0] ?? null;
      if (riga) {
        setRigaId(riga.id);
        setRigaScope(riga.scope);
        setScope(riga.scope);
        setModo(riga.mode === "circle" ? "circle" : "zones");
        setZoneSlugs(riga.zone_slugs ?? []);
        setRaggioM(riga.radius_m ?? RAGGIO_DEFAULT);
        setADistanza(riga.works_remote);
        setCityId(riga.city_id ?? cityIdIniziale);
        setCentro(
          riga.center_lat !== null && riga.center_lng !== null
            ? { lat: riga.center_lat, lng: riga.center_lng }
            : null
        );
      }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore di caricamento");
    } finally {
      setCaricando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId, cityIdIniziale]);

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le zone della città scelta.
  useEffect(() => {
    if (!cityId) {
      setZone([]);
      return;
    }
    let annullato = false;
    (async () => {
      const { data } = await supabase
        .from("city_zones")
        .select("slug, label, lat, lng")
        .eq("city_id", cityId)
        .order("label");
      if (annullato) return;
      setZone((data ?? []) as ZonaRow[]);
    })();
    return () => {
      annullato = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  // Primo centro: la media dei quartieri, se il pro non ne ha ancora uno.
  useEffect(() => {
    if (centro || zone.length === 0) return;
    const validi = zone.filter((z) => z.lat !== null && z.lng !== null);
    if (validi.length === 0) return;
    setCentro({
      lat: validi.reduce((s, z) => s + (z.lat as number), 0) / validi.length,
      lng: validi.reduce((s, z) => s + (z.lng as number), 0) / validi.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone]);

  // In modo cerchio le zone le decide il cerchio: anteprima, poi il database.
  useEffect(() => {
    if (modo !== "circle" || !centro) return;
    setZoneSlugs(zoneNelCerchio(zone, centro, raggioM));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, centro, raggioM, zone]);

  function toccaZona(slug: string) {
    setSalvato(false);
    setModo("zones");
    setZoneSlugs((prec) =>
      prec.includes(slug) ? prec.filter((s) => s !== slug) : [...prec, slug].sort()
    );
  }

  async function salva() {
    setSalvando(true);
    setErrore(null);
    setSalvato(false);
    try {
      const perZone = scope === "zones";
      const payload = {
        professional_id: professionalId,
        scope,
        city_id: scope === "national" ? null : cityId,
        mode: perZone ? modo : "zones",
        zone_slugs: perZone ? zoneSlugs : [],
        center_lat: perZone && modo === "circle" ? centro?.lat ?? null : null,
        center_lng: perZone && modo === "circle" ? centro?.lng ?? null : null,
        radius_m: perZone && modo === "circle" ? raggioM : null,
        works_remote: aDistanza,
      };

      // La chiave unica comprende l'ambito: se cambia, la riga vecchia va
      // rimossa, non aggiornata.
      if (rigaId && rigaScope === scope) {
        const { error } = await supabase
          .from("professional_coverage")
          .update(payload)
          .eq("id", rigaId);
        if (error) throw error;
      } else {
        if (rigaId) {
          const { error: delErr } = await supabase
            .from("professional_coverage")
            .delete()
            .eq("id", rigaId);
          if (delErr) throw delErr;
        }
        const { error } = await supabase.from("professional_coverage").insert(payload);
        if (error) throw error;
      }

      await carica();
      setSalvato(true);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSalvando(false);
    }
  }

  if (caricando) {
    return (
      <p className="flex items-center gap-2 text-sm text-bob-ink/50">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carico la mappa…
      </p>
    );
  }

  const perZone = scope === "zones";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label-bob" htmlFor="cop-citta">
            In che città lavori
          </label>
          <select
            id="cop-citta"
            value={cityId ?? ""}
            onChange={(e) => {
              setCityId(e.target.value || null);
              setCentro(null);
              setZoneSlugs([]);
              setSalvato(false);
            }}
            className="input-bob"
            disabled={scope === "national"}
            data-testid="select-citta-copertura"
          >
            <option value="">Scegli…</option>
            {citta.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status !== "active" ? " (prossimamente)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-bob" htmlFor="cop-scope">
            Quanto ti allontani
          </label>
          <select
            id="cop-scope"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as Scope);
              setSalvato(false);
            }}
            className="input-bob"
            data-testid="select-ampiezza-copertura"
          >
            {scopeAmmessi.map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABEL[s]}
              </option>
            ))}
          </select>
          {maxScope && scopeAmmessi.length < SCOPE_ORDINE.length && (
            <p className="mt-1 text-xs text-bob-ink/45">
              Per il tuo mestiere l&apos;area più larga possibile è
              «{SCOPE_LABEL[maxScope].toLowerCase()}»: i clienti cercano vicino,
              e una promessa più larga non ti porta lavoro.
            </p>
          )}
        </div>
      </div>

      {perZone ? (
        <>
          <MappaCopertura
            zone={zone}
            centro={centro}
            raggioM={raggioM}
            selezionate={zoneSlugs}
            interattivo={modo === "circle"}
            onCentro={(c) => {
              setCentro(c);
              setModo("circle");
              setSalvato(false);
            }}
            onZona={toccaZona}
          />

          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="label-bob mb-0" htmlFor="cop-raggio">
                Raggio: {(raggioM / 1000).toLocaleString("it-IT")} km
              </label>
              {modo === "zones" && (
                <button
                  type="button"
                  onClick={() => {
                    setModo("circle");
                    setSalvato(false);
                  }}
                  className="text-xs font-medium text-bob-indigo hover:underline"
                >
                  Torna al cerchio
                </button>
              )}
            </div>
            <input
              id="cop-raggio"
              type="range"
              min={RAGGIO_MIN}
              max={RAGGIO_MAX}
              step={500}
              value={raggioM}
              onChange={(e) => {
                setRaggioM(Number(e.target.value));
                setModo("circle");
                setSalvato(false);
              }}
              className="mt-2 w-full"
              data-testid="range-raggio"
            />
            <p className="mt-1 text-xs text-bob-ink/45">
              {modo === "circle"
                ? "Trascina il perno o clicca sulla mappa per spostare il centro. Tocca un quartiere per scegliere a mano."
                : "Stai scegliendo i quartieri a mano: il cerchio non comanda più."}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5" data-testid="chip-zone">
            {zone.map((z) => {
              const dentro = zoneSlugs.includes(z.slug);
              return (
                <button
                  key={z.slug}
                  type="button"
                  onClick={() => toccaZona(z.slug)}
                  aria-pressed={dentro}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    dentro
                      ? "border-bob-indigo bg-bob-indigo/10 text-bob-indigo"
                      : "border-black/10 text-bob-ink/60 hover:border-black/30"
                  }`}
                >
                  {z.label}
                </button>
              );
            })}
            {zone.length === 0 && (
              <p className="text-sm text-bob-ink/50">
                Per questa città non abbiamo ancora i quartieri: intanto puoi
                scegliere un&apos;area più larga qui sopra.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="card flex items-start gap-3 p-4">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-bob-ink/40" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-bob-ink">
              {SCOPE_LABEL[scope]}
              {scope !== "national" && cittaScelta ? ` — ${cittaScelta.name}` : ""}
            </p>
            <p className="mt-1 text-sm text-bob-ink/55">
              Con un&apos;area così larga non serve disegnare niente: ti
              proponiamo per ogni richiesta che ci arriva da qui.
            </p>
          </div>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-bob-ink/70">
        <input
          type="checkbox"
          checked={aDistanza}
          onChange={(e) => {
            setADistanza(e.target.checked);
            setSalvato(false);
          }}
          className="mt-0.5"
          data-testid="check-a-distanza"
        />
        <span>
          Lavoro anche a distanza, senza spostarmi
        </span>
      </label>

      {errore && <p className="text-sm text-red-600">{errore}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={salva}
          disabled={salvando || (scope !== "national" && !cityId)}
          className="btn-primary disabled:opacity-50"
          data-testid="button-salva-copertura"
        >
          {salvando ? "Salvo…" : "Salva l’area"}
        </button>
        {salvato && (
          <span className="flex items-center gap-1 text-sm text-emerald-700">
            <Check className="h-4 w-4" aria-hidden="true" /> Salvata
          </span>
        )}
      </div>

      {gettoni.length > 0 && (
        <p className="text-xs text-bob-ink/40">
          Come ti vede il motore di ricerca: {gettoni.length}{" "}
          {gettoni.length === 1 ? "area" : "aree"} pubblicate. Il centro e il
          raggio non escono da qui.
        </p>
      )}
    </div>
  );
}
