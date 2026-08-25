import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rotte che non esistono per chi non e' autenticato. /admin NON sta qui: ha un
 * controllo suo piu' sotto, che oltre alla sessione guarda anche il ruolo.
 */
const ROTTE_PRIVATE = ["/dashboard", "/messaggi", "/impostazioni"];

// Middleware: aggiorna i cookie di sessione Supabase su ogni richiesta
// così la sessione utente resta valida tra Server Components e client.
// Protegge anche le rotte /admin/* in modo che solo admin e cs possano accedervi,
// e le rotte dell'area personale in modo che un visitatore non autenticato non
// le veda affatto.
//
// PERCHE' LA GUARDIA STA QUI E NON SOLO NELLE PAGINE
// /dashboard, /messaggi e le sezioni di /impostazioni sono componenti client che
// si difendono da sole con un router.replace("/login") dentro un useEffect. Non
// e' una falla sui DATI — quelli li protegge la RLS, riga per riga, e senza
// sessione non ne esce nessuno — ma succede DOPO che il browser ha scaricato e
// montato la pagina: per un istante un visitatore non autenticato vede il guscio
// dell'area personale, e qualunque cosa venisse resa dal server domani non
// sarebbe protetta da niente. Il controllo qui costa zero: getUser() viene
// chiamata su ogni richiesta comunque, per tenere freschi i cookie di sessione,
// e finora il suo risultato veniva buttato via tranne che su /admin.
//
// COSA NON FA, DI PROPOSITO: non smista per ruolo. Mandare un admin su /admin o
// un cliente sulla sua home richiede di leggere users.role, cioe' un giro in
// piu' nel database su OGNI richiesta. Quel lavoro resta dove e' oggi, nelle
// pagine: la guardia server-side risponde a "sei autenticato?", non a "chi sei".
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Area personale: serve una sessione, e basta quella. Il returnTo ricalca la
  // convenzione che le pagine usano gia' (/login?returnTo=/impostazioni/dati),
  // cosi' dopo il login si torna dove si stava andando invece che su /dashboard.
  // Il confronto e' "uguale al prefisso oppure prefisso + /", non un
  // startsWith secco: /messaggi-pubblici non deve finire dentro /messaggi.
  if (
    !user &&
    ROTTE_PRIVATE.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // Protezione rotte admin: solo utenti con ruolo admin o cs possono accedere a /admin/*
  if (pathname.startsWith("/admin")) {
    if (!user) {
      // Non autenticato → rimanda al login
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Controlla il ruolo nella tabella users
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = userRow?.role;
    if (role !== "admin" && role !== "cs") {
      // Autenticato ma non autorizzato → rimanda alla home
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
