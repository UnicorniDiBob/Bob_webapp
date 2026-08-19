// Pagina server sottile: serve solo a leggere se la pipeline email e' accesa.
//
// emailEnabled() guarda RESEND_API_KEY, che e' una variabile server e non deve
// diventare NEXT_PUBLIC_ per finire nel bundle del browser. Quindi la lettura
// avviene qui e il valore scende come prop nel componente client. Il vantaggio
// e' che l'avviso "le email non partono ancora" non ha bisogno di essere
// ricordato a mano: il giorno in cui la chiave arriva, sparisce da solo.

import { emailEnabled } from "@/lib/email";
import { ComunicazioniForm } from "@/components/ComunicazioniForm";

export default function ComunicazioniPage() {
  return <ComunicazioniForm emailAttive={emailEnabled()} />;
}
