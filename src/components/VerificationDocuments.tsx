"use client";

// Caricamento documenti per la verifica (10.2).
//
// PERCHÉ ESISTE
// "Chiedi documenti" in coda admin è un'azione vera dalla migration 038, ma il
// professionista non aveva DOVE caricarli: la richiesta arrivava via email e i
// documenti tornavano per canali fuori piattaforma. Da qui (052) il pro carica
// nel bucket privato `verifica-documenti` e lo staff li vede nella coda.
//
// SICUREZZA E PRIVACY
// - bucket privato, path per-utente (<user_id>/<uuid>-<file>): la RLS dello
//   storage lascia leggere solo proprietario e staff;
// - i metadati stanno in verification_documents (RLS: idem);
// - niente anteprime pubbliche, niente URL permanenti: la lettura passa da
//   signed URL a scadenza.
// - retention (DATA_COMPLIANCE §5): il documento vive con la pratica di
//   verifica; sparisce a cascata con l'account.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileText, Upload, CheckCircle2, XCircle, Clock } from "lucide-react";

interface DocRow {
  id: string;
  file_name: string;
  doc_type: string | null;
  status: "in_esame" | "accettato" | "rifiutato";
  review_note: string | null;
  uploaded_at: string;
}

const MAX_MB = 10;
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export default function VerificationDocuments({
  professionalId,
}: {
  professionalId: string;
}) {
  const supabase = createClient();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("verification_documents")
      .select("id, file_name, doc_type, status, review_note, uploaded_at")
      .eq("professional_id", professionalId)
      .order("uploaded_at", { ascending: false });
    setDocs((data ?? []) as DocRow[]);
  }, [supabase, professionalId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Formato non supportato: carica PDF, JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Il file supera ${MAX_MB} MB: riducilo o dividilo.`);
      return;
    }
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessione scaduta: ricarica la pagina.");

      // Path per-utente: la policy dello storage accetta solo la propria cartella.
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("verifica-documenti")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { error: rowErr } = await supabase.from("verification_documents").insert({
        professional_id: professionalId,
        uploaded_by: user.id,
        storage_path: path,
        file_name: file.name,
      });
      if (rowErr) throw rowErr;

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caricamento non riuscito.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-bob-ink/60">
        Se lo staff ti ha chiesto dei documenti (visura, attestati, documento
        d&apos;identità), caricali qui: li vede solo il team di verifica.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
          }}
          data-testid="input-verification-doc"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-sm font-medium text-bob-ink transition hover:border-black/25 disabled:opacity-50"
          data-testid="button-upload-doc"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {busy ? "Carico…" : "Carica un documento"}
        </button>
        <span className="text-xs text-bob-ink/40">PDF, JPG, PNG · max {MAX_MB} MB</span>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {docs.length > 0 && (
        <ul className="mt-3 space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-bob-ink/40" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-bob-ink/75">{d.file_name}</span>
              {d.status === "in_esame" && (
                <span className="inline-flex items-center gap-1 text-xs text-bob-ink/50">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> In esame
                </span>
              )}
              {d.status === "accettato" && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Accettato
                </span>
              )}
              {d.status === "rifiutato" && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-red-600"
                  title={d.review_note ?? undefined}
                >
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Rifiutato
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
