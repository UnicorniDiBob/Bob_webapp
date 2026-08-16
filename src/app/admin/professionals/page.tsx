// Pagina admin: verifica dei professionisti.
// Mostra i professionisti raggruppati per stato di verifica.
// Admin e CS possono approvare (verified), mettere in attesa (pending) o rifiutare (unverified).

import { createClient } from "@/lib/supabase/server";
import { Wrench, MapPin, Euro, Phone, Calendar, Clock } from "lucide-react";
import { VerifyButtons } from "./VerifyButtons";
import { TierButtons } from "./TierButtons";
import { VatReviewActions } from "./VatReviewActions";
import {
  namesMatch,
  procedureFlagInName,
  VERIFICATION_LABEL,
  type VerificationLevel,
  type VatReviewState,
} from "@/lib/vat";
import type { VerificationEvent } from "@/lib/supabase/types";

export const revalidate = 0; // sempre aggiornato

type VerificationStatus = "unverified" | "pending" | "verified";
type SubscriptionTier = "free" | "pro" | "business";

// Documento di verifica come lo consuma la coda: link firmato già risolto.
interface AdminDoc {
  file_name: string;
  status: string;
  uploaded_at: string;
  url: string | null;
}

interface VerificationRow {
  professional_id: string;
  level: VerificationLevel;
  vat_number: string | null;
  vat_active: boolean | null;
  vat_holder_name: string | null;
  vat_checked_at: string | null;
  vat_check_source: string | null;
  vat_review_state: VatReviewState | null;
  vat_review_note: string | null;
  vat_reviewed_at: string | null;
  vat_reviewed_by_name: string | null;
  declared_business_name: string | null;
  vat_match_source: string | null;
  updated_at: string;
}

