// Coda dell'assistenza. Fetch lato server; la risposta e il cambio di stato
// stanno nel componente client, come per le altre pagine admin.
//
// La coda esiste perche' senza di lei i ticket sarebbero in sola scrittura, e
// un form che raccoglie richieste che nessuno legge e' peggio di non avere il
// form: fa aspettare una risposta che non arrivera'.

import { createClient } from "@/lib/supabase/server";
import { CodaAssistenza, type TicketAdmin } from "./CodaAssistenza";

export const revalidate = 0;

export default async function AdminAssistenzaPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("support_tickets")
    .select(
      "id, ref, user_id, email, category, subject, message, status, staff_reply, staff_reply_at, created_at"
    )
    // Prima le aperte e le piu' vecchie dentro ciascun gruppo: la coda si
    // svuota dal fondo, non dalla cima.
    .order("created_at", { ascending: true });

  const tickets = (data ?? []) as TicketAdmin[];
  const aperti = tickets.filter(
    (t) => t.status === "nuovo" || t.status === "in_lavorazione"
  );
  const chiusi = tickets
    .filter((t) => t.status === "risposto" || t.status === "chiuso")
    .reverse();

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-bob-ink">
          Assistenza
        </h1>
        <p className="mt-1 text-sm text-bob-ink/60">
          {aperti.length === 0
            ? "Nessuna richiesta aperta."
            : `${aperti.length} richiest${aperti.length === 1 ? "a" : "e"} da lavorare, la più vecchia per prima.`}
        </p>
      </header>
      <CodaAssistenza aperti={aperti} chiusi={chiusi} />
    </div>
  );
}
