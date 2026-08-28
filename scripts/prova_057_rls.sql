-- Prova di sicurezza della 057: la geometria è privata, i gettoni sono pubblici?
--
-- È la promessa su cui è costruito il modello: il centro del cerchio può
-- essere l'abitazione del professionista, quindi non deve essere leggibile da
-- nessuno tranne lui e lo staff, mentre l'elenco delle aree deve essere
-- leggibile da tutti perché il match ci si appoggia. Qui si prova, con la RLS
-- vera, impersonando i ruoli come fa PostgREST.
--
-- Uso, dalla radice del repo, dopo ./scripts/schema_check.sh:
--   psql -h /tmp -p 55432 -U postgres -d bobclone -q -f scripts/prova_057_rls.sql

\set ON_ERROR_STOP on

insert into public.cities (name, slug, status, province, region, macro_region)
values ('Milano', 'milano', 'active', 'Milano', 'Lombardia', 'nord')
on conflict (slug) do nothing;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'proa@bob.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'prob@bob.test')
on conflict do nothing;
insert into public.users (id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'professional'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'professional')
on conflict do nothing;
insert into public.professionals (id, user_id, city_id)
select 'aaaa0000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', c.id
  from public.cities c where c.slug = 'milano' on conflict do nothing;
insert into public.professionals (id, user_id, city_id)
select 'bbbb0000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', c.id
  from public.cities c where c.slug = 'milano' on conflict do nothing;

-- Copertura di B, creata da postgres (fuori dalla RLS): serve come bersaglio.
insert into public.professional_coverage
  (professional_id, scope, city_id, mode, center_lat, center_lng, radius_m)
select 'bbbb0000-0000-0000-0000-00000000000b', 'zones', c.id, 'circle', 45.49, 9.19, 4000
  from public.cities c where c.slug = 'milano'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Il professionista A, autenticato
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into public.professional_coverage
  (professional_id, scope, city_id, mode, center_lat, center_lng, radius_m)
select 'aaaa0000-0000-0000-0000-00000000000a', 'zones', c.id, 'circle', 45.4374, 9.1535, 3000
  from public.cities c where c.slug = 'milano';

select 'A vede solo la propria geometria (atteso 1)' as prova, count(*)::text as esito
  from public.professional_coverage;

select 'A legge i gettoni pubblici di tutti (atteso 2)' as prova, count(*)::text as esito
  from public.professional_coverage_public;

do $$
begin
  insert into public.professional_coverage (professional_id, scope, city_id)
  select 'bbbb0000-0000-0000-0000-00000000000b', 'city', c.id from public.cities c where c.slug='milano';
  raise exception 'PROBLEMA: A ha scritto una copertura per B';
exception when insufficient_privilege then
  raise notice 'OK: A non puo scrivere la copertura di B';
end $$;

do $$
begin
  insert into public.professional_coverage_public (professional_id, coverage_keys)
  values ('aaaa0000-0000-0000-0000-00000000000a', array['it:*']);
  raise exception 'PROBLEMA: A ha scritto direttamente i gettoni pubblici';
exception when insufficient_privilege then
  raise notice 'OK: nessuno scrive a mano i gettoni pubblici';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Un visitatore anonimo
-- ---------------------------------------------------------------------------
begin;
set local role anon;

select 'anon NON vede nessuna geometria (atteso 0)' as prova, count(*)::text as esito
  from public.professional_coverage;

select 'anon vede i gettoni pubblici (atteso 1)' as prova, count(*)::text as esito
  from public.professional_coverage_public;

select 'anon vede le zone della citta (atteso 28)' as prova, count(*)::text as esito
  from public.city_zones;
rollback;

delete from public.professional_coverage
 where professional_id in ('aaaa0000-0000-0000-0000-00000000000a',
                           'bbbb0000-0000-0000-0000-00000000000b');
