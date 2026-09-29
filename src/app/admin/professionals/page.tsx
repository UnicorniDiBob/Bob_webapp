// Pagina admin: verifica dei professionisti (riscritta il 29/09).
// In cima una coda di lavoro sola, dal piu' urgente, con le viste per stato
// come filtro (?vista=); a destra lo SLA misurato e il registro; in fondo,
// chiuso, l'archivio di tutti i professionisti con le due leve dello staff
// (piano e approvazione staff). Vedi ./coda.ts per le regole della coda.

import { createClient } from "@/lib/supabase/server";
import { Wrench, MapPin, Phone, Calendar } from "lucide-react";
import { VerifyButtons } from "./VerifyButtons";
import { TierButtons } from "./TierButtons";
import { VatReviewActions } from "./VatReviewActions";
import Link from "next/link";
import {
  VISTE,
  aperto,
  contatori,
  firmaDocumenti,
  inAttesaDelProDa,
  pallaNostra,
  perche,
  righeDellaVista,
  vistaDa,
  type DocumentoFirmato,
  type DocumentoGrezzo,
} from "./coda";
import {
  misuraSlaStorica,
  namesMatch,
  procedureFlagInName,
  statoCoda,
  SLA_VERIFICA_GIORNI_LAVORATIVI,
  VERIFICATION_LABEL_STAFF,
  type EventoVerificaSla,
  type MisuraSla,
  type VerificationLevel,
  type VatReviewState,
} from "@/lib/vat";
import type { VerificationEvent } from "@/lib/supabase/types";

export const revalidate = 0; // sempre aggiornato

type VerificationStatus = "unverified" | "pending" | "verified";
type SubscriptionTier = "free" | "pro" | "business";

// Documento di verifica come lo consuma la coda: link firmato già risolto
// (o segnato come fallito), vedi firmaDocumenti() in ./coda.ts.
type AdminDoc = DocumentoFirmato;

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
  recheck_reason: string | null;
  recheck_opened_at: string | null;
  vat_review_opened_at: string | null;
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
        {proName && <span className="text-bob-ink/65">· {proName}</span>}
        <span className="text-bob-ink/65">{fmtDateTime(e.created_at)}</span>
      </div>
      <div className="mt-0.5 text-bob-ink/70">
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
      {e.note && <p className="mt-0.5 text-bob-ink/70">{e.note}</p>}
    </li>
  );
}

const REVIEW_LABEL: Record<VatReviewState, string> = {
  pending: "Da esaminare",
  docs_requested: "Documenti richiesti",
  rejected: "Respinto",
  recheck: "Da ricontrollare",
};

const REVIEW_BADGE: Record<VatReviewState, string> = {
  pending: "bg-amber-50 text-amber-700",
  docs_requested: "bg-bob-indigo-50 text-bob-indigo",
  rejected: "bg-red-50 text-red-700",
  recheck: "bg-orange-50 text-orange-700",
};

