import type { ReactNode } from "react";
import { ImpostazioniShell } from "@/components/ImpostazioniShell";

// Il guscio avvolge tutte le sezioni di /impostazioni/*: intestazione una volta
// sola, navigazione una volta sola, e in cima il ritorno all'area di lavoro.
// Le pagine dentro si occupano solo del proprio contenuto. La scelta fra
// navigazione da professionista e da cliente avviene nel guscio, che e'
// client-side perche' il ruolo arriva da useAuth.
export default function ImpostazioniLayout({ children }: { children: ReactNode }) {
  return <ImpostazioniShell>{children}</ImpostazioniShell>;
}
