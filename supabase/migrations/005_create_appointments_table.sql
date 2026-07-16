-- BACKFILLED 2026-07-16: applied live on 2026-06-03, recovered verbatim from
-- supabase_migrations.schema_migrations. Historical record — do not edit.

-- Tabella appuntamenti: gestiti dal professionista.
create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  request_id uuid references public.requests(id) on delete set null,
  customer_name text not null,
  title text,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  price numeric check (price is null or price >= 0),
  status text not null default 'confirmed' check (status = any (array['confirmed'::text,'completed'::text,'cancelled'::text])),
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_appointments_pro on public.appointments(professional_id);
create index if not exists idx_appointments_starts on public.appointments(starts_at);

alter table public.appointments enable row level security;

-- Il professionista gestisce SOLO i propri appuntamenti (lettura + scrittura completa).
create policy "Pro reads own appointments" on public.appointments
  for select using (
    professional_id in (select id from public.professionals where user_id = auth.uid())
  );
create policy "Pro inserts own appointments" on public.appointments
  for insert with check (
    professional_id in (select id from public.professionals where user_id = auth.uid())
  );
create policy "Pro updates own appointments" on public.appointments
  for update using (
    professional_id in (select id from public.professionals where user_id = auth.uid())
  ) with check (
    professional_id in (select id from public.professionals where user_id = auth.uid())
  );
create policy "Pro deletes own appointments" on public.appointments
  for delete using (
    professional_id in (select id from public.professionals where user_id = auth.uid())
  );
