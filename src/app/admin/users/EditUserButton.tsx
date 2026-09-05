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

  // IL NOME NON PUO' RESTARE VUOTO (05/09). Non e' pignoleria di forma: un
  // full_name vuoto faceva lanciare l'iniziale in /admin/users e portava giu'
  // tutta la pagina — l'unica da cui si sarebbe potuto rimediare. Il controllo
  // sta in tre punti perche' tre sono le porte: qui il bottone, sotto il
  // required del campo, e nella PATCH, che e' l'unica che nessuno puo'
  // aggirare.
  const nomePulito = name.trim().replace(/\s+/g, " ");
  const nomeVuoto = nomePulito.length === 0;

  async function save() {
    if (nomeVuoto) {
      setError("Il nome non puo' restare vuoto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: nomePulito, phone, about }),
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
                <label className="label-bob" htmlFor="edit-user-name">
                  Nome e cognome
                </label>
                <input
                  id="edit-user-name"
                  className="input-bob"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome Cognome"
                  required
                  aria-invalid={nomeVuoto}
                />
                {nomeVuoto && (
                  <p className="mt-1 text-xs text-red-600">
                    Serve un nome: senza, l&apos;elenco utenti non si apre più.
                  </p>
                )}
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
                disabled={saving || nomeVuoto}
                className="btn-primary flex-1 py-2.5 disabled:opacity-50"
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