interface ProRow {
  id: string;
  verification_status: VerificationStatus;
  subscription_tier: SubscriptionTier;
  created_at: string | null;
  user_id: string;
  cities: { name: string } | null;
  professional_services: {
    services: { name: string } | null;
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

// «Verificati — Profili approvati e visibili ai clienti» stava qui, sopra la
// sezione raggruppata per verification_status. Era falso almeno dalla 080
// (13/09): chi compare ai clienti non lo decide quel campo. Tolta il 29/09.

export default async function AdminProfessionalsPage({
  searchParams,
}: {
  searchParams?: { vista?: string | string[] };
}) {
  const supabase = await createClient();
  // LA VISTA STA NELL'INDIRIZZO (?vista=), e si legge sul server: un link a una
  // vista si incolla a qualcuno e si riapre uguale. Predefinita: «Aperti».
  const vista = vistaDa(searchParams?.vista);
  const adesso = new Date();

  const { data } = await supabase
    .from("professionals")
    .select(`
      id,
      user_id,
      verification_status,
      subscription_tier,
      created_at,
      cities ( name ),
      professional_services ( services ( name ) )
    `)
    .order("created_at", { ascending: false });

  const pros = (data ?? []) as unknown as ProRow[];

  // Recupera i nomi dai profili
  const userIds = pros.map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", userIds);

  const nomeMap: Record<string, string | null> = Object.fromEntries(
    (profiles ?? []).map((p) => [p.user_id, p.full_name])
  );

  // Coda delle verifiche P.IVA: i casi con un esame umano aperto o appena
  // chiuso (migration 034). La lettura passa dalla policy "Staff reads
  // verification": qui il numero di partita IVA lo vediamo, i clienti mai.
  // Prendiamo anche i livelli già concessi: una concessione automatica
  // sbagliata deve potersi correggere da qui, non solo via SQL.
  const { data: reviewData } = await supabase
    .from("professional_verification")
    .select(
      "professional_id, level, vat_number, vat_active, vat_holder_name, vat_checked_at, vat_check_source, vat_review_state, vat_review_note, vat_reviewed_at, vat_reviewed_by_name, declared_business_name, vat_match_source, recheck_reason, recheck_opened_at, vat_review_opened_at, updated_at"
    )
    .or("vat_review_state.not.is.null,level.neq.none")
    .order("updated_at", { ascending: false });

  const reviewRows = (reviewData ?? []) as unknown as VerificationRow[];
  const proById = Object.fromEntries(pros.map((p) => [p.id, p]));
  const righeVista = righeDellaVista(reviewRows, vista, adesso);
  const numeri = contatori(reviewRows, adesso);

  // IL TELEFONO SOLO DOVE SERVE (29/09, privilegio minimo): si legge per i
  // casi della vista mostrata, che lo mostrano nella scheda. Prima si leggeva
  // per tutti i professionisti, e la sezione in fondo lo stampava a tutti.
  // In profile_phone dalla 051, non piu' in profiles (vedi admin/users/page.tsx).
  const userIdsVista = righeVista
    .map((r) => proById[r.professional_id]?.user_id)
    .filter((x): x is string => !!x);
  const { data: phones } = userIdsVista.length
    ? await supabase.from("profile_phone").select("user_id, phone").in("user_id", userIdsVista)
    : { data: [] };
  const phoneMap = Object.fromEntries(
    ((phones ?? []) as { user_id: string; phone: string | null }[]).map((p) => [p.user_id, p.phone])
  );
  const profileMap: Record<string, { full_name: string | null; phone: string | null }> =
    Object.fromEntries(
      Object.entries(nomeMap).map(([uid, full_name]) => [uid, { full_name, phone: phoneMap[uid] ?? null }])
    );

  // Il registro delle verifiche, letto in due modi diversi perché servono a
  // due cose diverse.
  //
  // 1) Lo storico DEL CASO che ho davanti: deve essere completo, sempre. Prima
  //    lo ricavavo dai 200 movimenti più recenti di tutti, e per un caso vecchio
  //    la cronologia risultava vuota pur esistendo: una cronologia che a volte
  //    mente è peggio di nessuna cronologia. Ora si chiede per i professionisti
  //    effettivamente mostrati in pagina: quelli della vista, non tutti.
  const idsInPagina = righeVista.map((r) => r.professional_id);
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
  // PRIVILEGIO MINIMO (29/09): si firmano solo i documenti dei casi della
  // vista mostrata — prima si firmava tutto, a ogni apertura, anche i livelli
  // attivi e i respinti che nessuno apriva. Una firma fallita resta visibile.
  const docsByPro = await firmaDocumenti(
    (docsData ?? []) as unknown as DocumentoGrezzo[],
    async (percorso) => {
      const { data: signed, error } = await supabase.storage
        .from("verifica-documenti")
        .createSignedUrl(percorso, 3600);
      if (error) {
        console.error(`[admin/professionals] link firmato non creato: ${error.message}`);
        return null;
      }
      return signed?.signedUrl ?? null;
    }
  );

  // 3) La misura a posteriori dell'SLA (29/09, m2t4s8): quanto ci abbiamo
  //    messo davvero sui casi chiusi. Serve il registro INTERO, non gli ultimi
  //    100: PostgREST taglia comunque a un massimo di righe, quindi si chiede
  //    il conteggio e, se le righe lette sono meno, la misura si dichiara
  //    parziale invece di mostrare un numero sbagliato che sembra giusto.
  const LIMITE_MISURA_SLA = 10000;
  const {
    data: eventiSla,
    count: totaleEventiSla,
    error: erroreEventiSla,
  } = await supabase
    .from("verification_events")
    .select("professional_id, event, created_at, actor_role", { count: "exact" })
    .order("created_at", { ascending: true })
    .range(0, LIMITE_MISURA_SLA - 1);
  if (erroreEventiSla) {
    console.error(`[admin/professionals] misura SLA: lettura del registro fallita: ${erroreEventiSla.message}`);
  }
  const letturaSla = {
    letti: (eventiSla ?? []).length,
    totale: totaleEventiSla ?? null,
    errore: !!erroreEventiSla,
  };
  const misuraSla = erroreEventiSla
    ? null
    : misuraSlaStorica((eventiSla ?? []) as unknown as EventoVerificaSla[]);

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
    nameByPro.set(p.id, nomeMap[p.user_id] ?? "Professionista");
  }

  // LA CODA DI LAVORO (29/09): una sola, dal piu' urgente, e le viste per stato
  // sono filtri sulla stessa lista. L'ordine e le regole stanno in ./coda.ts,
  // che usa statoCoda() e casiInEmergenza() di vat.ts. Prima erano cinque
  // sezioni (Emergenze, Ricontrollo, Coda partita IVA, livelli attivi,
  // respinti) e bisognava leggerle tutte.
  const titoloVista = VISTE.find((v) => v.id === vista)?.titolo ?? "";

  // L'ARCHIVIO (29/09): tutti i professionisti, per trovarli e per le due leve
  // dello staff. Nessuna azione sul caso: quelle stanno solo nella coda.
  const livelloPerPro = new Map(reviewRows.map((r) => [r.professional_id, r.level]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">
          Verifica professionisti
        </h1>
        <p className="mt-1 text-sm text-bob-ink/70">
          Esamina i profili e aggiorna il loro stato di verifica.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* ---- La coda di lavoro (29/09): una sola, dal piu' urgente ---- */}
        <div className="space-y-4 xl:col-span-2">
          <section id="coda" data-testid="coda-lavoro" className="scroll-mt-20">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-lg font-semibold text-bob-ink">{titoloVista}</h2>
              <p className="text-sm text-bob-ink/70" data-testid="coda-contatori">
                <span className="font-semibold text-bob-ink">{numeri.daFare}</span> con la palla nostra
                {" · "}
                <span className={numeri.oltreSla > 0 ? "font-semibold text-red-700" : "font-semibold text-bob-ink"}>
                  {numeri.oltreSla}
                </span>{" "}
                oltre i {SLA_VERIFICA_GIORNI_LAVORATIVI} giorni lavorativi
                {" · "}
                <span className="font-semibold text-bob-ink">{numeri.inAttesaDelPro}</span> in attesa del professionista
              </p>
            </div>
            <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Viste della coda" data-testid="coda-viste">
              {VISTE.map((v) => (
                <Link
                  key={v.id}
                  href={v.id === "aperti" ? "/admin/professionals" : `/admin/professionals?vista=${v.id}`}
                  aria-current={v.id === vista ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    v.id === vista
                      ? "bg-bob-indigo text-white"
                      : "bg-black/5 text-bob-ink/70 hover:bg-black/10"
                  }`}
                >
                  {v.etichetta}
                </Link>
              ))}
            </nav>
            {vista === "aperti" && (
              <p className="mb-3 text-xs text-bob-ink/65">
                {"Dall'alto in basso: prima chi ha superato i giorni che abbiamo promesso, poi chi aspetta noi da più tempo, poi chi aspetta il professionista. Una riga si apre per decidere."}
              </p>
            )}

            {righeVista.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 py-8 text-center text-sm text-bob-ink/65">
                {vista === "aperti" ? "Niente da fare: nessun caso aperto." : "Nessun caso in questa vista."}
              </div>
            ) : (
              <ol className="flex flex-col gap-2" data-testid="coda-righe">
                {righeVista.map((row, i) => {
                  const pro = proById[row.professional_id];
                  const profile = pro ? profileMap[pro.user_id] : undefined;
                  const storico = eventsByPro.get(row.professional_id) ?? [];
                  const primoDiLoro =
                    aperto(row) &&
                    !pallaNostra(row) &&
                    (i === 0 || pallaNostra(righeVista[i - 1]));
                  return (
                    <li key={row.professional_id}>
                      {primoDiLoro && (
                        <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-bob-ink/60">
                          {"In attesa del professionista"}
                        </p>
                      )}
                      <RigaCoda
                        row={row}
                        pro={pro}
                        profile={profile}
                        storico={storico}
                        documenti={docsByPro.get(row.professional_id) ?? []}
                        adesso={adesso}
                      />
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

        </div>

        {/* ---- A destra: la misura e il registro. Non sono lavoro da fare. ---- */}
        <aside className="space-y-6">
          <RiquadroSlaMisurato misura={misuraSla} lettura={letturaSla} />

          {events.length > 0 && (
            <details data-testid="vat-registro">
              <summary className="cursor-pointer text-sm font-medium text-bob-ink/70 hover:text-bob-indigo">
                Registro delle verifiche — ultimi {events.length} movimenti
                {typeof totaleMovimenti === "number" && totaleMovimenti > events.length
                  ? ` su ${totaleMovimenti}`
                  : ""}
              </summary>
              <p className="mt-2 text-xs text-bob-ink/65">
                Si scrive solo in aggiunta: nessuna riga può essere modificata o
                cancellata, nemmeno da un amministratore. Lo vedono gli account
                admin e customer service; il professionista vede solo le sue
                righe. La cronologia completa di un caso sta nella sua scheda.
              </p>
              <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto pr-2">
                {events.map((e) => (
                  <EventRow key={e.id} e={e} proName={nameByPro.get(e.professional_id)} />
                ))}
              </ul>
            </details>
          )}
        </aside>
      </div>

      {/* ---- L'archivio: non e' una coda. Solo le due leve dello staff. ---- */}
      <details data-testid="archivio-professionisti">
        <summary className="cursor-pointer text-sm font-medium text-bob-ink/70 hover:text-bob-indigo">
          Tutti i professionisti ({pros.length}) — archivio, piano e approvazione staff
        </summary>
        <div className="mt-3 grid gap-3 text-xs text-bob-ink/70 lg:grid-cols-2">
          <p>
            <span className="font-semibold text-bob-ink">Piano.</span>{" "}
            {"Cambia il piano di abbonamento del professionista; ogni cambio lo registra subscription_tier_events. È l'unico punto da cui lo staff lo può fare."}
          </p>
          <p>
            <span className="font-semibold text-bob-ink">Approvazione staff (verification_status).</span>{" "}
            {"Fa due cose: se non è «Approva», un livello «documenti verificati» si mostra ai clienti come «Pro» invece che «Pro+»; e la contano la dashboard di /admin e le analisi. Non fa: non decide chi compare ai clienti né l'ordine dei risultati, non chiede una motivazione e non lascia una riga nel registro."}
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="archivio-tabella">
            <thead className="text-xs text-bob-ink/60">
              <tr className="border-b border-black/10">
                <th className="py-2 pr-3 font-semibold">Professionista</th>
                <th className="py-2 pr-3 font-semibold">Città</th>
                <th className="py-2 pr-3 font-semibold">Livello</th>
                <th className="py-2 pr-3 font-semibold">Iscritto</th>
                <th className="py-2 pr-3 font-semibold">Piano</th>
                <th className="py-2 font-semibold">Approvazione staff</th>
              </tr>
            </thead>
            <tbody>
              {pros.map((pro) => (
                <tr key={pro.id} className="border-b border-black/5 align-middle" data-testid={`pro-row-${pro.id}`}>
                  <td className="py-2 pr-3 font-medium text-bob-ink">
                    {nomeMap[pro.user_id] ?? "Professionista"}
                  </td>
                  <td className="py-2 pr-3 text-bob-ink/70">{pro.cities?.name ?? "—"}</td>
                  <td className="py-2 pr-3 text-bob-ink/70">
                    {VERIFICATION_LABEL_STAFF[livelloPerPro.get(pro.id) ?? "none"]}
                  </td>
                  <td className="py-2 pr-3 text-bob-ink/70">{fmtDate(pro.created_at)}</td>
                  <td className="py-2 pr-3">
                    <TierButtons proId={pro.id} currentTier={pro.subscription_tier ?? "free"} />
                  </td>
                  <td className="py-2">
                    <VerifyButtons proId={pro.id} currentStatus={pro.verification_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
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
    `Livello attuale: ${VERIFICATION_LABEL_STAFF[row.level]}`,
    `Servizio e città: ${svc ?? "—"}${pro?.cities?.name ? `, ${pro.cities.name}` : ""}`,
    profile?.phone ? `Telefono: ${profile.phone}` : null,
    `Profilo: /professionisti/${row.professional_id}`,
  ];
  return righe.filter(Boolean).join("\n");
}

// Il riquadro della misura a posteriori. Il numero che conta come «SLA
// misurato» e' sforatoSecondoIToS, sull'ultimo tratto: e' la regola che abbiamo
// pubblicato. attesaTotale gli sta accanto con la sua etichetta: e' quanto ha
// aspettato davvero la persona. Le chiusure automatiche stanno fuori, contate a
// parte. Vedi misuraSlaStorica() in src/lib/vat.ts.
function mediana(valori: number[]): number | null {
  if (valori.length === 0) return null;
  const v = [...valori].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function RiquadroSlaMisurato({
  misura,
  lettura,
}: {
  misura: MisuraSla | null;
  lettura: { letti: number; totale: number | null; errore: boolean };
}) {
  const parziale = lettura.totale !== null && lettura.totale > lettura.letti;
  const casi = misura?.esameUmano ?? [];
  const attese = casi.map((c) => c.attesaTotale);
  const med = mediana(attese);
  const max = attese.length ? Math.max(...attese) : null;

  return (
    <section id="sla-misurato" data-testid="sla-misurato" className="scroll-mt-20">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-bob-ink">SLA misurato</h2>
        {misura && !parziale && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              misura.sforati > 0 ? "bg-red-50 text-red-700" : "bg-black/5 text-bob-ink/65"
            }`}
            data-testid="sla-misurato-conteggio"
          >
            {`${misura.rispettati} su ${casi.length}`}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-bob-ink/70">
        {`I casi già chiusi da una persona, ricostruiti dal registro. Dentro l'SLA vuol dire entro ${SLA_VERIFICA_GIORNI_LAVORATIVI} giorni lavorativi sull'ultimo tratto con la palla nostra: la regola che abbiamo scritto nei termini.`}
      </p>

      {lettura.errore || !misura ? (
        <div className="rounded-2xl border border-dashed border-red-200 py-6 text-center text-sm text-red-700">
          {"Misura non disponibile: la lettura del registro è fallita."}
        </div>
      ) : parziale ? (
        <div className="rounded-2xl border border-dashed border-amber-200 py-6 text-center text-sm text-amber-700">
          {`Misura parziale: letti ${lettura.letti} eventi del registro su ${lettura.totale}. Non la mostro: un numero calcolato su una parte sembrerebbe giusto.`}
        </div>
      ) : (
        <div className="grid gap-3 rounded-2xl border border-black/10 p-4 text-sm text-bob-ink/80 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-bob-ink">Secondo i termini</p>
            {casi.length === 0 ? (
              <p className="mt-1">{"Nessun caso chiuso da una persona da misurare, per ora."}</p>
            ) : (
              <p className="mt-1">
                {`${misura.rispettati} dentro i ${SLA_VERIFICA_GIORNI_LAVORATIVI} giorni lavorativi, ${misura.sforati} oltre, su ${casi.length} casi chiusi da una persona.`}
              </p>
            )}
          </div>
          <div>
            <p className="font-semibold text-bob-ink">Attesa totale</p>
            <p className="mt-1">
              {med === null
                ? "Nessun dato."
                : `Mediana ${med}, massima ${max} giorni lavorativi: la somma dei tratti con la palla nostra, pause escluse.`}
            </p>
          </div>
          <div className="sm:col-span-2 text-xs text-bob-ink/65">
            {`Fuori dalla misura: ${misura.automatici.giroNotturno} chiusi dal giro notturno e ${misura.automatici.ingresso} dall'automatismo all'ingresso (automatici, non esami umani); ${misura.senzaAttesaNostra} chiusi senza che la palla fosse mai nostra; ${misura.aperti} ancora aperti${misura.nonAttribuiti ? `; ${misura.nonAttribuiti} senza un autore riconoscibile` : ""}. Un giorno lavorativo è una mezzanotte feriale attraversata (festivi inclusi), contata in UTC.`}
          </div>
        </div>
      )}
    </section>
  );
}

// UNA RIGA DELLA CODA: chi, perche', da quanto — senza aprire niente. Aprendola
// c'e' la scheda del caso di sempre, con le sue azioni: e' l'unico posto dove
// si decide su un caso.
function RigaCoda({
  row,
  pro,
  profile,
  storico,
  documenti,
  adesso,
}: {
  row: VerificationRow;
  pro: ProRow | undefined;
  profile: { full_name: string | null; phone: string | null } | undefined;
  storico: VerificationEvent[];
  documenti: AdminDoc[];
  adesso: Date;
}) {
  const name = profile?.full_name ?? "Professionista";
  const svc = pro?.professional_services?.[0]?.services?.name;
  const attesaPro = inAttesaDelProDa(row, storico, adesso);
  return (
    <details className="group rounded-xl border border-black/10 bg-white" data-testid={`coda-riga-${row.professional_id}`}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-black/[0.02]">
        <span className="min-w-[12rem] font-semibold text-bob-ink">{name}</span>
        <span className="text-xs text-bob-ink/65">
          {[svc, pro?.cities?.name].filter(Boolean).join(" · ") || "—"}
        </span>
        <span className="text-sm text-bob-ink/80" data-testid="coda-perche">
          {perche(row, storico)}
        </span>
        <span className="ml-auto">
          {attesaPro ? (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-2xs font-semibold text-bob-ink/70">
              {attesaPro}
            </span>
          ) : (
            <PillolaSla apertoIl={row.vat_review_opened_at} />
          )}
        </span>
      </summary>
      <div className="border-t border-black/5 p-2">
        <VatCaseCard row={row} pro={pro} profile={profile} storico={storico} documenti={documenti} />
      </div>
    </details>
  );
}

// Da quanto aspetta, in giorni lavorativi, e quanto manca alla cifra che
// abbiamo dichiarato. Non c'e' countdown al secondo: il numero utile a chi
// lavora la coda e' «quanti giorni ho ancora», non «quante ore».
function PillolaSla({ apertoIl }: { apertoIl: string | null }) {
  const stato = statoCoda(apertoIl);
  if (!stato) return null;

  const testo = stato.sforata
    ? `SLA sforata di ${-stato.rimasti} ${-stato.rimasti === 1 ? "giorno" : "giorni"}`
    : stato.rimasti === 0
      ? "Ultimo giorno utile"
      : `Restano ${stato.rimasti} ${stato.rimasti === 1 ? "giorno" : "giorni"}`;

  const stile = stato.sforata
    ? "bg-red-50 text-red-700"
    : stato.rimasti <= 1
      ? "bg-amber-50 text-amber-700"
      : "bg-black/5 text-bob-ink/70";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${stile}`}
      title={`In coda da ${stato.inCoda} giorni lavorativi. Scadenza SLA: ${stato.scadenzaSla.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}.`}
      data-testid="pillola-sla"
    >
      {testo} · in coda da {stato.inCoda}
    </span>
  );
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
            className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${REVIEW_BADGE[state]}`}
          >
            {REVIEW_LABEL[state]}
          </span>
        )}
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-2xs font-semibold text-bob-ink/70">
          Livello attuale: {VERIFICATION_LABEL_STAFF[row.level]}
        </span>
        <PillolaSla apertoIl={row.vat_review_opened_at} />
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-bob-ink/70">
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
          <dt className="text-bob-ink/65">Partita IVA dichiarata:</dt>
          <dd className="font-mono font-semibold text-bob-ink">
            {row.vat_number ?? "—"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-bob-ink/65">Esito automatico:</dt>
          <dd className="text-bob-ink">
            {row.vat_active === true
              ? "confermata"
              : row.vat_check_source === "vies"
              ? "non confermata dal VIES"
              : "nessuna risposta"}
          </dd>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <dt className="text-bob-ink/65">Intestazione dal registro:</dt>
          <dd className="text-bob-ink">{row.vat_holder_name ?? "non disponibile"}</dd>
        </div>
        {row.vat_match_source === "declared_name" && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="text-bob-ink/65">Attribuita in base a:</dt>
            <dd className="font-medium text-amber-700">
              ragione sociale dichiarata dal professionista — da ricontrollare a
              campione
            </dd>
          </div>
        )}
        {row.declared_business_name && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="text-bob-ink/65">Ragione sociale dichiarata:</dt>
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
            <span className="mt-0.5 block text-bob-ink/65">
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
                  <span>
                    {d.file_name}
                    {d.firmaFallita && (
                      <span className="ml-1 font-semibold text-red-700" data-testid="documento-senza-link">
                        {"(link non creato: ricarica la pagina)"}
                      </span>
                    )}
                  </span>
                )}{" "}
                · {fmtDateTime(d.uploaded_at)}
                {d.status !== "in_esame" && ` · ${d.status}`}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-2xs text-bob-ink/65">
            I link scadono dopo un&apos;ora: sono firmati, non pubblici.
          </p>
        </div>
      )}

      {storico.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-bob-ink/65 hover:text-bob-indigo">
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
