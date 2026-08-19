"use client";

// Sezione "Indirizzi" (cliente): dove ti raggiungono i professionisti.
//
// Era il terzo blocco della vecchia /dashboard/account, sotto nome e email.
// Sta da solo perche' e' l'unico dato dell'account che cambia spesso — casa,
// ufficio, casa dei genitori — e perche' e' il dato piu' sensibile che il
// cliente ci affida: la consegna e' progressiva (migrazioni 044-046), cioe'
// l'indirizzo esatto arriva al professionista solo dopo che il cliente lo ha
// scelto. Vale la pena che sia scritto dove il cliente lo inserisce.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { SectionHeader } from "@/components/ImpostazioniShell";
import { SectionSkeleton, SectionError } from "@/components/SectionStates";

interface CityOption {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface SavedAddress {
  id: string;
  label: string;
  address_line: string;
  city_slug: string | null;
  is_default: boolean;
}

export default function IndirizziPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();

  const [cities, setCities] = useState<CityOption[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [booted, setBooted] = useState(false);
  const [failed, setFailed] = useState(false);

  const [addrLabel, setAddrLabel] = useState("Casa");
  const [addrLine, setAddrLine] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?returnTo=/impostazioni/indirizzi");
    else if (role === "professional") router.replace("/impostazioni/azienda");
  }, [authLoading, user, role, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);
    const [{ data: addr, error: aErr }, { data: cs }] = await Promise.all([
      supabase
        .from("customer_addresses")
        .select("id,label,address_line,city_slug,is_default")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase.from("cities").select("id,name,slug,status").order("name"),
    ]);
    if (aErr) {
      setFailed(true);
      setBooted(true);
      return;
    }
    setAddresses((addr as SavedAddress[]) ?? []);
    setCities((cs as CityOption[]) ?? []);
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (authLoading || !user || role === "professional") return;
    load();
  }, [authLoading, user, role, load]);

  async function aggiungi(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving) return;
    setErr(null);
    const line = addrLine.trim();
    if (line.length < 5) {
      setErr("Scrivi l'indirizzo, con via e numero civico.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("customer_addresses").insert({
      user_id: user.id,
      label: addrLabel.trim() || "Casa",
      address_line: line,
      city_slug: addrCity || null,
      is_default: addresses.length === 0, // il primo diventa predefinito
    });
    if (error) setErr("Non sono riuscito a salvare l'indirizzo. Riprova.");
    else {
      setAddrLine("");
      setAddrLabel("Casa");
      setAddrCity("");
      await load();
    }
    setSaving(false);
  }

  async function rendiPredefinito(id: string) {
    // Prima azzera il vecchio, poi imposta il nuovo: l'indice unico parziale
    // ammette un solo predefinito per utente.
    await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("user_id", user!.id)
      .eq("is_default", true);
    await supabase
      .from("customer_addresses")
      .update({ is_default: true })
      .eq("id", id);
    await load();
  }

  async function elimina(id: string) {
    const eraPredefinito = addresses.find((a) => a.id === id)?.is_default;
    await supabase.from("customer_addresses").delete().eq("id", id);
    if (eraPredefinito) {
      const prossimo = addresses.find((a) => a.id !== id);
      if (prossimo)
        await supabase
          .from("customer_addresses")
          .update({ is_default: true })
          .eq("id", prossimo.id);
    }
    await load();
  }

  if (authLoading || !booted) return <SectionSkeleton rows={2} />;
  if (failed) return <SectionError onRetry={load} />;

  const nomeCitta = (slug: string | null) =>
    cities.find((c) => c.slug === slug)?.name ?? null;

  return (
    <div>
      <SectionHeader title="I tuoi indirizzi">
        Bob li propone quando cerchi un professionista, partendo dal
        predefinito. Il professionista vede la zona subito e l&apos;indirizzo
        esatto solo dopo che l&apos;hai scelto.
      </SectionHeader>

      <div className="card p-5 sm:p-6">
        {addresses.length === 0 ? (
          <p className="text-sm text-bob-ink/55" data-testid="indirizzi-vuoti">
            Non hai ancora salvato nessun indirizzo. Puoi aggiungerne uno qui
            sotto, oppure lasciarlo per quando servirà: Bob te lo chiede in chat
            al momento giusto.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {addresses.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 bg-black/[0.015] px-3.5 py-2.5"
                data-testid={`address-${a.id}`}
              >
                <MapPin
                  className="h-4 w-4 shrink-0 text-bob-ink/40"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-bob-ink">
                    {a.label}
                    {a.is_default && (
                      <span className="ml-2 rounded-full bg-bob-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-bob-indigo">
                        Predefinito
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-bob-ink/60">
                    {a.address_line}
                    {nomeCitta(a.city_slug) ? ` · ${nomeCitta(a.city_slug)}` : ""}
                  </p>
                </div>
                {!a.is_default && (
                  <button
                    onClick={() => rendiPredefinito(a.id)}
                    className="text-xs font-medium text-bob-indigo hover:underline"
                    data-testid={`address-default-${a.id}`}
                  >
                    Usa come predefinito
                  </button>
                )}
                <button
                  onClick={() => elimina(a.id)}
                  className="rounded-lg px-2 py-1 text-xs text-bob-ink/40 hover:bg-black/5 hover:text-red-600"
                  aria-label={`Elimina ${a.label}`}
                  data-testid={`address-delete-${a.id}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={aggiungi}
          className="mt-4 rounded-xl bg-bob-indigo-50/50 p-4"
        >
          <p className="text-xs font-semibold text-bob-ink/60">
            Aggiungi un indirizzo
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[110px_1fr_150px]">
            <input
              value={addrLabel}
              onChange={(e) => setAddrLabel(e.target.value)}
              placeholder="Etichetta"
              aria-label="Etichetta dell'indirizzo"
              className="input-bob py-2.5"
              data-testid="input-address-label"
            />
            <input
              value={addrLine}
              onChange={(e) => setAddrLine(e.target.value)}
              placeholder="Via e numero civico"
              aria-label="Via e numero civico"
              className="input-bob py-2.5"
              autoComplete="street-address"
              data-testid="input-address-line"
            />
            <select
              value={addrCity}
              onChange={(e) => setAddrCity(e.target.value)}
              aria-label="Città"
              className="input-bob py-2.5"
              data-testid="select-address-city"
            >
              <option value="">Città…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                  {c.status !== "active" ? " (lista d'attesa)" : ""}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={saving || !addrLine.trim()}
            className="btn-secondary mt-3 py-2 text-sm"
            data-testid="button-add-address"
          >
            {saving ? "Salvo…" : "+ Salva indirizzo"}
          </button>
        </form>
      </div>
    </div>
  );
}
