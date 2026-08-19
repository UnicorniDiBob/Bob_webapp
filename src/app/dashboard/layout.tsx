import type { ReactNode } from "react";
import { DashboardShell } from "@/components/DashboardShell";

// Il guscio avvolge tutte le sezioni di /dashboard/*: intestazione una volta
// sola, navigazione una volta sola. Le pagine dentro si occupano solo del
// proprio contenuto. La scelta fra navigazione da professionista e da cliente
// avviene nel guscio, che e' client-side perche' il ruolo arriva da useAuth.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
