"use client";

// Bottone di eliminazione utente con dialog di conferma.
// Visibile solo agli admin (il controllo vero è lato server nell'API).

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteUserButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Errore nell'eliminazione");
      } else {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
      >
        Elimina
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-bob-ink">
              Eliminare {userName}?
            </h2>
            <p className="mb-4 text-sm text-bob-ink/60">
              L&apos;account e tutti i dati collegati (profilo, richieste,
              valutazioni) verranno eliminati definitivamente. Questa azione
              non è reversibile.
            </p>

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-black/10 py-2.5 text-sm font-medium text-bob-ink/70 hover:bg-black/[0.03]"
              >
                Annulla
              </button>
              <button
                onClick={remove}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Elimino…" : "Elimina definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
