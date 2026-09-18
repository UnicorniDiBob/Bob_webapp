-- Prova di comportamento della 087: il cerchio produce davvero i comuni?
--
-- Non verifica la sintassi (per quella basta schema_check.sh): verifica la
-- regola che tiene separate le due griglie. Un professionista con base a Sesto
-- San Giovanni e otto chilometri di raggio deve coprire Cologno e Cinisello
-- come COMUNI, i quartieri nord di Milano come QUARTIERI, e non deve trovarsi
-- a dichiarare Milano intera — che è il modo in cui questa cosa si romperebbe
-- senza che nessuno se ne accorga, perché il professionista vedrebbe solo più
-- richieste.
--
-- Uso, dalla radice del repo, dopo ./scripts/schema_check.sh:
--   psql -h /tmp -p 55432 -U postgres -d bobclone -q -f scripts/prova_087_comuni_copertura.sql

\set ON_ERROR_STOP on

-- Le città sono dati, non schema: in un clone ricostruito dai soli file non
-- c'è nessuna città, quindi il seed delle zone non ha trovato Milano.
insert into public.cities (name, slug, status, province, region, macro_region)
values ('Milano', 'milano', 'active', 'Milano', 'Lombardia', 'nord')
on conflict (slug) do nothing;

\i supabase/migrations/084_zone_nil_milano.sql

-- UNA TRAPPOLA, TROVATA QUI E TENUTA SCRITTA. La 084 contiene un
-- «create or replace» di private.coverage_keys_for: rigiocarla DOPO la 087
-- riporta indietro la funzione alla versione senza comuni, e i gettoni escono
-- monchi senza un solo errore. Vale in questa prova come in produzione: una
-- migrazione vecchia rigiocata fuori ordine disfa quelle nuove.
\i supabase/migrations/087_copertura_a_comuni.sql

update public.cities c
   set comune_istat = m.istat
  from public.comuni m
 where m.nome = c.name and m.provincia = c.province
   and c.comune_istat is distinct from m.istat;

-- Un professionista finto, con la sua base a Sesto San Giovanni.
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000c0f0')
on conflict (id) do nothing;
insert into public.users (id) values ('00000000-0000-0000-0000-00000000c0f0')
on conflict (id) do nothing;
insert into public.professionals (id, user_id, city_id, comune_istat, comune_name, province, region, postal_code)
select '00000000-0000-0000-0000-00000000c0f1',
       '00000000-0000-0000-0000-00000000c0f0',
       id, '015209', 'Sesto San Giovanni', 'Milano', 'Lombardia', '20099'
  from public.cities where slug = 'milano'
on conflict (id) do nothing;

delete from public.professional_coverage
 where professional_id = '00000000-0000-0000-0000-00000000c0f1';

insert into public.professional_coverage
  (professional_id, scope, city_id, mode, center_lat, center_lng, radius_m)
select '00000000-0000-0000-0000-00000000c0f1', 'comuni', id, 'circle', 45.5333, 9.2333, 8000
  from public.cities where slug = 'milano';

select 'l''ambito «comuni» è ammesso' as prova,
       (select scope from public.professional_coverage
         where professional_id = '00000000-0000-0000-0000-00000000c0f1') as esito;

select 'il cerchio ha preso dei comuni' as prova,
       coalesce(array_length(comuni_istat, 1), 0)::text as esito
  from public.professional_coverage
 where professional_id = '00000000-0000-0000-0000-00000000c0f1';

select 'fra i comuni c''è Cologno Monzese' as prova,
       (select exists (
          select 1 from public.professional_coverage c
            join public.comuni m on m.istat = any(c.comuni_istat)
           where c.professional_id = '00000000-0000-0000-0000-00000000c0f1'
             and m.nome = 'Cologno Monzese'))::text as esito;

-- LA REGOLA. Milano è una città di Bob con i suoi quartieri: il cerchio la
-- tocca, ma come comune non si dichiara.
select 'Milano NON è fra i comuni dichiarati' as prova,
       (select not ('015146' = any(comuni_istat))
          from public.professional_coverage
         where professional_id = '00000000-0000-0000-0000-00000000c0f1')::text as esito;

select 'i quartieri nord di Milano invece sì (Bicocca)' as prova,
       (select 'bicocca' = any(zone_slugs)
          from public.professional_coverage
         where professional_id = '00000000-0000-0000-0000-00000000c0f1')::text as esito;

select 'e Gratosoglio, dall''altra parte della città, no' as prova,
       (select not ('gratosoglio' = any(zone_slugs))
          from public.professional_coverage
         where professional_id = '00000000-0000-0000-0000-00000000c0f1')::text as esito;

-- I GETTONI PUBBLICATI: è quello che vede la ricerca.
select 'fra i gettoni c''è il comune di Cologno' as prova,
       (select ('comune:' || (select istat from public.comuni where nome = 'Cologno Monzese'))
                = any(coverage_keys)
          from public.professional_coverage_public
         where professional_id = '00000000-0000-0000-0000-00000000c0f1')::text as esito;

select 'fra i gettoni NON c''è comune:015146 (Milano)' as prova,
       (select not ('comune:015146' = any(coverage_keys))
          from public.professional_coverage_public
         where professional_id = '00000000-0000-0000-0000-00000000c0f1')::text as esito;

select 'fra i gettoni c''è zone:milano/bicocca' as prova,
       (select 'zone:milano/bicocca' = any(coverage_keys)
          from public.professional_coverage_public
         where professional_id = '00000000-0000-0000-0000-00000000c0f1')::text as esito;

select 'l''ambito più stretto dichiarato è «comuni»' as prova,
       (select best_scope from public.professional_coverage_public
         where professional_id = '00000000-0000-0000-0000-00000000c0f1') as esito;

-- LA RICHIESTA. I gettoni della città li materializza la 058: da oggi c'è
-- dentro anche il comune, ed è quello che permetterà a una richiesta da un
-- comune qualsiasi di incontrare chi lo copre (blocco 6).
select 'una richiesta da Milano porta comune:015146' as prova,
       ('comune:015146' = any(coverage_keys))::text as esito
  from public.cities where slug = 'milano';

-- IL CONFRONTO VERO: gettoni della richiesta contro gettoni del professionista.
select 'una richiesta da Cologno lo trova' as prova,
       (select exists (
          select 1 from public.professional_coverage_public p
           where p.professional_id = '00000000-0000-0000-0000-00000000c0f1'
             and ('comune:' || (select istat from public.comuni where nome = 'Cologno Monzese'))
                 = any(p.coverage_keys)))::text as esito;

select 'una richiesta da Pavia no' as prova,
       (select not exists (
          select 1 from public.professional_coverage_public p
           where p.professional_id = '00000000-0000-0000-0000-00000000c0f1'
             and ('comune:' || (select istat from public.comuni where nome = 'Pavia' and provincia = 'Pavia'))
                 = any(p.coverage_keys)))::text as esito;
