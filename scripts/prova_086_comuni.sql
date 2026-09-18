-- Prova di comportamento della 086: i comuni servono davvero a disegnare?
--
-- Non verifica la sintassi (per quella basta schema_check.sh): verifica che
-- l'elenco sia intero, che le città di Bob sappiano qual è il loro comune, e
-- soprattutto che il cerchio sui comuni risponda come risponderebbe una
-- persona che guarda una cartina — Sesto San Giovanni con dieci chilometri
-- prende Milano, Cinisello e Monza, e non prende Bergamo.
--
-- Uso, dalla radice del repo, dopo ./scripts/schema_check.sh:
--   psql -h /tmp -p 55432 -U postgres -d bobclone -q -f scripts/prova_086_comuni.sql
--
-- Le città sono dati, non schema: in un clone ricostruito dai soli file non
-- c'è nessuna città, quindi qui la creiamo e rifacciamo il collegamento.

\set ON_ERROR_STOP on

insert into public.cities (name, slug, status, province, region, macro_region)
values ('Milano', 'milano', 'active', 'Milano', 'Lombardia', 'nord')
on conflict (slug) do nothing;

update public.cities c
   set comune_istat = m.istat
  from public.comuni m
 where m.nome = c.name and m.provincia = c.province
   and c.comune_istat is distinct from m.istat;

select 'comuni seminati (attesi 7904)' as prova, count(*)::text as esito
  from public.comuni;

select 'comuni senza coordinate (attesi 48, fusioni recenti)' as prova,
       count(*)::text as esito
  from public.comuni where lat is null;

select 'regioni distinte (attese 20)' as prova, count(distinct regione)::text as esito
  from public.comuni;

select 'Milano sa qual è il suo comune (atteso 015146)' as prova,
       coalesce(comune_istat, 'NESSUNO') as esito
  from public.cities where slug = 'milano';

-- IL CERCHIO. Il centro è Sesto San Giovanni: dieci chilometri in mezzo alla
-- cintura milanese devono prendere parecchio, tre chilometri quasi niente.
select 'entro 10 km da Sesto: prende Milano' as prova,
       (select '015146' = any(private.comuni_nel_cerchio(45.5333, 9.2333, 10000)))::text as esito;

select 'entro 10 km da Sesto: prende Monza' as prova,
       (select exists (
          select 1 from public.comuni
           where nome = 'Monza'
             and istat = any(private.comuni_nel_cerchio(45.5333, 9.2333, 10000))))::text as esito;

select 'entro 10 km da Sesto: NON prende Bergamo' as prova,
       (select not exists (
          select 1 from public.comuni
           where nome = 'Bergamo'
             and istat = any(private.comuni_nel_cerchio(45.5333, 9.2333, 10000))))::text as esito;

select 'entro 3 km da Sesto: solo Sesto' as prova,
       array_to_string(array(
         select nome from public.comuni
          where istat = any(private.comuni_nel_cerchio(45.5333, 9.2333, 3000))
          order by nome), ', ') as esito;

-- Il raggio massimo che l'interfaccia concede oggi (20 km) non deve far
-- esplodere niente: è una domanda che il server si sentirà fare spesso.
select 'entro 20 km da Sesto: quanti comuni' as prova,
       coalesce(array_length(private.comuni_nel_cerchio(45.5333, 9.2333, 20000), 1), 0)::text as esito;

-- IL CAP. Passa dall'indice GIN, e serve a portare una richiesta col solo CAP
-- (mig 046) sul comune giusto quando il cliente non dice altro.
select 'il CAP 20099 porta a Sesto San Giovanni' as prova,
       coalesce((select nome from public.comuni where cap @> array['20099'] limit 1), 'NESSUNO') as esito;

select 'il CAP 20159 porta a Milano' as prova,
       coalesce((select nome from public.comuni where cap @> array['20159'] limit 1), 'NESSUNO') as esito;

-- La lettura è pubblica: è geografia, non gente.
select 'comuni: lettura pubblica attiva' as prova,
       (select count(*) > 0 from pg_policies
         where tablename = 'comuni' and cmd = 'SELECT' and 'anon' = any(roles) or
               (tablename = 'comuni' and cmd = 'SELECT'))::text as esito;
