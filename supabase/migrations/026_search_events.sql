-- 026: eventi di ricerca anonimi per l'analisi keyword/categorie.
--
-- Perché: la pagina admin "Analisi" deve mostrare quante volte le categorie
-- (elettricista, idraulico, giardiniere, …) vengono cercate e richieste
-- nella webapp.
--
-- Privacy by design: la tabella NON contiene user_id né testo libero —
-- solo lo slug della categoria riconosciuta, lo slug della città e il
-- timestamp. Non è dato personale (nessun soggetto identificabile), quindi
-- non tocca consensi/GDPR. Il testo libero digitato in chat non viene mai
-- copiato qui.
--
-- Alimentazione automatica via trigger:
-- - job_briefs (source 'brief'): ogni chat Bob completata = una "ricerca".
-- - requests (source 'richiesta'): ogni richiesta creata.
-- Backfill una tantum dalle righe già esistenti (guardato: gira solo a
-- tabella vuota, quindi la migration resta idempotente).

create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('brief', 'richiesta')),
  service_slug text,
  subservice_slug text,
  city_slug text,
  created_at timestamptz not null default now()
);

alter table public.search_events enable row level security;

create index if not exists search_events_created_at_idx
  on public.search_events (created_at);
create index if not exists search_events_service_idx
  on public.search_events (service_slug);

-- Lettura riservata a staff; nessuna policy di insert pubblica (scrivono
-- solo i trigger, security definer).
drop policy if exists "Staff reads search events" on public.search_events;
create policy "Staff reads search events" on public.search_events
  for select using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.role in ('admin', 'cs')
    )
  );

create or replace function public.log_brief_search_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.search_events (source, service_slug, subservice_slug, city_slug, created_at)
  values ('brief', new.service_slug, new.subtask_slug, new.city_slug, coalesce(new.created_at, now()));
  return new;
end;
$$;

drop trigger if exists on_job_brief_search_event on public.job_briefs;
create trigger on_job_brief_search_event
  after insert on public.job_briefs
  for each row execute function public.log_brief_search_event();

create or replace function public.log_request_search_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.search_events (source, service_slug, subservice_slug, city_slug, created_at)
  select 'richiesta', s.slug, ss.slug, c.slug, coalesce(new.created_at, now())
  from (select 1) as one
  left join public.services s on s.id = new.service_id
  left join public.subservices ss on ss.id = new.subservice_id
  left join public.cities c on c.id = new.city_id;
  return new;
end;
$$;

drop trigger if exists on_request_search_event on public.requests;
create trigger on_request_search_event
  after insert on public.requests
  for each row execute function public.log_request_search_event();

-- Backfill una tantum dai dati esistenti (solo se la tabella è vuota).
do $$
begin
  if not exists (select 1 from public.search_events) then
    insert into public.search_events (source, service_slug, subservice_slug, city_slug, created_at)
    select 'brief', b.service_slug, b.subtask_slug, b.city_slug, coalesce(b.created_at, now())
    from public.job_briefs b;

    insert into public.search_events (source, service_slug, subservice_slug, city_slug, created_at)
    select 'richiesta', s.slug, ss.slug, c.slug, coalesce(r.created_at, now())
    from public.requests r
    left join public.services s on s.id = r.service_id
    left join public.subservices ss on ss.id = r.subservice_id
    left join public.cities c on c.id = r.city_id;
  end if;
end $$;
