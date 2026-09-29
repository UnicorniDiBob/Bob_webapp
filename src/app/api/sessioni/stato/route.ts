import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { barattolo } from "@/lib/sessioni/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/sessioni/stato — chi e' attivo e chi e' in attesa, per il selettore.
// Chi e' attivo lo dice il punto unico (createClient di lib/supabase/server);
// dell'account in attesa si restituisce SOLO l'email e se va riconnesso:
// bob-attesa e' httpOnly, e il suo refresh token non esce mai dal server.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const attesa = barattolo().attesa();
  return NextResponse.json(
    {
      attivo: user ? { email: user.email ?? "" } : null,
      attesa: attesa ? { email: attesa.email, daRiconnettere: attesa.refreshToken === null } : null,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
