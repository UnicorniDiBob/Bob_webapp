import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Middleware: aggiorna i cookie di sessione Supabase su ogni richiesta
// così la sessione utente resta valida tra Server Components e client.
// Protegge anche le rotte /admin/* in modo che solo admin e cs possano accedervi.
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

  // Protezione rotte admin: solo utenti con ruolo admin o cs possono accedere a /admin/*
  if (request.nextUrl.pathname.startsWith("/admin")) {
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
