-- 051: il telefono del pro esce da profiles, in una tabella con RLS propria.
--
-- PERCHE'.
-- La 050 aveva provato con un revoke a livello di colonna
-- (`revoke select (phone) on public.profiles from anon`) — verificato
-- INEFFICACE il 14/08: anon e authenticated hanno comunque il GRANT SELECT
-- sull'intera tabella profiles (default Supabase, la sicurezza vera è
-- delegata alla RLS), e Postgres controlla prima il privilegio di tabella.
-- Un revoke sulla singola colonna non toglie nulla finché resta il grant
-- più ampio sopra. Peggio di quanto scritto nella roadmap: la policy
-- "Public reads professional profile names" (migration 003) vale per
-- {anon, authenticated}, quindi anche un cliente loggato vedeva il
-- telefono di qualsiasi pro, non solo un visitatore anonimo.
--
-- E' lo stesso identico problema già risolto una volta nella 027 per
-- date_of_birth e terms_accepted_at (spostati in profile_private). Qui si
-- ripete lo stesso rimedio ma in una tabella propria, non in profile_private:
-- il telefono deve restare modificabile da staff admin/cs in caso di errore
-- o richiesta (oggi via /api/admin/users/[id]), mentre profile_private per
-- design ha "nessuna policy di insert/update: scrive solo il trigger" — non
-- va indebolita per far posto a un campo con esigenze diverse.
--
-- Idempotente: create if not exists, drop-then-create per le policy,
-- upsert per il backfill, drop column if exists.

create table if not exists public.profile_phone (
  user_id uuid primary key references public.users (id) on delete cascade,
  phone text,
  updated_at timestamptz not null default now()
);

alter table public.profile_phone enable row level security;

drop policy if exists "User reads own phone" on public.profile_phone;
create policy "User reads own phone" on public.profile_phone
  for select using (user_id = (select auth.uid()));

drop policy if exists "User inserts own phone" on public.profile_phone;
create policy "User inserts own phone" on public.profile_phone
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "User updates own phone" on public.profile_phone;
create policy "User updates own phone" on public.profile_phone
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Staff reads phones" on public.profile_phone;
create policy "Staff reads phones" on public.profile_phone
  for select using (private.is_admin_or_cs());

drop policy if exists "Staff inserts phones" on public.profile_phone;
create policy "Staff inserts phones" on public.profile_phone
  for insert with check (private.is_admin_or_cs());

drop policy if exists "Staff updates phones" on public.profile_phone;
create policy "Staff updates phones" on public.profile_phone
  for update using (private.is_admin_or_cs())
  with check (private.is_admin_or_cs());

-- Migra i dati esistenti prima di eliminare la colonna. on conflict perche'
-- rilanciare la migrazione (o un clone che riparte da un dump parziale)
-- non deve fallire su una riga già portata.
insert into public.profile_phone (user_id, phone, updated_at)
select p.user_id, p.phone, now()
from public.profiles p
where p.phone is not null
on conflict (user_id) do update set phone = excluded.phone, updated_at = excluded.updated_at;

-- Rimuovi la colonna esposta: profiles resta pubblico, il telefono no.
alter table public.profiles drop column if exists phone;
