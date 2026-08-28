"use client";

// Sezione "I tuoi dati": chi sei tu, non cosa vendi.
//
// Vale per cliente e professionista: nome, cognome, telefono. La separazione
// dalla sezione "La tua azienda" non e' estetica — sono dati con regole
// diverse. Il profilo azienda e' pubblico per definizione; questi no: il nome
// segue le regole di visibilita' del percorso, e il telefono sta in una
// tabella sua con RLS propria (migrazione 051) perche' finiva leggibile da
// chiunque quando stava dentro profiles.
//
// IL TELEFONO DEL PROFESSIONISTA NON L'AVEVA MAI POTUTO INSERIRE LUI.
// Le policy della 051 glielo permettono dal 14 agosto, ma non esisteva nessuno
// schermo per farlo: si passava dallo staff via /api/admin/users/[id]. Il
// telefono e' quello che il cliente vede dopo aver accettato una prenotazione,
// quindi era anche il dato che bloccava il percorso.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { SectionHeader } from "@/components/ImpostazioniShell";
import { SectionSkeleton, SectionError } from "@/components/SectionStates";
import { EsportaDati } from "@/components/EsportaDati";

export default function DatiPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, loading: authLoading, refresh } = useAuth();

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [telefonoIniziale, setTelefonoIniziale] = useState("");

  const [booted, setBooted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?returnTo=/impostazioni/dati");
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);
    const [{ data: prof, error: pErr }, { data: tel }] = await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name, full_name")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profile_phone")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (pErr) {
      setFailed(true);
      setBooted(true);
      return;
    }

    const p = (prof ?? {}) as Record<string, unknown>;
    // I profili creati prima della 052 hanno solo full_name: si spezza per
    // proporre qualcosa di sensato, senza inventare un backfill nel database.
    const full = ((p.full_name as string) ?? "").trim();
    const [primo, ...resto] = full.split(" ");
    setNome(((p.first_name as string) ?? primo ?? "").trim());
    setCognome(((p.last_name as string) ?? resto.join(" ") ?? "").trim());

    const t = ((tel as { phone: string | null } | null)?.phone ?? "").trim();
    setTelefono(t);
    setTelefonoIniziale(t);
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user, load]);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving) return;
    setErr(null);
    setMsg(null);

    const n = nome.trim();
    const c = cognome.trim();
    if (n.length < 2) {
      setErr("Scrivi il tuo nome.");
      return;
    }

    const tel = telefono.trim();
    // Controllo volutamente permissivo: prefissi, spazi e punti sono normali
    // in un numero scritto a mano. Serve a fermare gli errori di battitura,
    // non a imporre un formato.
    if (tel && !/^[+0-9][0-9\s./()-]{6,24}$/.test(tel)) {
      setErr("Il numero non sembra valido. Controlla che ci siano solo cifre, spazi e prefisso.");
      return;
    }

    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          first_name: n,
          last_name: c || null,
          full_name: [n, c].filter(Boolean).join(" "),
        })
        .eq("user_id", user.id);
      if (pErr) throw pErr;

      if (tel !== telefonoIniziale) {
        const { error: tErr } = await supabase
          .from("profile_phone")
          .upsert(
            { user_id: user.id, phone: tel || null, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
        if (tErr) throw tErr;
        setTelefonoIniziale(tel);
      }

      await refresh();
      setMsg("Dati aggiornati.");
    } catch {
      setErr("Non sono riuscito a salvare. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !booted) return <SectionSkeleton rows={3} />;
  if (failed) return <SectionError onRetry={load} />;

  const isPro = role === "professional";

  return (
    <div>
      <SectionHeader title="I tuoi dati">
        Nome e recapito. Non sono il tuo profilo pubblico
        {isPro ? " — quello è in “La tua azienda”" : ""}.
      </SectionHeader>

      <form onSubmit={salva} className="card space-y-5 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-bob" htmlFor="dt-nome">
              Nome
            </label>
            <input
              id="dt-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input-bob"
              autoComplete="given-name"
              data-testid="dati-nome"
            />
          </div>
          <div>
            <label className="label-bob" htmlFor="dt-cognome">
              Cognome
            </label>
            <input
              id="dt-cognome"
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
              className="input-bob"
              autoComplete="family-name"
              data-testid="dati-cognome"
            />
          </div>
        </div>

        <div>
          <label className="label-bob" htmlFor="dt-tel">
            Telefono
          </label>
          <input
            id="dt-tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="input-bob"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+39 …"
            data-testid="dati-telefono"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-bob-ink/50">
            {isPro
              ? "Lo vede solo un cliente che ha già accettato di lavorare con te, mai chi sta guardando il tuo profilo. Senza numero, dopo una prenotazione il cliente non ha come chiamarti."
              : "Lo vede solo il professionista con cui hai deciso di lavorare, dopo che l’hai scelto. Puoi lasciarlo vuoto."}
          </p>
        </div>

        {err && (
          <p className="text-sm text-red-600" data-testid="dati-error">
            {err}
          </p>
        )}
        {msg && !err && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            ✓ {msg}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full py-3 sm:w-auto"
          data-testid="dati-save"
        >
          {saving ? "Salvo…" : "Salva"}
        </button>
      </form>

      {/* Artt. 15 e 20 GDPR. Solo cliente: per il professionista mancano ancora
          le tabelle del profilo di lavoro, e mezzo export non si consegna. */}
      {!isPro && <EsportaDati />}
    </div>
  );
}
