-- Prova di comportamento della 057: la copertura geografica fa davvero match?
--
-- Non verifica la sintassi (per quella basta schema_check.sh): verifica che un
-- cerchio disegnato sui Navigli produca le zone giuste, che i gettoni del
-- professionista e quelli della richiesta si incontrino, che Lambrate NON
-- faccia match, e che «tutta Italia» cambi la risposta.
--
-- Uso, dalla radice del repo, dopo ./scripts/schema_check.sh:
--   psql -h /tmp -p 55432 -U postgres -d bobclone -q -f scripts/prova_057_copertura.sql
--
-- Le città sono dati, non schema: in un clone ricostruito dai soli file non
-- c'è nessuna città, quindi il seed della 057 non ha trovato Milano. Qui la
-- creiamo e rigiochiamo la 057, che è idempotente.

\set ON_ERROR_STOP on

insert into public.cities (name, slug, status, province, region, macro_region)
values ('Milano', 'milano', 'active', 'Milano', 'Lombardia', 'nord')
on conflict (slug) do nothing;

\i supabase/migrations/057_primo_ingresso.sql

select 'zone di Milano dopo il seed (attese 28)' as prova, count(*)::text as esito
  from public.city_zones;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'prova@bob.test') on conflict do nothing;
insert into public.users (id, role) values
  ('11111111-1111-1111-1111-111111111111', 'professional') on conflict do nothing;
insert into public.professionals (id, user_id, city_id)
select '22222222-2222-2222-2222-222222222222',
       '11111111-1111-1111-1111-111111111111', c.id
  from public.cities c where c.slug = 'milano'
on conflict do nothing;

-- Un cerchio di 3 km centrato sui Navigli.
insert into public.professional_coverage
  (professional_id, scope, city_id, mode, center_lat, center_lng, radius_m)
select '22222222-2222-2222-2222-222222222222', 'zones', c.id, 'circle',
       45.43742, 9.15352, 3000
  from public.cities c where c.slug = 'milano';

select 'zone nel cerchio' as prova, array_to_string(zone_slugs, ', ') as esito
  from public.professional_coverage
 where professional_id = '22222222-2222-2222-2222-222222222222';

select 'gettoni pubblici' as prova, array_to_string(coverage_keys, ', ') as esito
  from public.professional_coverage_public
 where professional_id = '22222222-2222-2222-2222-222222222222';

select 'gettoni della richiesta (Navigli)' as prova,
       array_to_string(public.request_coverage_keys(c.id, 'navigli'), ', ') as esito
  from public.cities c where c.slug = 'milano';

select 'match Navigli (atteso true)' as prova,
       ((select coverage_keys from public.professional_coverage_public
          where professional_id = '22222222-2222-2222-2222-222222222222')
        && public.request_coverage_keys(c.id, 'navigli'))::text as esito
  from public.cities c where c.slug = 'milano';

select 'match Lambrate (atteso false)' as prova,
       ((select coverage_keys from public.professional_coverage_public
          where professional_id = '22222222-2222-2222-2222-222222222222')
        && public.request_coverage_keys(c.id, 'lambrate'))::text as esito
  from public.cities c where c.slug = 'milano';

-- «Tutta Italia», più il lavoro a distanza.
insert into public.professional_coverage
  (professional_id, scope, city_id, mode, works_remote)
values ('22222222-2222-2222-2222-222222222222', 'national', null, 'zones', true);

select 'gettoni dopo tutta Italia' as prova,
       array_to_string(coverage_keys, ', ') as esito
  from public.professional_coverage_public
 where professional_id = '22222222-2222-2222-2222-222222222222';

select 'match Lambrate ora (atteso true)' as prova,
       ((select coverage_keys from public.professional_coverage_public
          where professional_id = '22222222-2222-2222-2222-222222222222')
        && public.request_coverage_keys(c.id, 'lambrate'))::text as esito
  from public.cities c where c.slug = 'milano';

do $$
begin
  insert into public.professional_coverage (professional_id, scope, city_id)
  values ('22222222-2222-2222-2222-222222222222', 'national', null);
  raise exception 'PROBLEMA: doppione nazionale accettato';
exception when unique_violation then
  raise notice 'OK: doppione nazionale rifiutato';
end $$;

do $$
begin
  insert into public.professional_coverage (professional_id, scope, city_id)
  values ('22222222-2222-2222-2222-222222222222', 'region', null);
  raise exception 'PROBLEMA: regione senza citta accettata';
exception when check_violation then
  raise notice 'OK: regione senza citta rifiutata';
end $$;

delete from public.professional_coverage
 where professional_id = '22222222-2222-2222-2222-222222222222';

select 'righe pubbliche dopo la cancellazione (attese 0)' as prova,
       count(*)::text as esito
  from public.professional_coverage_public
 where professional_id = '22222222-2222-2222-2222-222222222222';
