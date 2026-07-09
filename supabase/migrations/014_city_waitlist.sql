-- 014: Lista d'attesa per le città non ancora attive (Roma, Torino, …).
-- L'homepage promette "lascia il tuo interesse": questa tabella lo rende vero.
-- Le email alimentano la lista di lancio città per città.
--
-- Sicurezza: nessuna policy pubblica. Scrittura e lettura passano SOLO dal
-- service role (route /api/waitlist), così la tabella non è enumerabile
-- dal client anon e le email non sono esposte.

create table if not exists public.city_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  city_slug text not null,
  -- consenso esplicito registrato al momento dell'iscrizione (GDPR)
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- una sola iscrizione per email/città: il doppio submit non è un errore
  constraint city_waitlist_email_city_unique unique (email, city_slug)
);

comment on table public.city_waitlist is
  'Email lasciate volontariamente per essere avvisati quando BOB apre in una città. Solo service role.';

alter table public.city_waitlist enable row level security;
-- Nessuna policy: anon e authenticated non leggono né scrivono.
