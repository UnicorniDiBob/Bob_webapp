"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditUserButton({
  userId,
  currentName,
  currentPhone,
  currentAbout,
}: {
  userId: string;
  currentName: string;
  currentPhone: string;
  currentAbout: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone);
  const [about, setAbout] = useState(currentAbout);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name, phone, about }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Errore nel salvataggio");
      } else {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-xl border border-black/10 px-3 py-1.5 text-xs font-medium text-bob-ink/60 hover:border-bob-indigo/30 hover:text-bob-indigo"
      >
        Modifica
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-bob-ink">
              Modifica profilo
            </h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label-bob">Nome e cognome</label>
                <input
                  className="input-bob"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome Cognome"
                />
              </div>
              <div>
                <label className="label-bob">Telefono</label>
                <input
                  className="input-bob"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+39 000 000 0000"
                />
              </div>
              <div>
                <label className="label-bob">Bio / Note</label>
                <textarea
                  className="input-bob min-h-[80px] resize-y"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Descrizione breve dell'utente…"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="btn-primary flex-1 py-2.5"
              >
                {saving ? "Salvo…" : "Salva modifiche"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="btn-secondary flex-1 py-2.5"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
