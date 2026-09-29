import type { ComponentType } from "react";
import type { IdVersione, PubblicoTermini } from "@/lib/termini/registro";
import { TerminiV1 } from "@/components/termini/TerminiV1";
import { TerminiV2 } from "@/components/termini/TerminiV2";

// Un testo per ogni versione del registro. Il tipo Record<IdVersione, ...> e'
// il controllo: una versione aggiunta a ID_VERSIONI senza il suo testo non
// compila. Un componente serve entrambi i pubblici, come faceva TermsContent.
export const TESTI: Record<IdVersione, ComponentType<{ audience: PubblicoTermini }>> = {
  "2026-07-v1": TerminiV1,
  "2026-09-v2": TerminiV2,
};
