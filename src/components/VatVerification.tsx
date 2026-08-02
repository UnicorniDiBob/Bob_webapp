"use client";

// Verifica della partita IVA nel profilo del professionista (blocco 10, §5.2).
//
// Il motore sta in /api/pro/verifica-piva: qui c'è solo la parte che il pro
// vede e usa. Tre principi che guidano i testi di questa card:
//
//  1. Il checksum si fa in locale mentre digita: un refuso non deve diventare
//     un tentativo consumato né una chiamata al VIES.
//  2. Chi non risulta nel VIES NON è un respinto. È il caso più comune tra gli
//     artigiani che non lavorano con l'estero: il testo deve dirlo prima che se
//     lo chieda, altrimenti pensa di essere stato rifiutato e se ne va.
//  3. La partita IVA non compare mai sul profilo pubblico. Va detto qui, dove
//     la stiamo chiedendo, non solo nell'informativa.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { VerificationLevelBadge } from "@/components/ui";
import {
  vatValidationError,
  normalizeVat,
  VERIFICATION_LABEL,
  type VerificationLevel,
  type VatReviewState,
} from "@/lib/vat";

// Nota di minimizzazione: NON leggiamo vat_number. La riga è sua e potrebbe
// vederlo, ma qui non serve mostrarlo, quindi non lo chiediamo nemmeno.
interface VerificationRow {
  level: VerificationLevel;
  vat_checked_at: string | null;
  vat_holder_name: string | null;
  vat_review_state: VatReviewState | null;
  vat_review_note: string | null;
  declared_business_name: string | null;
}

type ApiStatus =
  | "verified"
  | "needs_review"
  | "pending"
  | "rate_limited"
  | "invalid_format"
  | "already_verified"
  | "already_claimed";

// Stesso fuso del badge pubblico (ui.tsx): il pro e il cliente devono leggere
// la stessa data per lo stesso controllo.
function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Rome",
    });
  } catch {
    return "—";
  }
}

