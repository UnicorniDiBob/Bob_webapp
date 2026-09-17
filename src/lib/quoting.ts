// Il risolutore della scala di preventivabilita' (spec §2, §2.1). Pura
// funzione dei suoi input — nessuna chiamata a Supabase, nessun I/O — cosi'
// la Fase 3 puo' passargli quello che ha gia' in mano (il default del
// catalogo, il brief, lo scope raccolto) e la Fase 4 puo' usare lo stesso
// codice lato client per mostrare l'anteprima prima di inviare.
//
// LA SCALA PUO' SOLO SCENDERE. Un default 'range' puo' diventare 'survey'
// per una regola di aggravamento, mai 'bookable'. Ogni regola qui sotto e'
// scritta come "abbassa se", mai come "alza se" — non esiste un ramo che
// alzi il livello, per costruzione.
//
// IL PRE-CHECK EMERGENZA VIENE PRIMA DI TUTTO E BYPASSA LA SCALA. red_flags
// con danno_in_corso o rischio_sicurezza, o urgency 'emergenza', non
// producono un quote_level piu' basso: producono 'dispatch', che non fa
// nemmeno parte della scala del catalogo (subservices.quote_level non lo
// contempla, vedi 082) — e' un bypass, non un livello.
export type QuoteLevel = "bookable" | "range" | "assisted" | "survey";
export type QuoteMode = QuoteLevel | "dispatch";

// Ordine della scala, dal piu' capace al piu' prudente. Usato per "solo
// scendere": una regola non puo' mai far arretrare questo indice.
const LADDER: QuoteLevel[] = ["bookable", "range", "assisted", "survey"];

function levelIndex(level: QuoteLevel): number {
  return LADDER.indexOf(level);
}

// Il piu' prudente fra i due, mai il contrario.
function atLeastAsCautiousAs(current: QuoteLevel, floor: QuoteLevel): QuoteLevel {
  return levelIndex(current) >= levelIndex(floor) ? current : floor;
}

function oneLevelDown(level: QuoteLevel): QuoteLevel {
  const idx = Math.min(levelIndex(level) + 1, LADDER.length - 1);
  return LADDER[idx];
}

// I due red_flags che il pre-check emergenza riconosce (spec §2).
const EMERGENCY_RED_FLAGS = new Set(["danno_in_corso", "rischio_sicurezza"]);

// Sotto-servizi il cui livello e' 'survey' a prescindere (spec §2.1,
// colonna "always"): la semina 083 li ha gia' messi a 'survey' di default,
// quindi qui e' ridondante nel caso comune — ma resta l'unica fonte di
// verita' per QUESTA regola, non un'assunzione sul contenuto del catalogo.
// Se un domani il default cambiasse nel catalogo, questa lista lo terrebbe
// comunque fermo a 'survey'.
const ALWAYS_SURVEY_SUBTASKS = new Set([
  "tinteggiatura-esterni-facciata",
  "perdita-tubatura-infiltrazione",
  "corto-salvavita-scatta",
  "quadro-elettrico",
  "impianto-nuovo-rifacimento",
  "messa-a-norma-certificazione",
  "rifacimento-impianto-bagno",
]);

export interface QuoteResolverInput {
  /** Slug del sotto-servizio scelto (job_briefs.subtask_slug / requests). */
  subtaskSlug: string;
  /** subservices.quote_level per questo slug — il default del catalogo. */
  defaultQuoteLevel: QuoteLevel;

  /** job_briefs.red_flags. */
  redFlags?: string[] | null;
  /** job_briefs.urgency / requests.urgency. */
  urgency?: string | null;

  // --- tinteggiatura-interni ---
  /** scope.mold_present. */
  moldPresent?: boolean | null;
  /** scope.mq_approx e' stato dichiarato (numero o proxy risolto)? */
  mqApproxKnown?: boolean;
  /** C'e' almeno una foto a corredo della richiesta? */
  hasPhoto?: boolean;

  // --- caldaia-scaldabagno ---
  /** scope.intervento. */
  intervento?: string | null;
  /** scope.boiler_model e' stato dichiarato? */
  boilerModelKnown?: boolean;

  // --- regola trasversale: locali commerciali senza quantita' ---
  /** job_briefs.property_type. */
  propertyType?: string | null;
  /** Il campo is_billable_unit del sotto-servizio e' stato dichiarato? */
  quantityKnown?: boolean;

  // --- regola trasversale: vincoli edilizi ---
  /** Ponteggio, demolizione o materiali d'epoca (amianto) necessari. */
  buildingConstraint?: boolean;
}

/**
 * Il pre-check emergenza (spec §2): se scatta, il resto della scala non
 * viene nemmeno valutato.
 */
function isEmergency(input: QuoteResolverInput): boolean {
  const redFlags = input.redFlags ?? [];
  return (
    redFlags.some((f) => EMERGENCY_RED_FLAGS.has(f)) || input.urgency === "emergenza"
  );
}

/**
 * Applica le regole di aggravamento (spec §2.1) al default del catalogo.
 * Non applica il pre-check emergenza (vedi resolveQuoteMode) e non applica
 * il degrado di 'bookable' — quello e' un vincolo infrastrutturale, non una
 * regola sui dati, ed e' l'ultimo passo di resolveQuoteMode.
 */
export function resolveQuoteLevel(input: QuoteResolverInput): QuoteLevel {
  let level = input.defaultQuoteLevel;

  if (input.subtaskSlug === "tinteggiatura-interni") {
    if (input.moldPresent) {
      level = atLeastAsCautiousAs(level, "survey");
    }
    if (input.mqApproxKnown === false && !input.hasPhoto) {
      level = atLeastAsCautiousAs(level, "survey");
    }
  }

  if (ALWAYS_SURVEY_SUBTASKS.has(input.subtaskSlug)) {
    level = atLeastAsCautiousAs(level, "survey");
  }

  if (
    input.subtaskSlug === "caldaia-scaldabagno" &&
    input.intervento === "sostituzione" &&
    input.boilerModelKnown === false
  ) {
    level = atLeastAsCautiousAs(level, "survey");
  }

  if (input.propertyType === "ufficio_commerciale" && input.quantityKnown === false) {
    level = oneLevelDown(level);
  }

  if (input.buildingConstraint) {
    level = atLeastAsCautiousAs(level, "survey");
  }

  return level;
}

/**
 * Il risolutore completo: pre-check emergenza, poi la scala, poi il degrado
 * infrastrutturale di 'bookable'.
 *
 * 'BOOKABLE' DEGRADA SEMPRE A 'RANGE' (spec §2). La prenotazione diretta e'
 * rotta in quattro punti in produzione (C16): niente puo' dipendere dal
 * fatto che funzioni. La colonna subservices.quote_level continua a
 * dichiarare 'bookable' — e' la verita' del catalogo — ma questo risolutore
 * non lo restituisce mai finche' INSTANT_BOOKING_AVAILABLE resta false.
 * Il degrado viene DOPO le regole di aggravamento, non prima: una regola
 * dati (es. locale commerciale senza quantita') deve ragionare sulla vera
 * posizione del catalogo nella scala, non su una gia' abbassata per un
 * motivo che non ha niente a che fare con quel lavoro specifico.
 */
export const INSTANT_BOOKING_AVAILABLE = false;

export function resolveQuoteMode(input: QuoteResolverInput): QuoteMode {
  if (isEmergency(input)) {
    return "dispatch";
  }

  let level = resolveQuoteLevel(input);
  if (level === "bookable" && !INSTANT_BOOKING_AVAILABLE) {
    level = "range";
  }
  return level;
}
