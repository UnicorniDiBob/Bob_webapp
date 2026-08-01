// Pagina admin: verifica dei professionisti.
// Mostra i professionisti raggruppati per stato di verifica.
// Admin e CS possono approvare (verified), mettere in attesa (pending) o rifiutare (unverified).

import { createClient } from "@/lib/supabase/server";
import { Wrench, MapPin, Euro, Phone, Calendar, Clock } from "lucide-react";
import { VerifyButtons } from "./VerifyButtons";
import { TierButtons } from "./TierButtons";
import { VatReviewActions } from "./VatReviewActions";
import {
  nameLooksConsistent,
  VERIFICATION_LABEL,
  type VerificationLevel,
  type VatReviewState,
} from "@/lib/vat";

export const revalidate = 0; // sempre aggiornato

type VerificationStatus = "unverified" | "pending" | "verified";
type SubscriptionTier = "free" | "pro" | "business";

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
  updated_at: string;
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
    .select("user_id, full_name, phone")
    .in("user_id", userIds);

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  // Coda delle verifiche P.IVA: i casi con un esame umano aperto o appena
  // chiuso (migration 034). La lettura passa dalla policy "Staff reads
  // verification": qui il numero di partita IVA lo vediamo, i clienti mai.
  // Prendiamo anche i livelli già concessi: una concessione automatica
  // sbagliata deve potersi correggere da qui, non solo via SQL.
  const { data: reviewData } = await supabase
    .from("professional_verification")
    .select(
      "professional_id, level, vat_number, vat_active, vat_holder_name, vat_checked_at, vat_check_source, vat_review_state, vat_review_note, vat_reviewed_at, updated_at"
    )
    .or("vat_review_state.not.is.null,level.neq.none")
    .order("updated_at", { ascending: false });

  const reviewRows = (reviewData ?? []) as unknown as VerificationRow[];
  const proById = Object.fromEntries(pros.map((p) => [p.id, p]));

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
                />
              ))}
            </div>
          </details>
        )}
      </section>

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
}: {
  row: VerificationRow;
  pro: ProRow | undefined;
  profile: { full_name: string | null; phone: string | null } | undefined;
}) {
  const name = profile?.full_name ?? "Professionista";
  const state = row.vat_review_state;
  const svc = pro?.professional_services?.[0];
  const mismatch =
    profile?.full_name && row.vat_holder_name
      ? !nameLooksConsistent(profile.full_name, row.vat_holder_name)
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
      </dl>

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
        </p>
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
