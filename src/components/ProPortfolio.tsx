"use client";

// Portfolio lavori del professionista (dashboard pro).
// Free = 1 foto, Bob Plus e Bob Business = illimitate (dal 01/10).
// Il limite è applicato anche lato DB (trigger portfolio_limit_trigger,
// funzione portfolio_limit: migrazione 105).

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { pianoById } from "@/lib/piani";
import {
  PORTFOLIO_LIMITS,
  type PortfolioItem,
  type SubscriptionTier,
} from "@/lib/supabase/types";

export function ProPortfolio({
  professionalId,
  userId,
  tier,
}: {
  professionalId: string;
  userId: string;
  tier: SubscriptionTier;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const limit = PORTFOLIO_LIMITS[tier];
  const canUpload = limit === null || items.length < limit;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("professional_id", professionalId)
        .order("created_at", { ascending: false });
      setItems((data ?? []) as PortfolioItem[]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from("portfolio")
        .getPublicUrl(path);

      const { data: row, error: insErr } = await supabase
        .from("portfolio_items")
        .insert({
          professional_id: professionalId,
          title: title.trim(),
          description: description.trim() || null,
          image_url: pub.publicUrl,
        })
        .select()
        .single();
      if (insErr) {
        // Rollback dello storage se l'insert fallisce (es. limite raggiunto)
        await supabase.storage.from("portfolio").remove([path]);
        throw insErr;
      }

      setItems((prev) => [row as PortfolioItem, ...prev]);
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFormOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.includes("portfolio_limit_reached")
          ? "Hai raggiunto il numero massimo di foto per il tuo piano."
          : "Errore durante il caricamento. Riprova."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: PortfolioItem) {
    if (!confirm("Eliminare questa foto dal portfolio?")) return;
    const { error: delErr } = await supabase
      .from("portfolio_items")
      .delete()
      .eq("id", item.id);
    if (!delErr) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      // Rimuovi anche il file dallo storage (best effort)
      const idx = item.image_url.indexOf("/portfolio/");
      if (idx >= 0) {
        const path = item.image_url.slice(idx + "/portfolio/".length);
        await supabase.storage.from("portfolio").remove([path]);
      }
    }
  }

  return (
    <div className="card p-5" data-testid="pro-portfolio">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-bob-ink">
            Portfolio lavori
          </h2>
          <p className="text-xs text-bob-ink/70">
            Piano {pianoById(tier).nome} ·{" "}
            {limit === null
              ? `${items.length} foto (illimitate)`
              : `${items.length}/${limit} foto`}
          </p>
        </div>
        {canUpload ? (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="btn-secondary px-4 py-2 text-sm"
            data-testid="button-add-portfolio"
          >
            {formOpen ? "Annulla" : "+ Aggiungi lavoro"}
          </button>
        ) : (
          <span className="text-xs text-bob-ink/65">
            Limite raggiunto —{" "}
            <a href="/impostazioni/piano" className="text-bob-indigo underline">
              passa a Bob Plus
            </a>{" "}
            per foto illimitate
          </span>
        )}
      </div>

      {formOpen && canUpload && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-col gap-3 rounded-xl border border-black/5 bg-black/[0.02] p-4"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titolo del lavoro (es. Rifacimento bagno completo)"
            className="rounded-lg border border-black/10 px-3 py-2 text-sm"
            maxLength={80}
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrizione: cosa hai fatto, tempi, materiali…"
            className="rounded-lg border border-black/10 px-3 py-2 text-sm"
            rows={3}
            maxLength={500}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || !file || !title.trim()}
            className="btn-primary self-start px-5 py-2 text-sm disabled:opacity-50"
          >
            {saving ? "Caricamento…" : "Pubblica nel portfolio"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-black/[0.03]" />
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-bob-ink/65">
          Nessuna foto ancora. Aggiungi i tuoi lavori migliori: verranno
          mostrati sul tuo profilo pubblico.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="group relative overflow-hidden rounded-xl border border-black/5"
              data-testid={`portfolio-${item.id}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url}
                alt={item.title}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="p-2.5">
                <p className="truncate text-xs font-semibold text-bob-ink">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-0.5 line-clamp-2 text-2xs text-bob-ink/70">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(item)}
                className="absolute right-2 top-2 hidden rounded-full bg-white/90 px-2 py-1 text-xs text-red-600 shadow group-hover:block"
                aria-label="Elimina foto"
              >
                Elimina
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
