-- 048: i cinque aiutanti di permesso escono dall'API pubblica.
--
-- PERCHE'.
-- is_admin(), is_admin_or_cs(), my_assigned_request_ids(), my_professional_ids()
-- e can_see_request_address() sono SECURITY DEFINER e vivono in public, quindi
-- PostgREST le pubblica come /rest/v1/rpc/*. Nessuna di loro restituisce dati
-- di altri - ognuna risponde solo sui permessi di chi chiama - ma non hanno
-- motivo di stare sulla superficie esposta, e l'advisor di sicurezza le segnala
-- dieci volte (lint 0028 e 0029).
--
-- IL RIMEDIO SUGGERITO DALL'ADVISOR QUI E' SBAGLIATO.
-- "Revoca EXECUTE" romperebbe l'applicazione: 21 policy su 11 tabelle chiamano
-- queste funzioni, e l'espressione di una policy viene valutata coi privilegi
-- di chi interroga. Togliere EXECUTE ad authenticated significa che ogni
-- SELECT di un utente autenticato su quelle tabelle falla.
--
-- Il rimedio giusto e' spostarle in uno schema non esposto. PostgREST pubblica
-- solo gli schemi elencati nelle impostazioni API (public, graphql_public):
-- una funzione in `private` non e' raggiungibile via REST, ma resta chiamabile
-- dalle policy, perche' il ruolo conserva USAGE sullo schema ed EXECUTE sulla
-- funzione.
--
-- Percio' tutto in un'unica migrazione: nuovo schema, funzioni ricreate,
-- 21 policy riscritte col nome qualificato, e solo alla fine le vecchie
-- funzioni rimosse. A meta' strada l'accesso resterebbe rotto, quindi
-- l'ordine conta.
--
-- Verificato sul clone ricostruito dai file (vedi scripts/schema_check.sh):
-- 001 -> 048 si applica senza errori, le 21 policy risultano riscritte, e in
-- public non resta nessuna funzione SECURITY DEFINER chiamabile da anon o da
-- authenticated.
--
-- Idempotente: create schema if not exists, create or replace, drop-then-create
-- per le policy, drop function if exists in coda.

-- ---------------------------------------------------------------------------
-- 1. Lo schema non esposto
-- ---------------------------------------------------------------------------
create schema if not exists private;

comment on schema private is
  'Funzioni di supporto alle policy RLS. NON aggiungere questo schema agli "Exposed schemas" delle impostazioni API: e'' esattamente il motivo per cui esiste.';

-- USAGE serve: una policy che chiama private.is_admin() viene valutata coi
-- privilegi di chi interroga, quindi quel ruolo deve poter attraversare lo
-- schema. Non e' un buco: senza uno schema esposto non c'e' endpoint REST.
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Le cinque funzioni, stesso corpo, nuova casa
-- ---------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function private.is_admin_or_cs()
returns boolean language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role in ('admin', 'cs')
  );
$$;

create or replace function private.my_professional_ids()
returns setof uuid language sql stable security definer
set search_path to 'public'
as $$
  select id from public.professionals where user_id = auth.uid();
$$;

create or replace function private.my_assigned_request_ids()
returns setof uuid language sql stable security definer
set search_path to 'public'
as $$
  select rp.request_id
  from public.request_professionals rp
  where rp.professional_id in (select id from public.professionals where user_id = auth.uid());
$$;

-- Nota: qui la chiamata interna diventa private.my_professional_ids(), non
-- public: la gemella in public viene rimossa al punto 5.
create or replace function private.can_see_request_address(p_request_id uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.appointments a
    where a.request_id = p_request_id
      and a.professional_id in (select private.my_professional_ids())
      and a.status in ('confirmed', 'completed')
  );
$$;

revoke all on function private.is_admin(), private.is_admin_or_cs(),
  private.my_professional_ids(), private.my_assigned_request_ids(),
  private.can_see_request_address(uuid) from public;
grant execute on function private.is_admin(), private.is_admin_or_cs(),
  private.my_professional_ids(), private.my_assigned_request_ids(),
  private.can_see_request_address(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Le 21 policy che le chiamano, riscritte col nome qualificato
-- ---------------------------------------------------------------------------
-- Generate dal catalogo, non a mano: stessa espressione, solo il prefisso
-- cambia. Ordine e ruoli invariati.

drop policy if exists "city_waitlist_admin_select" on public.city_waitlist;
create policy "city_waitlist_admin_select" on public.city_waitlist
  for select
  using (private.is_admin_or_cs());

drop policy if exists "Pro manages own services" on public.professional_services;
create policy "Pro manages own services" on public.professional_services
  for all
  using ((professional_id IN ( SELECT private.my_professional_ids() AS my_professional_ids)))
  with check ((professional_id IN ( SELECT private.my_professional_ids() AS my_professional_ids)));

drop policy if exists "admin_cs_select_pro_services" on public.professional_services;
create policy "admin_cs_select_pro_services" on public.professional_services
  for select
  using (private.is_admin_or_cs());

drop policy if exists "admin_cs_select_professionals" on public.professionals;
create policy "admin_cs_select_professionals" on public.professionals
  for select
  using (private.is_admin_or_cs());

drop policy if exists "admin_cs_update_professionals" on public.professionals;
create policy "admin_cs_update_professionals" on public.professionals
  for update
  using (private.is_admin_or_cs());

drop policy if exists "admin_cs_select_profiles" on public.profiles;
create policy "admin_cs_select_profiles" on public.profiles
  for select
  using (private.is_admin_or_cs());

drop policy if exists "admin_cs_update_profiles" on public.profiles;
create policy "admin_cs_update_profiles" on public.profiles
  for update
  using (private.is_admin_or_cs());

drop policy if exists "request_addresses_pro_read_after_accept" on public.request_addresses;
create policy "request_addresses_pro_read_after_accept" on public.request_addresses
  for select
  to authenticated
  using (private.can_see_request_address(request_id));

drop policy if exists "request_addresses_staff_read" on public.request_addresses;
create policy "request_addresses_staff_read" on public.request_addresses
  for select
  to authenticated
  using (private.is_admin_or_cs());

drop policy if exists "Pro inserts assigned messages" on public.request_messages;
create policy "Pro inserts assigned messages" on public.request_messages
  for insert
  with check (((sender_id = ( SELECT auth.uid() AS uid)) AND (professional_id IN ( SELECT private.my_professional_ids() AS my_professional_ids)) AND (request_id IN ( SELECT request_professionals.request_id
   FROM request_professionals
  WHERE (request_professionals.professional_id IN ( SELECT private.my_professional_ids() AS my_professional_ids))))));

drop policy if exists "Pro marks assigned request_messages read" on public.request_messages;
create policy "Pro marks assigned request_messages read" on public.request_messages
  for update
  using ((professional_id IN ( SELECT private.my_professional_ids() AS my_professional_ids)))
  with check ((professional_id IN ( SELECT private.my_professional_ids() AS my_professional_ids)));

drop policy if exists "Pro reads assigned messages" on public.request_messages;
create policy "Pro reads assigned messages" on public.request_messages
  for select
  using ((professional_id IN ( SELECT private.my_professional_ids() AS my_professional_ids)));

drop policy if exists "admin_cs_select_messages" on public.request_messages;
create policy "admin_cs_select_messages" on public.request_messages
  for select
  using (private.is_admin_or_cs());

drop policy if exists "Pro reads own assignments" on public.request_professionals;
create policy "Pro reads own assignments" on public.request_professionals
  for select
  using ((professional_id IN ( SELECT private.my_professional_ids() AS my_professional_ids)));

drop policy if exists "Pro updates own assignments" on public.request_professionals;
create policy "Pro updates own assignments" on public.request_professionals
  for update
  using ((professional_id IN ( SELECT private.my_professional_ids() AS my_professional_ids)))
  with check ((professional_id IN ( SELECT private.my_professional_ids() AS my_professional_ids)));

drop policy if exists "Pro reads assigned requests" on public.requests;
create policy "Pro reads assigned requests" on public.requests
  for select
  to authenticated
  using ((id IN ( SELECT private.my_assigned_request_ids() AS my_assigned_request_ids)));

drop policy if exists "admin_cs_select_requests" on public.requests;
create policy "admin_cs_select_requests" on public.requests
  for select
  using (private.is_admin_or_cs());

drop policy if exists "admin_cs_update_requests" on public.requests;
create policy "admin_cs_update_requests" on public.requests
  for update
  using (private.is_admin_or_cs());

drop policy if exists "admin_cs_select_users" on public.users;
create policy "admin_cs_select_users" on public.users
  for select
  using (private.is_admin_or_cs());

drop policy if exists "admin_cs_update_users" on public.users;
create policy "admin_cs_update_users" on public.users
  for update
  using (private.is_admin_or_cs());

drop policy if exists "admin_insert_users" on public.users;
create policy "admin_insert_users" on public.users
  for insert
  with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- 4. L'unico altro chiamante: il guardiano delle colonne di professionals
-- ---------------------------------------------------------------------------
-- protect_professional_columns() chiamava is_admin_or_cs() senza qualificare,
-- risolvendola in public. Con la funzione spostata, senza questa riscrittura
-- ogni UPDATE su professionals fallirebbe.
create or replace function public.protect_professional_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and not private.is_admin_or_cs() then
    if new.verification_status is distinct from old.verification_status
       or new.subscription_tier is distinct from old.subscription_tier
       or new.user_id is distinct from old.user_id
       or new.verification_level is distinct from old.verification_level
       or new.verification_level_at is distinct from old.verification_level_at then
      raise exception 'Non puoi modificare stato di verifica, livello, piano o proprietario del profilo';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_professional_columns() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Solo adesso: via le vecchie
-- ---------------------------------------------------------------------------
drop function if exists public.can_see_request_address(uuid);
drop function if exists public.my_assigned_request_ids();
drop function if exists public.my_professional_ids();
drop function if exists public.is_admin_or_cs();
drop function if exists public.is_admin();
