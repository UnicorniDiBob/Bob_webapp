"use client";

// ACCOUNT IN QUESTO BROWSER (29/09, sessioni multiple): l'interfaccia minima
// per provare lo scambio senza aspettare il selettore nell'intestazione, che e'
// di Andre' e partira' da una sua PR. Chi e' attivo, chi e' in attesa, e i tre
// gesti: passa all'altro, esci da questo (l'altro diventa attivo), esci da
// tutti (tutti e due, in questo browser). La logica sta in lib/sessioni.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  esciAccount,
  leggiStatoSessioni,
  scambiaAccount,
  type StatoSessioni,
} from "@/lib/sessioni/client";

export function AccountInQuestoBrowser() {
  const supabase = useMemo(() => createClient(), []);
  const [stato, setStato] = useState<StatoSessioni | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    leggiStatoSessioni().then(setStato);
  }, []);

  async function passa() {
    setInCorso(true);
    setErrore(null);
    const r = await scambiaAccount(supabase);
    if (!r.ok) {
      setInCorso(false);
      setErrore(
        r.motivo === "da_riconnettere"
          ? `L'account ${r.email ?? ""} va riconnesso: la sua sessione non vale più. Resti su quello di adesso.`
          : "Non sono riuscito a cambiare account. Resti su quello di adesso."
      );
      setStato(await leggiStatoSessioni());
    }
  }

  async function esci(quale: "questo" | "tutti") {
    setInCorso(true);
    setErrore(null);
    const ok = await esciAccount(supabase, quale);
    if (!ok) {
      setInCorso(false);
      setErrore("Non sono riuscito a farti uscire. Riprova.");
    }
  }

  if (!stato) return null;

  return (
    <section className="card p-5 sm:p-6" data-testid="account-in-questo-browser">
      <h3 className="text-sm font-semibold text-bob-ink">Account in questo browser</h3>
      <p className="mt-1.5 text-sm text-bob-ink/70">
        {"Puoi restare connesso a due account e passare dall'uno all'altro senza rifare il login. Ne guardi uno alla volta, in tutte le schede."}
      </p>

      <ul className="mt-3 space-y-2 text-sm">
        <li className="flex flex-wrap items-center gap-2 rounded-xl bg-black/[0.025] px-3.5 py-2.5">
          <span className="font-medium text-bob-ink">{stato.attivo?.email ?? "—"}</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">attivo</span>
        </li>
        {stato.attesa && (
          <li className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 px-3.5 py-2.5" data-testid="account-in-attesa">
            <span className="font-medium text-bob-ink">{stato.attesa.email}</span>
            {stato.attesa.daRiconnettere ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">da riconnettere</span>
            ) : (
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-bob-ink/70">in attesa</span>
            )}
          </li>
        )}
      </ul>

      {errore && (
        <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {errore}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {stato.attesa && !stato.attesa.daRiconnettere && (
          <button onClick={passa} disabled={inCorso} className="btn-primary py-2 text-sm" data-testid="button-passa-account">
            {`Passa a ${stato.attesa.email}`}
          </button>
        )}
        {stato.attesa && (
          <button onClick={() => esci("questo")} disabled={inCorso} className="btn-secondary py-2 text-sm" data-testid="button-esci-questo">
            {"Esci da questo account"}
          </button>
        )}
        <button onClick={() => esci("tutti")} disabled={inCorso} className="btn-ghost py-2 text-sm" data-testid="button-esci-tutti">
          {stato.attesa ? "Esci da tutti e due" : "Esci"}
        </button>
      </div>

      {!stato.attesa && (
        <p className="mt-3 text-xs text-bob-ink/65">
          {"Aggiungere un secondo account da qui arriva a breve. Uscire vale solo per questo browser: gli altri dispositivi restano connessi."}
        </p>
      )}
      {stato.attesa && (
        <p className="mt-3 text-xs text-bob-ink/65">
          {"«Esci da questo account» ti fa uscire da quello attivo e passa all'altro. Uscire vale solo per questo browser: gli altri dispositivi restano connessi."}
        </p>
      )}
    </section>
  );
}