// Etichette leggibili del registro: chi lo consulta non deve conoscere i nomi
// tecnici degli eventi per capire cosa è successo.
const EVENT_LABEL: Record<VerificationEvent["event"], string> = {
  vat_submitted: "Partita IVA comunicata",
  vat_check_ok: "Controllo automatico superato",
  vat_check_failed: "Controllo automatico non superato",
  documents_submitted: "Documenti ricevuti",
  documents_requested: "Documenti richiesti",
  vat_rejected: "Richiesta respinta",
  level_granted: "Livello concesso",
  level_revoked: "Livello revocato",
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

// Una riga del registro: cosa, quando, per mano di chi.
function EventRow({ e, proName }: { e: VerificationEvent; proName?: string }) {
  return (
    <li className="border-l-2 border-black/5 py-1.5 pl-3 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold text-bob-ink/80">{EVENT_LABEL[e.event]}</span>
        {proName && <span className="text-bob-ink/50">· {proName}</span>}
        <span className="text-bob-ink/40">{fmtDateTime(e.created_at)}</span>
      </div>
      <div className="mt-0.5 text-bob-ink/55">
        {e.actor_name ? (
          <>
            Firmato da <span className="font-medium text-bob-ink/75">{e.actor_name}</span>
            {e.actor_role ? ` (${e.actor_role})` : ""}
          </>
        ) : (
          "Autore non registrato (evento precedente alla firma)"
        )}
        {e.from_level && e.to_level ? ` · ${e.from_level} → ${e.to_level}` : ""}
      </div>
      {e.note && <p className="mt-0.5 text-bob-ink/60">{e.note}</p>}
    </li>
  );
}

const REVIEW_LABEL: Record<VatReviewState, string> = {
  pending: "Da esaminare",
  docs_requested: "Documenti richiesti",
  rejected: "Respinto",
};

const REVIEW_BADGE: Record<VatReviewState, string> = {
  pending: "bg-amber-50 text-amber-700",
  docs_requested: "bg-bob-indigo-50 text-bob-indigo",
  rejected: "bg-red-50 text-red-700",
};

interface ProRow {
  id: string;
  verification_status: VerificationStatus;
  subscription_tier: SubscriptionTier;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  created_at: string | null;
  user_id: string;
  cities: { name: string } | null;
  professional_services: {
    services: { name: string } | null;
    min_price: number | null;
    max_price: number | null;
  }[];
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  // Fuso esplicito: la pagina rende sul server (UTC su Vercel) e la data di un
  // controllo non deve cambiare giorno rispetto a quella che vede il pro.
  return new Date(d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
}

const STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; badge: string; description: string }
> = {
  unverified: {
    label: "Non verificati",
    badge: "bg-red-50 text-red-700",
    description: "Nuovi iscritti che non sono ancora stati esaminati.",
  },
  pending: {
    label: "In revisione",
    badge: "bg-amber-50 text-amber-700",
    description: "Profili in corso di verifica.",
  },
  verified: {
    label: "Verificati",
    badge: "bg-emerald-50 text-emerald-700",
    description: "Profili approvati e visibili ai clienti.",
  },
};

export default async function AdminProfessionalsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("professionals")
    .select(`
      id,
      user_id,
      verification_status,
      subscription_tier,
      headline,
      bio,
      years_experience,
      created_at,
      cities ( name ),
      professional_services ( min_price, max_price, services ( name ) )
    `)
    .order("created_at", { ascending: false });

  const pros = (data ?? []) as unknown as ProRow[];

  // Recupera i nomi dai profili
  const userIds = pros.map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", userIds);

  // Telefono in profile_phone dalla 051 — non piu' in profiles (vedi nota
  // in admin/users/page.tsx per il perche'). Unito qui in profileMap cosi'
  // tutti gli usi sotto (profileMap[x]?.phone) restano invariati.
  const { data: phones } = await supabase
    .from("profile_phone")
    .select("user_id, phone")
    .in("user_id", userIds);
  const phoneMap = Object.fromEntries(
    ((phones ?? []) as { user_id: string; phone: string | null }[]).map((p) => [p.user_id, p.phone])
  );

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.user_id, { ...p, phone: phoneMap[p.user_id] ?? null }])
  );

  // Coda delle verifiche P.IVA: i casi con un esame umano aperto o appena
  // chiuso (migration 034). La lettura passa dalla policy "Staff reads
  // verification": qui il numero di partita IVA lo vediamo, i clienti mai.
  // Prendiamo anche i livelli già concessi: una concessione automatica
  // sbagliata deve potersi correggere da qui, non solo via SQL.
  const { data: reviewData } = await supabase
    .from("professional_verification")
    .select(
      "professional_id, level, vat_number, vat_active, vat_holder_name, vat_checked_at, vat_check_source, vat_review_state, vat_review_note, vat_reviewed_at, vat_reviewed_by_name, declared_business_name, vat_match_source, updated_at"
    )
    .or("vat_review_state.not.is.null,level.neq.none")
    .order("updated_at", { ascending: false });

  const reviewRows = (reviewData ?? []) as unknown as VerificationRow[];
  const proById = Object.fromEntries(pros.map((p) => [p.id, p]));

  // Il registro delle verifiche, letto in due modi diversi perché servono a
  // due cose diverse.
  //
  // 1) Lo storico DEL CASO che ho davanti: deve essere completo, sempre. Prima
  //    lo ricavavo dai 200 movimenti più recenti di tutti, e per un caso vecchio
  //    la cronologia risultava vuota pur esistendo: una cronologia che a volte
  //    mente è peggio di nessuna cronologia. Ora si chiede per i professionisti
  //    effettivamente mostrati in pagina.
  const idsInPagina = reviewRows.map((r) => r.professional_id);
  const { data: eventsPerCaso } = idsInPagina.length
    ? await supabase
        .from("verification_events")
        .select(
          "id, professional_id, event, from_level, to_level, note, actor_name, actor_role, created_at"
        )
        .in("professional_id", idsInPagina)
        .order("created_at", { ascending: false })
    : { data: [] };

  const eventsByPro = new Map<string, VerificationEvent[]>();
  for (const e of (eventsPerCaso ?? []) as unknown as VerificationEvent[]) {
    const list = eventsByPro.get(e.professional_id) ?? [];
    list.push(e);
    eventsByPro.set(e.professional_id, list);
  }

  // Documenti caricati dai professionisti in coda (10.2, mig 052): il pro
  // carica dal suo profilo nel bucket privato, qui si aprono con link firmati
  // a scadenza (1h) — mai URL permanenti su documenti d'identità.
  const { data: docsData } = idsInPagina.length
    ? await supabase
        .from("verification_documents")
        .select("professional_id, file_name, storage_path, status, uploaded_at")
        .in("professional_id", idsInPagina)
        .order("uploaded_at", { ascending: false })
    : { data: [] };
  const docsByPro = new Map<string, AdminDoc[]>();
  for (const d of (docsData ?? []) as unknown as {
    professional_id: string;
    file_name: string;
    storage_path: string;
    status: string;
    uploaded_at: string;
  }[]) {
    const { data: signed } = await supabase.storage
      .from("verifica-documenti")
      .createSignedUrl(d.storage_path, 3600);
    const list = docsByPro.get(d.professional_id) ?? [];
    list.push({
      file_name: d.file_name,
      status: d.status,
      uploaded_at: d.uploaded_at,
      url: signed?.signedUrl ?? null,
    });
    docsByPro.set(d.professional_id, list);
  }

  // 2) La vista d'insieme "cosa è successo di recente", che serve a controllare
  //    il lavoro del team. Qui il taglio è dichiarato, non nascosto: crescendo,
  //    questa lista va sostituita da una pagina con filtri e ricerca (10.13).
  const REGISTRO_RECENTI = 100;
  const { data: eventsData, count: totaleMovimenti } = await supabase
    .from("verification_events")
    .select(
      "id, professional_id, event, from_level, to_level, note, actor_name, actor_role, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .limit(REGISTRO_RECENTI);

  const events = (eventsData ?? []) as unknown as VerificationEvent[];
  const nameByPro = new Map<string, string>();
  for (const p of pros) {
    nameByPro.set(p.id, profileMap[p.user_id]?.full_name ?? "Professionista");
  }

  // Da lavorare; già decisi (per rispondere a chi chiede "come mai?"); e
  // livelli attivi, dove l'azione utile è semmai la revoca motivata.
  const openCases = reviewRows.filter(
    (r) => r.vat_review_state === "pending" || r.vat_review_state === "docs_requested"
  );
  const closedCases = reviewRows.filter((r) => r.vat_review_state === "rejected");
  const grantedCases = reviewRows.filter(
    (r) => r.level !== "none" && r.vat_review_state === null
  );

  // Raggruppa per stato
  const grouped: Record<VerificationStatus, ProRow[]> = {
    unverified: [],
    pending: [],
    verified: [],
  };
  for (const p of pros) {
    grouped[p.verification_status].push(p);
  }

  const order: VerificationStatus[] = ["unverified", "pending", "verified"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">
          Verifica professionisti
        </h1>
        <p className="mt-1 text-sm text-bob-ink/55">
          Esamina i profili e aggiorna il loro stato di verifica.
        </p>
      </div>

      {/* ---- Coda partita IVA (blocco 10, §5.3) ---- */}
      <section id="vat-queue" data-testid="vat-queue" className="scroll-mt-20">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-bob-ink">
            Coda partita IVA
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              openCases.length > 0
                ? "bg-amber-50 text-amber-700"
                : "bg-black/5 text-bob-ink/50"
            }`}
          >
            {openCases.length}
          </span>
        </div>
        <p className="mb-4 text-sm text-bob-ink/55">
          Casi che il controllo automatico non ha confermato. Non sono rifiuti:
          chi non lavora con l&apos;estero spesso non è iscritto al VIES, quindi
          decide una persona. La motivazione che scrivi la legge il
          professionista.
        </p>

        {openCases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 py-8 text-center text-sm text-bob-ink/40">
            Nessun caso da esaminare.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {openCases.map((row) => (
              <VatCaseCard
                key={row.professional_id}
                row={row}
                pro={proById[row.professional_id]}
                profile={
                  proById[row.professional_id]
                    ? profileMap[proById[row.professional_id].user_id]
                    : undefined
                }
                storico={eventsByPro.get(row.professional_id) ?? []}
                documenti={docsByPro.get(row.professional_id) ?? []}
              />
            ))}
          </div>
        )}

        {grantedCases.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-bob-ink/60 hover:text-bob-indigo">
              Livelli attivi ({grantedCases.length}) — da qui si revoca, con
              motivazione
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {grantedCases.map((row) => (
                <VatCaseCard
                  key={row.professional_id}
                  row={row}
                  pro={proById[row.professional_id]}
                  profile={
                    proById[row.professional_id]
                      ? profileMap[proById[row.professional_id].user_id]
                      : undefined
                  }
                  storico={eventsByPro.get(row.professional_id) ?? []}
                documenti={docsByPro.get(row.professional_id) ?? []}
                />
              ))}
            </div>
          </details>
        )}

        {closedCases.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-bob-ink/60 hover:text-bob-indigo">
              Casi respinti ({closedCases.length})
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {closedCases.map((row) => (
                <VatCaseCard
                  key={row.professional_id}
                  row={row}
                  pro={proById[row.professional_id]}
                  profile={
                    proById[row.professional_id]
                      ? profileMap[proById[row.professional_id].user_id]
                      : undefined
                  }
                  storico={eventsByPro.get(row.professional_id) ?? []}
                documenti={docsByPro.get(row.professional_id) ?? []}
                />
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Registro completo: chiuso di default, ma sempre qui sotto. */}
      {events.length > 0 && (
        <details className="mt-4" data-testid="vat-registro">
          <summary className="cursor-pointer text-sm font-medium text-bob-ink/60 hover:text-bob-indigo">
            Registro delle verifiche — ultimi {events.length} movimenti
            {typeof totaleMovimenti === "number" && totaleMovimenti > events.length
              ? ` su ${totaleMovimenti}`
              : ""}
            , con la firma di chi li ha fatti
          </summary>
          <p className="mt-2 text-xs text-bob-ink/45">
            Si scrive solo in aggiunta: nessuna riga può essere modificata o
            cancellata, nemmeno da un amministratore. È quello che lo rende una
            prova di cosa è stato fatto e da chi. Lo vedono tutti gli account
            admin e customer service; il professionista vede solo le righe che
            riguardano lui. Qui sotto ci sono i movimenti più recenti: la
            cronologia completa di un singolo caso sta nella sua scheda.
          </p>
          <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto pr-2">
            {events.map((e) => (
              <EventRow
                key={e.id}
                e={e}
                proName={nameByPro.get(e.professional_id)}
              />
            ))}
          </ul>
        </details>
      )}

      {order.map((status) => {
        const list = grouped[status];
        const config = STATUS_CONFIG[status];
        return (
          <section key={status}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-bob-ink">
                {config.label}
              </h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.badge}`}>
                {list.length}
              </span>
            </div>
            <p className="mb-4 text-sm text-bob-ink/55">{config.description}</p>

            {list.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 py-8 text-center text-sm text-bob-ink/40">
                Nessun professionista in questa categoria.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {list.map((pro) => {
                  const profile = profileMap[pro.user_id];
                  const svc = pro.professional_services?.[0];
                  return (
                    <div
                      key={pro.id}
                      className="card p-5"
                      data-testid={`pro-row-${pro.id}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        {/* Info professionista */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-bob-ink">
                              {profile?.full_name ?? "Professionista"}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.badge}`}
                            >
                              {config.label}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-bob-ink/55">
                            {svc?.services?.name && (
                              <span className="inline-flex items-center gap-1">
                                <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                                {svc.services.name}
                              </span>
                            )}
                            {pro.cities?.name && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                {pro.cities.name}
                              </span>
                            )}
                            {pro.years_experience != null && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                {pro.years_experience} anni di esperienza
                              </span>
                            )}
                            {svc?.min_price != null && (
                              <span className="inline-flex items-center gap-1">
                                <Euro className="h-3.5 w-3.5" aria-hidden="true" />
                                da €{svc.min_price}
                                {svc.max_price ? ` a €${svc.max_price}` : ""}
                              </span>
                            )}
                            {profile?.phone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                                {profile.phone}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                              Iscritto {fmtDate(pro.created_at)}
                            </span>
                          </div>

                          {pro.headline && (
                            <p className="mt-2 text-sm text-bob-ink/75">
                              {pro.headline}
                            </p>
                          )}
                          {pro.bio && (
                            <p className="mt-1 line-clamp-2 text-xs text-bob-ink/50">
                              {pro.bio}
                            </p>
                          )}
                        </div>

                        {/* Bottoni azione */}
                        <div className="flex shrink-0 flex-col items-end gap-2.5">
                          <VerifyButtons
                            proId={pro.id}
                            currentStatus={pro.verification_status}
                          />
                          <TierButtons
                            proId={pro.id}
                            currentTier={pro.subscription_tier ?? "free"}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Riepilogo del caso in testo semplice: si incolla in una mail al
// professionista, in un appunto o in una chat col resto del team senza dover
// ricopiare a mano dei dati che, se ricopiati male, portano a decidere su un
// numero sbagliato.
function schedaDelCaso(
  row: VerificationRow,
  name: string,
  pro: ProRow | undefined,
  profile: { full_name: string | null; phone: string | null } | undefined
): string {
  const svc = pro?.professional_services?.[0]?.services?.name;
  const righe = [
    `Verifica P.IVA — ${name}`,
    `Partita IVA dichiarata: ${row.vat_number ?? "—"}`,
    `Intestazione dal registro: ${row.vat_holder_name ?? "non disponibile"}`,
    `Esito automatico: ${
      row.vat_active === true
        ? "confermata"
        : row.vat_check_source === "vies"
        ? "non confermata dal VIES"
        : "nessuna risposta"
    }`,
    `Ultimo controllo: ${fmtDate(row.vat_checked_at)}`,
    `Livello attuale: ${VERIFICATION_LABEL[row.level]}`,
    `Servizio e città: ${svc ?? "—"}${pro?.cities?.name ? `, ${pro.cities.name}` : ""}`,
    profile?.phone ? `Telefono: ${profile.phone}` : null,
    `Profilo: /professionisti/${row.professional_id}`,
  ];
  return righe.filter(Boolean).join("\n");
}

// ---- Un caso della coda P.IVA ----
// Mostra tutto quello che serve per decidere senza aprire altre schede: cosa
// ha dichiarato il professionista, cosa ha risposto il VIES e se la
// denominazione combacia col nome del profilo. La discordanza è un segnale,
// non un verdetto: le ditte individuali risultano col nome della persona.
function VatCaseCard({
  row,
  pro,
  profile,
  storico = [],
  documenti = [],
}: {
  row: VerificationRow;
  pro: ProRow | undefined;
  profile: { full_name: string | null; phone: string | null } | undefined;
  /** Registro degli eventi di questo professionista, dal più recente. */
  storico?: VerificationEvent[];
  /** Documenti caricati dal pro (10.2), con link firmato a scadenza. */
  documenti?: AdminDoc[];
}) {
  const name = profile?.full_name ?? "Professionista";
  const state = row.vat_review_state;
  const svc = pro?.professional_services?.[0];
  const procedura = procedureFlagInName(row.vat_holder_name);
  const mismatch =
    profile?.full_name && row.vat_holder_name
      ? !namesMatch(profile.full_name, row.vat_holder_name)
      : false;

  return (
    <div className="card p-5" data-testid={`vat-case-${row.professional_id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-bob-ink">{name}</h3>
        {state && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${REVIEW_BADGE[state]}`}
          >
            {REVIEW_LABEL[state]}
          </span>
        )}
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-bob-ink/60">
          Livello attuale: {VERIFICATION_LABEL[row.level]}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-bob-ink/55">
        {svc?.services?.name && (
          <span className="inline-flex items-center gap-1">
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            {svc.services.name}
          </span>
        )}
        {pro?.cities?.name && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {pro.cities.name}
          </span>
        )}
        {profile?.phone && (
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {profile.phone}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          Ultimo controllo {fmtDate(row.vat_checked_at)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-bob-ink/50">Partita IVA dichiarata:</dt>
          <dd className="font-mono font-semibold text-bob-ink">
            {row.vat_number ?? "—"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-bob-ink/50">Esito automatico:</dt>
          <dd className="text-bob-ink">
            {row.vat_active === true
              ? "confermata"
              : row.vat_check_source === "vies"
              ? "non confermata dal VIES"
              : "nessuna risposta"}
          </dd>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <dt className="text-bob-ink/50">Intestazione dal registro:</dt>
          <dd className="text-bob-ink">{row.vat_holder_name ?? "non disponibile"}</dd>
        </div>
        {row.vat_match_source === "declared_name" && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="text-bob-ink/50">Attribuita in base a:</dt>
            <dd className="font-medium text-amber-700">
              ragione sociale dichiarata dal professionista — da ricontrollare a
              campione
            </dd>
          </div>
        )}
        {row.declared_business_name && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="text-bob-ink/50">Ragione sociale dichiarata:</dt>
            <dd className="text-bob-ink">{row.declared_business_name}</dd>
          </div>
        )}
      </dl>

      {procedura && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
          <span className="font-semibold">
            La denominazione segnala una procedura in corso: {procedura}.
          </span>{" "}
          Una società in liquidazione o in amministrazione straordinaria conserva
          la partita IVA attiva, quindi il riscontro fiscale qui non dice niente
          sulla sua operatività. Prima di concedere il livello guarda lo stato
          sul servizio dell&apos;Agenzia e valuta se può stare sul marketplace.
        </p>
      )}

      {row.vat_check_source === null && (
        <p className="mt-2 rounded-xl bg-bob-indigo-50 px-3 py-2 text-xs text-bob-indigo">
          <span className="font-semibold">Il controllo automatico non è stato
          eseguito</span> su questa partita IVA: il servizio europeo non ha
          risposto. Non è un esito — non concedere e non rifiutare sulla base di
          questo. Il ritentativo parte stanotte da solo; se hai fretta, apri il
          servizio dell&apos;Agenzia qui sotto e guarda tu.
        </p>
      )}

      {mismatch && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          L&apos;intestazione non somiglia al nome sul profilo ({name}). Può
          essere normale — ditta individuale, nome commerciale diverso — ma
          vale la pena guardarci prima di concedere il livello.
        </p>
      )}

      {row.vat_review_note && (
        <p className="mt-2 rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-bob-ink/70">
          <span className="font-semibold">Ultima motivazione</span>
          {row.vat_reviewed_at ? ` (${fmtDate(row.vat_reviewed_at)})` : ""}:{" "}
          {row.vat_review_note}
          {row.vat_reviewed_by_name && (
            <span className="mt-0.5 block text-bob-ink/50">
              Decisione firmata da{" "}
              <span className="font-medium text-bob-ink/75">
                {row.vat_reviewed_by_name}
              </span>
            </span>
          )}
        </p>
      )}

      {documenti.length > 0 && (
        <div className="mt-2 rounded-xl bg-bob-indigo-50/60 px-3 py-2">
          <p className="text-xs font-semibold text-bob-ink/70">
            Documenti caricati dal professionista ({documenti.length})
          </p>
          <ul className="mt-1 space-y-0.5">
            {documenti.map((d) => (
              <li key={d.file_name + d.uploaded_at} className="text-xs text-bob-ink/65">
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-bob-indigo hover:underline"
                  >
                    {d.file_name}
                  </a>
                ) : (
                  <span>{d.file_name}</span>
                )}{" "}
                · {fmtDateTime(d.uploaded_at)}
                {d.status !== "in_esame" && ` · ${d.status}`}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-bob-ink/40">
            I link scadono dopo un&apos;ora: sono firmati, non pubblici.
          </p>
        </div>
      )}

      {storico.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-bob-ink/50 hover:text-bob-indigo">
            Storico dei controlli ({storico.length}) — chi ha fatto cosa
          </summary>
          <ul className="mt-2 space-y-1">
            {storico.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </ul>
        </details>
      )}

      <VatReviewActions
        proId={row.professional_id}
        proName={name}
        hasLevel={row.level !== "none"}
        vatNumber={row.vat_number}
        holderName={row.vat_holder_name}
        scheda={schedaDelCaso(row, name, pro, profile)}
      />
    </div>
  );
}
