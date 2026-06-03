"use client";

import { createBrowserClient } from "@supabase/ssr";

// Client Supabase lato browser (componenti client, login, mutazioni utente).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