export default function VatVerification({
  professionalId,
}: {
  professionalId: string;
}) {
  const supabase = createClient();

  const [row, setRow] = useState<VerificationRow | null>(null);
  const [booted, setBooted] = useState(false);
  const [vat, setVat] = useState("");
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [touched, setTouched] = useState(false);
  const campoVat = useRef<HTMLInputElement | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ status: ApiStatus; message: string } | null>(
    null
  );
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("professional_verification")
      .select(
        "level, vat_checked_at, vat_holder_name, vat_review_state, vat_review_note, declared_business_name"
      )
      .eq("professional_id", professionalId)
      .maybeSingle();
    const riga = (data as VerificationRow) ?? null;
    setRow(riga);
    if (riga?.declared_business_name) setRagioneSociale(riga.declared_business_name);
    setBooted(true);
  }, [supabase, professionalId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Chi arriva dall'avviso in dashboard ha gia' deciso di farlo: portarlo qui
  // e lasciarlo cercare il campo e' un modo per farglielo rimandare.
  useEffect(() => {
    if (!booted) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#verifica-piva") return;
    const t = setTimeout(() => campoVat.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [booted]);

  // Gradino 1: checksum locale, mentre digita. Nessuna chiamata esterna.
  const formatError = touched && vat.trim() ? vatValidationError(vat) : null;
  const canSend = !sending && vat.trim().length > 0 && !vatValidationError(vat);

  async function submit() {
    if (!canSend) return;
    setSending(true);
    setFailure(null);
    setResult(null);
    try {
      const res = await fetch("/api/pro/verifica-piva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vatNumber: normalizeVat(vat),
          businessName: ragioneSociale.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        status?: ApiStatus;
        message?: string;
        error?: string;
      };
      if (json.status && json.message) {
        setResult({ status: json.status, message: json.message });
        if (json.status !== "invalid_format") {
          setVat("");
          setTouched(false);
          await load();
        }
      } else {
        setFailure(
          json.error ??
            "Non sono riuscito a inviare la richiesta. Riprova tra poco."
        );
      }
    } catch {
      setFailure(
        "Non sono riuscito a contattare il server. Controlla la connessione e riprova."
      );
    } finally {
      setSending(false);
    }
  }

  if (!booted) {
    return (
      <p className="mt-1 text-sm text-bob-ink/50">Carico lo stato della verifica…</p>
    );
  }

  const level: VerificationLevel = row?.level ?? "none";
  const review = row?.vat_review_state ?? null;
  const verified = level === "vat_verified" || level === "documents_verified";
  // Il form resta disponibile in ogni stato tranne "già verificato" (e lì
  // l'API rifiuta comunque). Vale anche mentre la pratica è in coda o quando
  // abbiamo chiesto un documento: nella maggior parte dei casi il problema è
  // un dato sbagliato — una cifra, o la ragione sociale mancante — e lasciarlo
  // correggere chiude il caso senza far muovere nessuno.
  const showForm = !verified;

  return (
    <div className="mt-2 space-y-3">
      {/* Stato attuale, con la stessa etichetta che vedono i clienti. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-bob-ink/60">Il tuo livello:</span>
        <VerificationLevelBadge
          level={level}
          verifiedAt={row?.vat_checked_at ?? null}
        />
      </div>

      {verified && (
        <div
          className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
          data-testid="vat-verified-box"
        >
          <p className="font-semibold">
            Partita IVA riscontrata il {fmtDate(row?.vat_checked_at ?? null)}.
          </p>
          {row?.vat_holder_name && (
            <p className="mt-0.5 text-emerald-700">
              Risulta intestata a {row.vat_holder_name}.
            </p>
          )}
          <p className="mt-1 text-emerald-700/90">
            Sul tuo profilo pubblico i clienti vedono l&apos;etichetta{" "}
            <strong>{VERIFICATION_LABEL[level]}</strong> e la data del riscontro.
            Il numero non è visibile a nessuno di loro.
          </p>
        </div>
      )}

      {review === "pending" && !verified && (
        <div
          className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          data-testid="vat-pending-box"
        >
          <p className="font-semibold">Richiesta in esame.</p>
          <p className="mt-0.5 text-amber-700">
            La tua partita IVA è formalmente corretta ma non risulta
            nell&apos;archivio europeo VIES: succede spesso a chi non lavora con
            l&apos;estero, e non è un rifiuto. Completiamo il controllo noi:
            non serve fare altro. Se ti accorgi di aver sbagliato una cifra,
            puoi correggerla qui sotto.
          </p>
        </div>
      )}

      {review === "docs_requested" && (
        <div
          className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          data-testid="vat-docs-box"
        >
          <p className="font-semibold">Ti abbiamo chiesto un documento.</p>
          {row?.vat_review_note && (
            <p className="mt-0.5 text-amber-700">{row.vat_review_note}</p>
          )}
          <p className="mt-1 text-amber-700/90">
            Ti contattiamo noi con le istruzioni per inviarlo: appena lo
            riceviamo completiamo la verifica.
          </p>
        </div>
      )}

      {review === "rejected" && (
        <div
          className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800"
          data-testid="vat-rejected-box"
        >
          <p className="font-semibold">Richiesta non accolta.</p>
          {row?.vat_review_note && (
            <p className="mt-0.5 text-red-700">{row.vat_review_note}</p>
          )}
          <p className="mt-1 text-red-700/90">
            Se pensiamo male noi, correggi il numero qui sotto e ripresenta la
            richiesta: la rivediamo a mano.
          </p>
        </div>
      )}

      {showForm && (
        <>
          {review === "pending" ? (
            <p className="text-sm text-bob-ink/65">
              Hai sbagliato una cifra? Inserisci il numero corretto: sostituisce
              la richiesta in esame.
            </p>
          ) : (
            <p className="text-sm text-bob-ink/65">
              Comunicando la partita IVA passi al livello <strong>Pro</strong>:
              sul tuo profilo i clienti vedono che l&apos;abbiamo riscontrata,
              con la data del controllo. Se l&apos;intestazione risultante
              corrisponde al nome del tuo profilo bastano pochi secondi;
              altrimenti — per esempio se lavori con un nome commerciale o con
              una società — la controlliamo a mano, perché non concediamo il
              livello a chi inserisce una partita IVA che non è sua.
            </p>
          )}

          <div>
            <label className="label-bob" htmlFor="pf-vat">
              Partita IVA
            </label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                ref={campoVat}
                id="pf-vat"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
                onBlur={() => setTouched(true)}
                inputMode="numeric"
                autoComplete="off"
                maxLength={16}
                placeholder="11 cifre, es. 12345678901"
                className="input-bob"
                aria-invalid={formatError ? true : undefined}
                aria-describedby={formatError ? "pf-vat-error" : undefined}
                data-testid="vat-input"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className="btn-primary shrink-0 px-4 py-2.5 disabled:opacity-40"
                data-testid="vat-submit"
              >
                {sending ? "Verifico…" : "Verifica"}
              </button>
            </div>
            {formatError && (
              <p
                id="pf-vat-error"
                className="mt-1 text-xs text-red-600"
                data-testid="vat-format-error"
              >
                {formatError}
              </p>
            )}
            <p className="mt-1.5 text-xs text-bob-ink/45">
              Puoi scriverla con o senza il prefisso IT. Massimo 3 tentativi al
              giorno.
            </p>
          </div>

          <div>
            <label className="label-bob" htmlFor="pf-ragione-sociale">
              Nome completo dell&apos;azienda{" "}
              <span className="font-normal text-bob-ink/45">(facoltativo)</span>
            </label>
            <input
              id="pf-ragione-sociale"
              value={ragioneSociale}
              onChange={(e) => setRagioneSociale(e.target.value)}
              maxLength={120}
              autoComplete="organization"
              placeholder="Es. Idraulica Rossi S.r.l."
              className="input-bob mt-1"
              data-testid="vat-business-name"
            />
            <p className="mt-1.5 text-xs text-bob-ink/45">
              Compilalo se la partita IVA è intestata a un nome diverso da
              quello del tuo profilo: ci evita di doverti scrivere per chiedertelo.
            </p>
          </div>
        </>
      )}

      {result && (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${
            result.status === "verified"
              ? "bg-emerald-50 text-emerald-700"
              : result.status === "invalid_format" ||
                result.status === "rate_limited" ||
                result.status === "already_claimed"
              ? "bg-red-50 text-red-700"
              : "bg-amber-50 text-amber-800"
          }`}
          data-testid="vat-result"
        >
          {result.message}
        </p>
      )}
      {failure && (
        <p className="text-sm text-red-600" data-testid="vat-failure">
          {failure}
        </p>
      )}

      <p className="text-xs text-bob-ink/45">
        Usiamo la partita IVA solo per verificare i requisiti del tuo profilo,
        interrogando banche dati pubbliche, e conserviamo l&apos;esito del
        controllo come prova di cosa risultava a quella data. Non è mai visibile
        ai clienti e non la usiamo per altro:{" "}
        <Link href="/privacy" className="underline hover:text-bob-indigo">
          informativa privacy
        </Link>
        .
      </p>
    </div>
  );
}
