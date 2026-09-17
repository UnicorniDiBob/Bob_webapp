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
  comuniNelCerchio,
  gettoniRichiesta,
  trovaPerRichiesta,
  zoneNelCerchio,
  type CittaRow,
  type ComuneRow,
  type Scope,
  type ZonaRow,
} from "@/lib/copertura";
import MappaCopertura from "@/components/MappaCopertura";

interface Props {
  professionalId: string;
  cityIdIniziale: string | null;
}

// Le zone raccolte sotto il nome corto a cui appartengono (`group_slug`, 084).
// L'etichetta del gruppo si ricava dalla slug invece di leggere
// src/lib/zones.ts: quel file serve il percorso del cliente ed è area di
// André, e qui non serve dipenderne.
function raggruppa(elenco: ZonaRow[]) {
  const per = new Map<string, ZonaRow[]>();
  for (const z of elenco) {
    const chiave = z.group_slug ?? "";
    per.set(chiave, [...(per.get(chiave) ?? []), z]);
  }
  const nome = (slug: string) =>
    slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  return [...per.entries()]
    .map(([chiave, zone]) => ({
      chiave: chiave || "_altri",
      etichetta: chiave ? nome(chiave) : "Altri quartieri",
      zone,
    }))
    .sort((a, b) => {
      if (a.chiave === "_altri") return 1;
      if (b.chiave === "_altri") return -1;
      return a.etichetta.localeCompare(b.etichetta, "it");
    });
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
  const [filtroZona, setFiltroZona] = useState("");
  const [comuni, setComuni] = useState<ComuneRow[]>([]);
  const [comuniIstat, setComuniIstat] = useState<string[]>([]);
  const [siglaProvincia, setSiglaProvincia] = useState<string | null>(null);
  // Il punto da cui parte la mappa quando il professionista non ha ancora
  // disegnato niente: il suo comune (085), non il centro della città.
  const [base, setBase] = useState<{
    lat: number;
    lng: number;
    nome: string;
    provincia: string;
    sigla: string;
  } | null>(null);
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
  const [zonaProva, setZonaProva] = useState("");

  const cittaScelta = useMemo(
    () => citta.find((c) => c.id === cityId) ?? null,
    [citta, cityId]
  );

  // Tutti gli ambiti si scelgono: «comuni» ha la sua interfaccia da adesso.
  const ordineVisibile = useMemo<Scope[]>(() => SCOPE_ORDINE, []);

  // Ampiezze ammesse: dal catalogo, non dal professionista.
  const scopeAmmessi = useMemo(() => {
    if (!maxScope) return ordineVisibile;
    const tetto = ordineVisibile.indexOf(maxScope);
    if (tetto < 0) return ordineVisibile;
    return ordineVisibile.slice(0, tetto + 1);
  }, [maxScope, ordineVisibile]);

  const carica = useCallback(async () => {
    setCaricando(true);
    setErrore(null);
    try {
      const [cittaRes, copRes, svcRes, pubRes, proRes] = await Promise.all([
        supabase
          .from("cities")
          .select("*")
          .order("name"),
        supabase
          .from("professional_coverage")
          // select("*"): comuni_istat arriva con la 087, e finché non è
          // applicata nominarla qui farebbe fallire tutta la lettura.
          .select("*")
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
        // select("*"): comune_istat arriva con la 085 e finché non è applicata
        // non deve far fallire il caricamento della pagina.
        supabase
          .from("professionals")
          .select("*")
          .eq("id", professionalId)
          .maybeSingle(),
      ]);

      const listaCitta = (cittaRes.data ?? []) as CittaRow[];
      setCitta(listaCitta);

      // Le coordinate del comune non stanno in database: le sa l'elenco
      // ISTAT, che vive sul server. Se manca non succede niente — si torna
      // alla media dei quartieri, come prima.
      const istat = (proRes.data as { comune_istat?: string | null } | null)?.comune_istat;
      if (istat) {
        fetch(`/api/geo/comuni?istat=${encodeURIComponent(istat)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const c = d?.comune as
              | { nome: string; provincia: string; sigla: string; lat: number | null; lng: number | null }
              | undefined;
            if (c?.lat != null && c?.lng != null) {
              setBase({
                lat: c.lat,
                lng: c.lng,
                nome: c.nome,
                provincia: c.provincia,
                sigla: c.sigla,
              });
            }
          })
          .catch(() => null);
      }
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
        comuni_istat?: string[] | null;
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
        setComuniIstat(riga.comuni_istat ?? []);
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
        // select("*") e non l'elenco delle colonne: group_slug e
        // nome_ufficiale arrivano con la 084, e finché non è applicata
        // nominarle qui farebbe fallire la lettura invece di ignorarle.
        .select("*")
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

  // I COMUNI DELLA PROVINCIA. Quale provincia: quella della base dichiarata
  // all'iscrizione (085) e, se manca, quella della città di Bob scelta qui.
  // Un professionista di Monza deve trovarsi davanti i comuni della Brianza,
  // non quelli di Milano.
  useEffect(() => {
    const provincia = base?.provincia ?? cittaScelta?.province ?? null;
    if (!provincia) {
      setComuni([]);
      setSiglaProvincia(null);
      return;
    }
    let annullato = false;
    (async () => {
      // La tabella arriva con la 086: finché non è applicata si resta senza
      // comuni, e la pagina continua a funzionare com'era.
      const { data, error } = await supabase
        .from("comuni")
        .select("istat, nome, sigla, provincia, lat, lng")
        .eq("provincia", provincia)
        .order("nome");
      if (annullato) return;
      if (error) {
        setComuni([]);
        setSiglaProvincia(null);
        return;
      }
      const righe = (data ?? []) as ComuneRow[];
      setComuni(righe);
      setSiglaProvincia(base?.sigla ?? righe[0]?.sigla ?? null);
    })();
    return () => {
      annullato = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, cittaScelta]);

  // I comuni che NON si dichiarano come comune: quelli che sono città di Bob
  // con i propri quartieri, dove vale la griglia fine. È la stessa regola del
  // trigger della 087 — qui serve perché l'anteprima mentre si trascina il
  // cerchio dica la verità, e il conto che vale lo rifà comunque il database.
  const comuniEsclusi = useMemo(() => {
    const istat = (cittaScelta as { comune_istat?: string | null } | null)?.comune_istat;
    return zone.length > 0 && istat ? [istat] : [];
  }, [cittaScelta, zone.length]);

  // Primo centro, in ordine: il comune dichiarato all'iscrizione, e solo se
  // manca la media dei quartieri. Chi sta a Sesto San Giovanni apriva la mappa
  // sul Duomo e doveva trascinare il perno ogni volta: il dato per non
  // chiederglielo ce l'abbiamo già.
  useEffect(() => {
    if (centro) return;
    if (base) {
      setCentro({ lat: base.lat, lng: base.lng });
      return;
    }
    if (zone.length === 0) return;
    const validi = zone.filter((z) => z.lat !== null && z.lng !== null);
    if (validi.length === 0) return;
    setCentro({
      lat: validi.reduce((s, z) => s + (z.lat as number), 0) / validi.length,
      lng: validi.reduce((s, z) => s + (z.lng as number), 0) / validi.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, base]);

  // In modo cerchio le zone le decide il cerchio: anteprima, poi il database.
  useEffect(() => {
    if (modo !== "circle" || !centro) return;
    setZoneSlugs(zoneNelCerchio(zone, centro, raggioM));
    setComuniIstat(comuniNelCerchio(comuni, centro, raggioM, comuniEsclusi));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, centro, raggioM, zone, comuni, comuniEsclusi]);

  // Ottantotto caselle in fila sono un muro di testo: si raggruppano sotto i
  // nomi corti di prima — quelli che il database porta in `group_slug` — e si
  // filtrano scrivendo, così chi cerca «Trenno» lo trova senza sapere in che
  // gruppo sia finito. L'etichetta del gruppo si ricava dalla slug invece di
  // leggere src/lib/zones.ts: quel file serve il percorso del cliente ed è
  // area di André, e qui non serve dipenderne.
  const gruppiZone = useMemo(() => {
    const cerca = filtroZona.trim().toLowerCase();
    const visibili = cerca
      ? zone.filter(
          (z) =>
            z.label.toLowerCase().includes(cerca) ||
            z.slug.includes(cerca) ||
            (z.nome_ufficiale ?? "").toLowerCase().includes(cerca)
        )
      : zone;
    return raggruppa(visibili);
  }, [zone, filtroZona]);

  // Lo stesso raggruppamento SENZA il filtro: la tendina della prova qui sotto
  // non deve restringersi perché uno sta cercando una casella da accendere.
  const gruppiTutti = useMemo(() => raggruppa(zone), [zone]);

  // Un gruppo si accende o si spegne tutto insieme: «lavoro ai Navigli» non
  // deve costare tre clic su tre nuclei che il cliente chiama con un nome solo.
  function toccaGruppo(slugs: string[]) {
    setSalvato(false);
    setModo("zones");
    setZoneSlugs((prec) => {
      const tutte = slugs.every((s) => prec.includes(s));
      return tutte
        ? prec.filter((s) => !slugs.includes(s))
        : [...new Set([...prec, ...slugs])].sort();
    });
  }

  // Un comune si accende cliccandolo sulla mappa o nella sua pastiglia: sono
  // lo stesso gesto, e il primo è quello che una persona prova per istinto.
  function toccaComune(istat: string) {
    if (comuniEsclusi.includes(istat)) return;
    setSalvato(false);
    setModo("zones");
    setComuniIstat((prec) =>
      prec.includes(istat) ? prec.filter((i) => i !== istat) : [...prec, istat].sort()
    );
  }

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
      const perZone = scope === "zones" || scope === "comuni";
      const payload = {
        professional_id: professionalId,
        scope,
        city_id: scope === "national" ? null : cityId,
        mode: perZone ? modo : "zones",
        zone_slugs: perZone ? zoneSlugs : [],
        comuni_istat: perZone ? comuniIstat : [],
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
      <p className="flex items-center gap-2 text-sm text-bob-ink/65">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carico la mappa…
      </p>
    );
  }

  const perZone = scope === "zones" || scope === "comuni";

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
          {maxScope && scopeAmmessi.length < ordineVisibile.length && (
            <p className="mt-1 text-xs text-bob-ink/65">
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
            comuni={comuni}
            comuniSelezionati={comuniIstat}
            siglaProvincia={siglaProvincia}
            onComune={toccaComune}
            // In modo cerchio il bersaglio è la mappa (si sposta il centro);
            // in modo manuale sono le aree, che si accendono cliccandole.
            formeCliccabili={modo !== "circle"}
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
            <p className="mt-1 text-xs text-bob-ink/65">
              {modo === "circle"
                ? "Trascina il perno o clicca sulla mappa per spostare il centro. Tocca un'area per sceglierla a mano."
                : "Stai scegliendo a mano: clicca le aree sulla mappa per accenderle e spegnerle. Il cerchio non comanda più."}
            </p>
          </div>

          {scope === "comuni" ? (
            <div data-testid="chip-comuni" className="space-y-3">
              {comuni.length > 8 && (
                <input
                  type="search"
                  value={filtroZona}
                  onChange={(e) => setFiltroZona(e.target.value)}
                  placeholder="Cerca un comune…"
                  aria-label="Cerca un comune"
                  className="w-full rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-bob-indigo"
                />
              )}

              <div className="flex flex-wrap gap-1.5">
                {comuni
                  .filter((c) => {
                    const cerca = filtroZona.trim().toLowerCase();
                    return !cerca || c.nome.toLowerCase().includes(cerca);
                  })
                  .map((c) => {
                    const dentro = comuniIstat.includes(c.istat);
                    const escluso = comuniEsclusi.includes(c.istat);
                    return (
                      <button
                        key={c.istat}
                        type="button"
                        onClick={() => toccaComune(c.istat)}
                        disabled={escluso}
                        aria-pressed={dentro}
                        title={
                          escluso
                            ? `${c.nome}: qui si copre a quartieri, non a comuni`
                            : c.nome
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          escluso
                            ? "cursor-not-allowed border-dashed border-black/15 text-bob-ink/35"
                            : dentro
                              ? "border-bob-indigo bg-bob-indigo/10 text-bob-indigo"
                              : "border-black/10 text-bob-ink/70 hover:border-black/30"
                        }`}
                      >
                        {c.nome}
                      </button>
                    );
                  })}
              </div>

              {comuni.length === 0 && (
                <p className="text-sm text-bob-ink/65">
                  Per questa provincia non ho ancora l&apos;elenco dei comuni.
                </p>
              )}
            </div>
          ) : (
          <div data-testid="chip-zone" className="space-y-3">
            {zone.length > 8 && (
              <input
                type="search"
                value={filtroZona}
                onChange={(e) => setFiltroZona(e.target.value)}
                placeholder="Cerca un quartiere…"
                aria-label="Cerca un quartiere"
                className="w-full rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-bob-indigo"
              />
            )}

            {gruppiZone.map((g) => {
              const slugs = g.zone.map((z) => z.slug);
              const tutte = slugs.every((s) => zoneSlugs.includes(s));
              return (
                <div key={g.chiave}>
                  {g.zone.length > 1 && (
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-bob-ink/45">
                        {g.etichetta}
                      </span>
                      <button
                        type="button"
                        onClick={() => toccaGruppo(slugs)}
                        className="text-[11px] text-bob-indigo hover:underline"
                      >
                        {tutte ? "togli tutta la zona" : "tutta la zona"}
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {g.zone.map((z) => {
                      const dentro = zoneSlugs.includes(z.slug);
                      return (
                        <button
                          key={z.slug}
                          type="button"
                          onClick={() => toccaZona(z.slug)}
                          aria-pressed={dentro}
                          title={z.nome_ufficiale ?? z.label}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                            dentro
                              ? "border-bob-indigo bg-bob-indigo/10 text-bob-indigo"
                              : "border-black/10 text-bob-ink/70 hover:border-black/30"
                          }`}
                        >
                          {z.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {zone.length > 0 && gruppiZone.length === 0 && (
              <p className="text-sm text-bob-ink/65">
                Nessun quartiere con questo nome.
              </p>
            )}

            {zone.length === 0 && (
              <p className="text-sm text-bob-ink/65">
                Per questa città non abbiamo ancora i quartieri: intanto puoi
                scegliere un&apos;area più larga qui sopra.
              </p>
            )}

            {/* QUELLO CHE IL CERCHIO PRENDE FUORI CITTÀ, detto e non nascosto.
                Il cerchio non si ferma al confine comunale: se sconfina, quei
                comuni finiscono davvero nella tua area (087) e il
                professionista ha diritto di vederlo scritto, non di scoprirlo
                dalle richieste che arrivano. */}
            {comuniIstat.length > 0 && (
              <p className="text-xs text-bob-ink/65">
                Fuori città il cerchio prende anche{" "}
                <span className="font-medium">
                  {comuniIstat.length === 1 ? "1 comune" : `${comuniIstat.length} comuni`}
                </span>
                : {comuni
                  .filter((c) => comuniIstat.includes(c.istat))
                  .slice(0, 4)
                  .map((c) => c.nome)
                  .join(", ")}
                {comuniIstat.length > 4 ? "…" : ""}
              </p>
            )}
          </div>
          )}
        </>
      ) : (
        <div className="card flex items-start gap-3 p-4">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-bob-ink/65" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-bob-ink">
              {SCOPE_LABEL[scope]}
              {scope !== "national" && cittaScelta ? ` — ${cittaScelta.name}` : ""}
            </p>
            <p className="mt-1 text-sm text-bob-ink/70">
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

      {/* LA PROVA. Prima si chiamava «Provalo» e rispondeva «non ti trova»
          senza dire di cosa parlasse: due parole che non spiegano né la
          domanda né cosa farci. Ora è scritta come la domanda che il
          professionista si fa davvero — un cliente di lì mi trova? — e quando
          la risposta è no dice anche perché e dove si sistema. Il confronto
          resta quello vero: trovaPerRichiesta è la stessa funzione che filtra
          gli elenchi, comprese le sue regole di compatibilità. */}
      {gettoni.length > 0 && cittaScelta && (
        <div className="card p-4">
          <h4 className="text-sm font-semibold text-bob-ink">
            Un cliente ti trova?
          </h4>
          <p className="mt-1 text-xs text-bob-ink/65">
            Scegli da dove arriva la richiesta. La risposta la calcola lo stesso
            confronto che fa la ricerca vera — la tua area pubblicata contro
            quella della richiesta — non una simulazione scritta a parte.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-sm text-bob-ink/70" htmlFor="cop-prova">
              Se la richiesta arriva da
            </label>
            <select
              id="cop-prova"
              value={zonaProva}
              onChange={(e) => setZonaProva(e.target.value)}
              className="input-bob w-auto"
              data-testid="select-prova-zona"
            >
              <option value="">
                {zone.length > 0
                  ? `${cittaScelta.name}, senza quartiere`
                  : cittaScelta.name}
              </option>
              {gruppiTutti.map((g) =>
                g.zone.length > 1 ? (
                  <optgroup key={g.chiave} label={g.etichetta}>
                    {g.zone.map((z) => (
                      <option key={z.slug} value={z.slug}>
                        {z.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  g.zone.map((z) => (
                    <option key={z.slug} value={z.slug}>
                      {z.label}
                    </option>
                  ))
                )
              )}
            </select>
            {(() => {
              const attesi = gettoniRichiesta(cittaScelta, zonaProva || null);
              const trovato = trovaPerRichiesta(
                { keys: gettoni, citySlug: cittaScelta.slug },
                attesi,
                cittaScelta.slug
              );
              return (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    trovato
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                  data-testid="esito-prova"
                >
                  {trovato ? "ti trova" : "non ti trova"}
                </span>
              );
            })()}
          </div>
          {(() => {
            const attesi = gettoniRichiesta(cittaScelta, zonaProva || null);
            const trovato = trovaPerRichiesta(
              { keys: gettoni, citySlug: cittaScelta.slug },
              attesi,
              cittaScelta.slug
            );
            const nome = zone.find((z) => z.slug === zonaProva)?.label ?? null;
            let spiegazione: string;
            if (trovato && nome) {
              spiegazione = `${nome} è tra le zone che copri.`;
            } else if (trovato) {
              spiegazione = `Chi non dice il quartiere ti trova lo stesso: hai dichiarato delle zone di ${cittaScelta.name}.`;
            } else if (nome) {
              spiegazione = `${nome} non è tra le zone che copri: toccala sulla mappa, o allarga il raggio finché non ci entra.`;
            } else {
              spiegazione = `Una richiesta da ${cittaScelta.name} non ti raggiunge: la tua area pubblicata è altrove.`;
            }
            return (
              <p
                className="mt-2 text-xs text-bob-ink/65"
                data-testid="spiegazione-prova"
              >
                {spiegazione}
              </p>
            );
          })()}
        </div>
      )}

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
        <p className="text-xs text-bob-ink/65">
          Come ti vede la ricerca: {gettoni.length}{" "}
          {gettoni.length === 1 ? "area pubblicata" : "aree pubblicate"}. Il
          centro del cerchio e il raggio non escono da qui.
        </p>
      )}
    </div>
  );
}
