-- Prova di comportamento della 088: la richiesta sa da che comune arriva?
--
-- Non verifica la sintassi (per quella basta schema_check.sh): verifica le
-- quattro strade che può prendere il trigger, e soprattutto quella in cui NON
-- deve indovinare. Nella cintura milanese un CAP sta anche su diciotto comuni:
-- lì la risposta giusta è «non lo so», perché scrivere «Milano» manderebbe la
-- richiesta a chi sta dall'altra parte e nessuno dei due capirebbe perché.
--
-- Uso, dalla radice del repo, dopo ./scripts/schema_check.sh:
--   psql -h /tmp -p 55432 -U postgres -d bobclone -q -f scripts/prova_088_richiesta_comune.sql

\set ON_ERROR_STOP on

insert into public.cities (name, slug, status, province, region, macro_region)
values ('Milano', 'milano', 'active', 'Milano', 'Lombardia', 'nord')
on conflict (slug) do nothing;

update public.cities c
   set comune_istat = m.istat
  from public.comuni m
 where m.nome = c.name and m.provincia = c.province
   and c.comune_istat is distinct from m.istat;

-- Un mestiere finto: una richiesta senza servizio non si scrive.
insert into public.services (name, slug) values ('Prova', 'prova-088')
on conflict (slug) do nothing;

-- Un cliente finto: le richieste hanno bisogno di un titolare.
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000cc01')
on conflict (id) do nothing;
insert into public.users (id) values ('00000000-0000-0000-0000-00000000cc01')
on conflict (id) do nothing;

create or replace function pg_temp.prova_richiesta(p_cap text)
returns text
language plpgsql
as $$
declare
  id_citta uuid;
  esito text;
begin
  select id into id_citta from public.cities where slug = 'milano';
  insert into public.requests (customer_id, city_id, service_id, status, problem_description, postal_code)
  values ('00000000-0000-0000-0000-00000000cc01', id_citta,
          (select id from public.services where slug = 'prova-088'), 'draft', 'prova', p_cap)
  returning comune_istat into esito;
  return coalesce(esito, 'VUOTO');
end;
$$;

select 'CAP 20159 (solo Milano) → Milano' as prova,
       coalesce((select nome from public.comuni where istat = nullif(pg_temp.prova_richiesta('20159'), 'VUOTO')), 'VUOTO') as esito;

select 'CAP 20099 (solo Sesto) → Sesto, non Milano' as prova,
       coalesce((select nome from public.comuni where istat = nullif(pg_temp.prova_richiesta('20099'), 'VUOTO')), 'VUOTO') as esito;

select 'CAP 20090 (diviso fra molti comuni) → VUOTO, non indovina' as prova,
       coalesce((select nome from public.comuni where istat = nullif(pg_temp.prova_richiesta('20090'), 'VUOTO')), 'VUOTO') as esito;

select 'CAP che non conosciamo → ripiega sulla città' as prova,
       coalesce((select nome from public.comuni where istat = nullif(pg_temp.prova_richiesta('00000'), 'VUOTO')), 'VUOTO') as esito;

select 'nessun CAP → vale la città' as prova,
       coalesce((select nome from public.comuni where istat = nullif(pg_temp.prova_richiesta(null), 'VUOTO')), 'VUOTO') as esito;

-- E il pezzo che conta: il gettone della richiesta incontra il professionista.
select 'una richiesta da Sesto porta comune:015209' as prova,
       (select ('comune:' || comune_istat) from public.requests
         where postal_code = '20099' order by created_at desc limit 1) as esito;

delete from public.requests where customer_id = '00000000-0000-0000-0000-00000000cc01';
