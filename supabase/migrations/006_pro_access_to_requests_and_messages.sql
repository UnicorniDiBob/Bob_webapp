-- BACKFILLED 2026-07-16: applied live on 2026-06-03, recovered verbatim from
-- supabase_migrations.schema_migrations. Historical record — do not edit.

-- Funzione helper: id dei professionisti collegati all'utente corrente.
create or replace function public.my_professional_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.professionals where user_id = auth.uid();
$$;

-- Il professionista legge le richieste in cui è coinvolto.
drop policy if exists "Pro reads assigned requests" on public.requests;
create policy "Pro reads assigned requests" on public.requests
  for select using (
    id in (
      select request_id from public.request_professionals
      where professional_id in (select public.my_professional_ids())
    )
  );

-- Il professionista legge le righe request_professionals a lui destinate.
drop policy if exists "Pro reads own assignments" on public.request_professionals;
create policy "Pro reads own assignments" on public.request_professionals
  for select using (
    professional_id in (select public.my_professional_ids())
  );

-- Il professionista può aggiornare lo stato delle proprie assegnazioni (es. responded/quoted).
drop policy if exists "Pro updates own assignments" on public.request_professionals;
create policy "Pro updates own assignments" on public.request_professionals
  for update using (
    professional_id in (select public.my_professional_ids())
  ) with check (
    professional_id in (select public.my_professional_ids())
  );

-- Il professionista legge i messaggi delle richieste in cui è coinvolto.
drop policy if exists "Pro reads assigned messages" on public.request_messages;
create policy "Pro reads assigned messages" on public.request_messages
  for select using (
    request_id in (
      select request_id from public.request_professionals
      where professional_id in (select public.my_professional_ids())
    )
  );

-- Il professionista può inviare messaggi nelle richieste in cui è coinvolto.
drop policy if exists "Pro inserts assigned messages" on public.request_messages;
create policy "Pro inserts assigned messages" on public.request_messages
  for insert with check (
    sender_id = auth.uid()
    and request_id in (
      select request_id from public.request_professionals
      where professional_id in (select public.my_professional_ids())
    )
  );
