// Il risolutore della ricerca, lato applicazione.
//
// Un giro di rete e un oggetto: che cosa sta cercando questa persona, dove, e
// quanto ci si puo' fidare della risposta. Il lavoro vero lo fa
// public.search_resolve (migrazione 068), in SQL, per due motivi: il confronto
// per somiglianza usa l'indice a trigrammi che vive nel database, e la
// normalizzazione deve essere LA STESSA che ha scritto i termini in tabella.
// Due implementazioni della stessa regola sono due regole.

import { createClient } from "@/lib/supabase/server";

export type SearchMatchKind = "service" | "subservice";

/** Come ha fatto match, in ordine di fiducia. Lo decide la 068. */
export type SearchMatchHow = "esatto" | "contenuto" | "prefisso" | "somiglianza";

export interface SearchMatch {
  kind: SearchMatchKind;
  /** Slug del servizio: c'e' sempre, anche per un intervento. */
  service: string;
  /** Slug dell'intervento, null se il match e' sul mestiere. */
  subservice: string | null;
  /** Il nome ufficiale di catalogo, non il sinonimo che ha fatto match. */
  display: string;
  score: number;
  how: SearchMatchHow;
}

export interface SearchResolution {
  query: string;
  normalized: string | null;
  /** La frase senza il luogo: quello che resta da cercare nel catalogo. */
  what: string | null;
  citySlug: string | null;
  zoneSlug: string | null;
  /** Ha scritto «vicino a me»: e' un luogo, non un mestiere. */
  nearMe: boolean;
  /**
   * Gia' ordinati, e NON per punteggio: dalla 069 l'ordine e' per banda di
   * 0.05, e dentro la banda vince prima la corrispondenza esatta e poi
   * l'intervento sul mestiere. Percio' i punteggi che arrivano NON sono
   * monotoni — «pulizie fine locazione» torna Fine locazione o trasloco
   * (0.83) davanti a Pulizie (0.85), e quello e' il comportamento giusto.
   * Non riordinare questo array per score: rifarlo disfa la 069.
   */
  matches: SearchMatch[];
}

/**
 * Sopra questa soglia la risposta e' una risposta, e si puo' portare la persona
 * direttamente sui risultati. Sotto, e' un «forse cercavi» e l'interfaccia deve
 * dirlo: a 0.45 il risolutore, onestamente, non sa. La banda e' dichiarata
 * nella 068; sta anche qui perche' e' l'interfaccia a doverla rispettare.
 */
export const SOGLIA_CERTEZZA = 0.8;

export function isConfident(r: SearchResolution): boolean {
  return (r.matches[0]?.score ?? 0) >= SOGLIA_CERTEZZA;
}

/** Il match migliore, solo se ci si puo' contare. */
export function bestConfidentMatch(r: SearchResolution): SearchMatch | null {
  const first = r.matches[0];
  return first && first.score >= SOGLIA_CERTEZZA ? first : null;
}

function emptyResolution(query: string): SearchResolution {
  return {
    query,
    normalized: null,
    what: null,
    citySlug: null,
    zoneSlug: null,
    nearMe: false,
    matches: [],
  };
}

const HOW: readonly SearchMatchHow[] = [
  "esatto",
  "contenuto",
  "prefisso",
  "somiglianza",
];

// La forma che arriva dal database e' nota, ma si controlla comunque: una
// ricerca che risponde male non deve poter far cadere la pagina che la ospita.
function parseMatch(raw: unknown): SearchMatch | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const kind = m.kind === "subservice" ? "subservice" : m.kind === "service" ? "service" : null;
  const service = typeof m.service === "string" ? m.service : null;
  const display = typeof m.display === "string" ? m.display : null;
  const score = typeof m.score === "number" ? m.score : Number(m.score);
  if (!kind || !service || !display || !Number.isFinite(score)) return null;
  const how = HOW.find((h) => h === m.how) ?? "somiglianza";
  return {
    kind,
    service,
    subservice: typeof m.subservice === "string" ? m.subservice : null,
    display,
    score,
    how,
  };
}

function parseResolution(raw: unknown, query: string): SearchResolution {
  if (typeof raw !== "object" || raw === null) return emptyResolution(query);
  const r = raw as Record<string, unknown>;
  const matches = Array.isArray(r.matches)
    ? r.matches.map(parseMatch).filter((m): m is SearchMatch => m !== null)
    : [];
  return {
    query,
    normalized: typeof r.normalized === "string" ? r.normalized : null,
    what: typeof r.what === "string" ? r.what : null,
    citySlug: typeof r.city === "string" ? r.city : null,
    zoneSlug: typeof r.zone === "string" ? r.zone : null,
    nearMe: r.near_me === true,
    matches,
  };
}

/**
 * Da una frase battuta in una casella al catalogo.
 *
 * Non lancia: se il database non risponde si torna un risultato vuoto, e la
 * pagina resta sfogliabile con i filtri di prima. Una ricerca rotta deve
 * togliere la ricerca, non l'elenco.
 */
export async function resolveSearch(
  query: string,
  limit = 8
): Promise<SearchResolution> {
  const q = (query ?? "").trim();
  if (q.length === 0) return emptyResolution(q);

  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_resolve", {
    p_query: q,
    p_limit: limit,
  });

  if (error || data === null || data === undefined) return emptyResolution(q);
  return parseResolution(data, q);
}
