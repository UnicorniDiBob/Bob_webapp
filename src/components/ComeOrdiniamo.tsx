import Link from "next/link";

/**
 * Il rimando ai parametri di posizionamento, sotto ogni elenco di
 * professionisti.
 *
 * PERCHÉ UN LINK E NON I CRITERI IN PAGINA. L'art. 22 comma 4-bis del
 * Codice del Consumo — che recepisce l'art. 7(4-bis) della direttiva
 * 2005/29 — chiede che i parametri principali di posizionamento e la loro
 * importanza relativa stiano «in una sezione specifica dell'interfaccia
 * online, direttamente e facilmente accessibile dalla pagina in cui sono
 * presentati i risultati». Un link a una sezione dedicata È il meccanismo che
 * la norma descrive, non un modo di aggirarla — a tre condizioni: che la
 * sezione esista davvero, che si raggiunga DA DOVE si vedono i risultati (non
 * solo dal fondo del sito), e che l'etichetta dica di che si tratta.
 *
 * PERCHÉ UN COMPONENTE E NON QUATTRO RIGHE UGUALI. Il giorno in cui cambia il
 * modo di ordinare — e il primo slot sponsorizzato lo cambierà — va cambiato
 * dappertutto insieme. Quattro copie a mano sono quattro occasioni per
 * dimenticarne una, e una pagina rimasta indietro dichiara il falso.
 *
 * QUELLO CHE UN LINK NON PUÒ FARE: dire che un risultato è a pagamento.
 * L'allegato I punto 11-bis della 2005/29 è una pratica sleale IN SÉ e
 * pretende la dichiarazione dentro i risultati. Quando arriveranno gli slot
 * sponsorizzati, l'etichetta va sulla scheda — qui non basta.
 */
export function ComeOrdiniamo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/come-funziona#ordine"
      className={`text-xs text-bob-ink/50 underline-offset-2 hover:text-bob-ink/75 hover:underline ${className}`}
      data-testid="link-come-ordiniamo"
    >
      Come ordiniamo i risultati
    </Link>
  );
}
