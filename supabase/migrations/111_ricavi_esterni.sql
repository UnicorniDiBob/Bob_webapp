-- 111_ricavi_esterni.sql
--
-- I RICAVI ESTERNI (04/10, Lucio). Il lavoro che il professionista fa fuori
-- da Bob, scritto da lui, perche' il cruscotto diventi «il quadro del tuo
-- anno» e non «le tue statistiche su una app». Plus e Business, uguali.
-- Spec: docs/SPEC_analisi_professionista.md, §4 e §3.8.
--
-- SEPARATI DAI NOSTRI DATI, PER COSTRUZIONE (§4.4)
--   - RLS: solo il proprietario. NESSUNA policy per lo staff, ne' admin ne'
--     cs: se serve aiutare un pro con un import, si guarda il suo schermo.
--   - Nessuna funzione interna li legge: il test
--     src/lib/ricaviEsterniSeparati.test.ts fallisce se il nome della tabella
--     compare fuori dai file ammessi.
--   - Nelle Analisi ogni riga porta l'origine ('bob' / 'esterno'), e i
--     numeri esterni entrano solo con l'interruttore «tutto il mio lavoro».
--
-- IL CLIENTE E' UN CODICE, NON UN NOME (§4.3). Bob non ha mai visto i
-- clienti esterni: un nome scritto qui farebbe di Bob il responsabile del
-- trattamento per conto del pro di un dato che non serve. Venti caratteri,
-- con l'avvertenza in pagina.
--
-- PIANI. Scrivere e correggere: Plus e Business. Leggere, scaricare e
-- cancellare: sempre, anche dopo essere tornati al Free. Sono dati suoi:
-- toglierglieli al cambio di piano sarebbe usarli come leva.
--
-- PESO (§3.8). Un tetto di 5.000 righe per pro e per anno di lavoro, con un
-- trigger a fine istruzione (un import da 2.000 righe passa o non passa
-- tutto). Oltre i 25 mesi le righe si condensano in analisi_mesi con
-- origine 'esterno': condensa_analisi() riscritta dal corpo VIVO della 108.
--
-- CONSERVAZIONE: finche' c'e' l'account del pro, a cascata con lui (A20).
-- Il pro cancella una riga, un import (lotto_import) o tutto
-- (cancella_tutti_i_ricavi_esterni(), che toglie anche i mesi condensati).
--
-- ANALISI AVANZATE: analisi_avanzata() guadagna p_con_esterni. Cambiare la
-- firma crea una funzione nuova, quindi la vecchia a quattro parametri si
-- toglie. Corpo riscritto da quello VIVO della 110.
--
-- Idempotente: if not exists, create or replace, drop-then-recreate.

begin;

-- ---------------------------------------------------------------------------
-- 1. La tabella
-- ---------------------------------------------------------------------------

create table if not exists public.ricavi_esterni (
  id               bigint generated always as identity primary key,
  creato_al        timestamptz not null default now(),
  professional_id  uuid not null references public.professionals(id) on delete cascade,
  service_id       uuid references public.services(id) on delete set null,
  lotto_import     uuid,
  data_lavoro      date not null,
  importo_cent     integer not null check (importo_cent >= 0 and importo_cent <= 10000000),
  origine          text not null default 'manuale' check (origine in ('manuale', 'csv')),
  comune_istat     text check (comune_istat is null or comune_istat ~ '^[0-9]{6}$'),
  postal_code      text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  codice_cliente   text check (codice_cliente is null or char_length(codice_cliente) between 1 and 20),
  nota             text check (nota is null or char_length(nota) <= 200)
);

comment on table public.ricavi_esterni is
  'Lavori fatti FUORI da Bob, scritti dal professionista (a mano o da CSV) per le sue Analisi. Solo il proprietario li legge e li scrive (Plus/Business per scrivere); nessuna policy per lo staff e nessuna analisi interna li legge. Il cliente e'' un codice scelto dal pro, mai un nome. Oltre i 25 mesi si condensano in analisi_mesi (origine esterno). Cascata con il professionista. ROPA A27. Mig 111.';

create index if not exists ricavi_esterni_pro_data
  on public.ricavi_esterni (professional_id, data_lavoro);

alter table public.ricavi_esterni enable row level security;

drop policy if exists "Pro legge i propri ricavi esterni" on public.ricavi_esterni;
create policy "Pro legge i propri ricavi esterni"
  on public.ricavi_esterni for select to authenticated
  using (professional_id in (
    select p.id from public.professionals p where p.user_id = (select auth.uid())
  ));

drop policy if exists "Pro cancella i propri ricavi esterni" on public.ricavi_esterni;
create policy "Pro cancella i propri ricavi esterni"
  on public.ricavi_esterni for delete to authenticated
  using (professional_id in (
    select p.id from public.professionals p where p.user_id = (select auth.uid())
  ));

drop policy if exists "Pro Plus e Business scrive i propri ricavi esterni" on public.ricavi_esterni;
create policy "Pro Plus e Business scrive i propri ricavi esterni"
  on public.ricavi_esterni for insert to authenticated
  with check (professional_id in (
    select p.id from public.professionals p
     where p.user_id = (select auth.uid())
       and p.subscription_tier in ('pro', 'business')
  ));

drop policy if exists "Pro Plus e Business corregge i propri ricavi esterni" on public.ricavi_esterni;
create policy "Pro Plus e Business corregge i propri ricavi esterni"
  on public.ricavi_esterni for update to authenticated
  using (professional_id in (
    select p.id from public.professionals p
     where p.user_id = (select auth.uid())
       and p.subscription_tier in ('pro', 'business')
  ))
  with check (professional_id in (
    select p.id from public.professionals p
     where p.user_id = (select auth.uid())
       and p.subscription_tier in ('pro', 'business')
  ));

revoke all on public.ricavi_esterni from anon;

-- Il tetto: 5.000 righe per pro e per anno di lavoro. A fine istruzione, con
-- la tabella delle righe nuove: un import intero passa o si ferma, mai a meta'.
create or replace function private.ricavi_esterni_tetto()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_anno integer;
begin
  select n.anno into v_anno
    from (
      select distinct x.professional_id, extract(year from x.data_lavoro)::integer as anno
        from nuove x
    ) n
   where (select count(*) from public.ricavi_esterni r
           where r.professional_id = n.professional_id
             and r.data_lavoro >= make_date(n.anno, 1, 1)
             and r.data_lavoro < make_date(n.anno + 1, 1, 1)) > 5000
   limit 1;
  if v_anno is not null then
    raise exception 'Hai superato le 5.000 righe di ricavi esterni per il %', v_anno
      using errcode = '54000';
  end if;
  return null;
end;
$function$;

drop trigger if exists ricavi_esterni_tetto on public.ricavi_esterni;
create trigger ricavi_esterni_tetto
  after insert on public.ricavi_esterni
  referencing new table as nuove
  for each statement execute function private.ricavi_esterni_tetto();

-- Cancellare tutto, mesi condensati compresi: la RLS di analisi_mesi non da'
-- il delete al pro (lo scrive solo la condensazione), quindi serve una
-- funzione. Il pro viene da auth.uid(), mai da un parametro.
create or replace function public.cancella_tutti_i_ricavi_esterni()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pro uuid;
  v_righe integer;
  v_mesi integer;
begin
  select p.id into v_pro from public.professionals p where p.user_id = (select auth.uid());
  if v_pro is null then
    raise exception 'Non sei un professionista' using errcode = '42501';
  end if;
  delete from public.ricavi_esterni r where r.professional_id = v_pro;
  get diagnostics v_righe = row_count;
  delete from public.analisi_mesi m where m.professional_id = v_pro and m.origine = 'esterno';
  get diagnostics v_mesi = row_count;
  return v_righe + v_mesi;
end;
$function$;

revoke all on function public.cancella_tutti_i_ricavi_esterni() from public, anon;
grant execute on function public.cancella_tutti_i_ricavi_esterni() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. La vista dei mesi: la parte esterna, con la sua origine
-- ---------------------------------------------------------------------------

create or replace view public.analisi_mesi_vive
with (security_invoker = true) as
select
  m.professional_id, m.mese, m.origine, m.service_id, m.comune_istat,
  m.richieste, m.risposte, m.risposte_1h, m.risposte_4h, m.risposte_24h,
  m.proposte, m.accettate, m.rifiutate, m.dirette, m.conclusi, m.disdetti,
  m.importo_cent, m.minuti_lavoro
from public.analisi_mesi m
union all
select
  e.professional_id,
  date_trunc('month', e.avvenuto_al at time zone 'Europe/Rome')::date,
  'bob',
  e.service_id,
  e.comune_istat,
  count(*) filter (where e.evento = 'richiesta_ricevuta')::integer,
  count(*) filter (where e.evento = 'prima_risposta')::integer,
  count(*) filter (where e.evento = 'prima_risposta' and e.minuti <= 60)::integer,
  count(*) filter (where e.evento = 'prima_risposta' and e.minuti <= 240)::integer,
  count(*) filter (where e.evento = 'prima_risposta' and e.minuti <= 1440)::integer,
  count(*) filter (where e.evento = 'proposta_inviata')::integer,
  count(*) filter (where e.evento = 'proposta_accettata')::integer,
  count(*) filter (where e.evento = 'proposta_rifiutata')::integer,
  count(*) filter (where e.evento = 'prenotazione_diretta')::integer,
  count(*) filter (where e.evento = 'lavoro_concluso')::integer,
  count(*) filter (where e.evento = 'lavoro_disdetto')::integer,
  coalesce(sum(e.importo_cent) filter (where e.evento = 'lavoro_concluso'), 0)::bigint,
  coalesce(sum(e.minuti) filter (where e.evento = 'lavoro_concluso'), 0)::integer
from public.professional_work_events e
group by 1, 2, 3, 4, 5
union all
select
  r.professional_id,
  date_trunc('month', r.data_lavoro)::date,
  'esterno',
  r.service_id,
  r.comune_istat,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  count(*)::integer,
  0,
  coalesce(sum(r.importo_cent), 0)::bigint,
  0
from public.ricavi_esterni r
group by 1, 2, 3, 4, 5;

revoke all on public.analisi_mesi_vive from anon;
grant select on public.analisi_mesi_vive to authenticated;

-- ---------------------------------------------------------------------------
-- 3. La condensazione, dal corpo vivo della 108, con i ricavi esterni
-- ---------------------------------------------------------------------------

create or replace function public.condensa_analisi(p_mesi integer default 25)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_soglia timestamptz;
  v_quanti integer;
begin
  if p_mesi is null or p_mesi < 13 then
    raise exception 'condensa_analisi: servono almeno 13 mesi di dettaglio, non %', p_mesi;
  end if;

  v_soglia := (date_trunc('month', now() at time zone 'Europe/Rome')
               - make_interval(months => p_mesi)) at time zone 'Europe/Rome';

  with tolti as (
    delete from public.professional_work_events e
     where e.avvenuto_al < v_soglia
    returning e.*
  ), riassunti as (
    insert into public.analisi_mesi as a
      (professional_id, mese, origine, service_id, comune_istat,
       richieste, risposte, risposte_1h, risposte_4h, risposte_24h,
       proposte, accettate, rifiutate, dirette, conclusi, disdetti,
       importo_cent, minuti_lavoro)
    select
      t.professional_id,
      date_trunc('month', t.avvenuto_al at time zone 'Europe/Rome')::date,
      'bob', t.service_id, t.comune_istat,
      count(*) filter (where t.evento = 'richiesta_ricevuta'),
      count(*) filter (where t.evento = 'prima_risposta'),
      count(*) filter (where t.evento = 'prima_risposta' and t.minuti <= 60),
      count(*) filter (where t.evento = 'prima_risposta' and t.minuti <= 240),
      count(*) filter (where t.evento = 'prima_risposta' and t.minuti <= 1440),
      count(*) filter (where t.evento = 'proposta_inviata'),
      count(*) filter (where t.evento = 'proposta_accettata'),
      count(*) filter (where t.evento = 'proposta_rifiutata'),
      count(*) filter (where t.evento = 'prenotazione_diretta'),
      count(*) filter (where t.evento = 'lavoro_concluso'),
      count(*) filter (where t.evento = 'lavoro_disdetto'),
      coalesce(sum(t.importo_cent) filter (where t.evento = 'lavoro_concluso'), 0),
      coalesce(sum(t.minuti) filter (where t.evento = 'lavoro_concluso'), 0)
    from tolti t
    group by 1, 2, 3, 4, 5
    on conflict on constraint analisi_mesi_unico do update
      set richieste     = a.richieste     + excluded.richieste,
          risposte      = a.risposte      + excluded.risposte,
          risposte_1h   = a.risposte_1h   + excluded.risposte_1h,
          risposte_4h   = a.risposte_4h   + excluded.risposte_4h,
          risposte_24h  = a.risposte_24h  + excluded.risposte_24h,
          proposte      = a.proposte      + excluded.proposte,
          accettate     = a.accettate     + excluded.accettate,
          rifiutate     = a.rifiutate     + excluded.rifiutate,
          dirette       = a.dirette       + excluded.dirette,
          conclusi      = a.conclusi      + excluded.conclusi,
          disdetti      = a.disdetti      + excluded.disdetti,
          importo_cent  = a.importo_cent  + excluded.importo_cent,
          minuti_lavoro = a.minuti_lavoro + excluded.minuti_lavoro
    returning 1
  )
  select count(*) into v_quanti from tolti;

  -- I ricavi esterni seguono la stessa strada (111): oltre la soglia una
  -- riga per mese, servizio e comune, con origine 'esterno'. La pagina dei
  -- ricavi esterni avvisa il pro prima, perche' possa scaricarli interi.
  with tolti_e as (
    delete from public.ricavi_esterni r
     where r.data_lavoro < (v_soglia at time zone 'Europe/Rome')::date
    returning r.*
  ), riassunti_e as (
    insert into public.analisi_mesi as a
      (professional_id, mese, origine, service_id, comune_istat, conclusi, importo_cent)
    select t.professional_id, date_trunc('month', t.data_lavoro)::date, 'esterno',
           t.service_id, t.comune_istat, count(*), coalesce(sum(t.importo_cent), 0)
      from tolti_e t
     group by 1, 2, 3, 4, 5
    on conflict on constraint analisi_mesi_unico do update
      set conclusi     = a.conclusi     + excluded.conclusi,
          importo_cent = a.importo_cent + excluded.importo_cent
    returning 1
  )
  select v_quanti + count(*) into v_quanti from tolti_e;

  return v_quanti;
end;
$function$;

revoke all on function public.condensa_analisi(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Le Analisi avanzate, dal corpo vivo della 110, con p_con_esterni
-- ---------------------------------------------------------------------------

drop function if exists public.analisi_avanzata(date, date, date, date);

create or replace function public.analisi_avanzata(
  p_da date,
  p_a date,
  p_contro_da date default null,
  p_contro_a date default null,
  p_con_esterni boolean default false
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
  v_pro uuid;
  v_piano text;
  v_out jsonb := '{}'::jsonb;
  v_chiave text;
  v_da date;
  v_a date;
  v_ini timestamptz;
  v_fin timestamptz;
  i integer;
  -- «Solo Bob» o «tutto il mio lavoro»: i ricavi esterni entrano solo se il
  -- pro lo chiede, e solo nei numeri che possono contenerli (importi, lavori
  -- conclusi, servizi, comuni). Imbuto, risposte, clienti e agenda restano
  -- di Bob: fuori da Bob non c'e' una richiesta da contare.
  v_origini text[] := case when p_con_esterni then array['bob', 'esterno'] else array['bob'] end;
begin
  select p.id, p.subscription_tier into v_pro, v_piano
    from public.professionals p
   where p.user_id = (select auth.uid());
  if v_pro is null then
    return null;
  end if;
  if v_piano not in ('pro', 'business') then
    raise exception 'Le Analisi avanzate sono incluse in Bob Plus e Bob Business'
      using errcode = '42501';
  end if;

  for i in 1..2 loop
    if i = 1 then
      v_chiave := 'periodo';
      v_da := date_trunc('month', p_da)::date;
      v_a := date_trunc('month', p_a)::date;
    else
      exit when p_contro_da is null or p_contro_a is null;
      v_chiave := 'contro';
      v_da := date_trunc('month', p_contro_da)::date;
      v_a := date_trunc('month', p_contro_a)::date;
    end if;

    if v_da is null or v_a is null or v_a < v_da or v_a > v_da + interval '120 months' then
      raise exception 'analisi_avanzata: periodo non valido (% - %)', v_da, v_a;
    end if;

    v_ini := v_da::timestamp at time zone 'Europe/Rome';
    v_fin := (v_a + interval '1 month')::timestamp at time zone 'Europe/Rome';

    v_out := v_out || jsonb_build_object(v_chiave, jsonb_build_object(
      'da', v_da,
      'a', v_a,

      'totali', (
        select jsonb_build_object(
          'richieste',    coalesce(sum(v.richieste), 0),
          'risposte',     coalesce(sum(v.risposte), 0),
          'risposte_1h',  coalesce(sum(v.risposte_1h), 0),
          'risposte_4h',  coalesce(sum(v.risposte_4h), 0),
          'risposte_24h', coalesce(sum(v.risposte_24h), 0),
          'proposte',     coalesce(sum(v.proposte), 0),
          'accettate',    coalesce(sum(v.accettate), 0),
          'rifiutate',    coalesce(sum(v.rifiutate), 0),
          'dirette',      coalesce(sum(v.dirette), 0),
          'conclusi',     coalesce(sum(v.conclusi), 0),
          'disdetti',     coalesce(sum(v.disdetti), 0),
          'importo_cent', coalesce(sum(v.importo_cent), 0),
          'minuti',       coalesce(sum(v.minuti_lavoro), 0))
          from public.analisi_mesi_vive v
         where v.professional_id = v_pro and v.origine = any(v_origini)
           and v.mese between v_da and v_a
      ),

      'per_mese', (
        select jsonb_agg(jsonb_build_object(
                 'mese',         g.mese::date,
                 'richieste',    coalesce(s.richieste, 0),
                 'proposte',     coalesce(s.proposte, 0),
                 'accettate',    coalesce(s.accettate, 0),
                 'dirette',      coalesce(s.dirette, 0),
                 'conclusi',     coalesce(s.conclusi, 0),
                 'importo_cent', coalesce(s.importo_cent, 0))
               order by g.mese)
          from generate_series(v_da, v_a, interval '1 month') g(mese)
          left join lateral (
            select sum(v.richieste) as richieste, sum(v.proposte) as proposte,
                   sum(v.accettate) as accettate, sum(v.dirette) as dirette,
                   sum(v.conclusi) as conclusi, sum(v.importo_cent) as importo_cent
              from public.analisi_mesi_vive v
             where v.professional_id = v_pro and v.origine = any(v_origini)
               and v.mese = g.mese::date
          ) s on true
      ),

      'per_servizio', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'servizio',     x.nome,
                 'richieste',    x.richieste,
                 'proposte',     x.proposte,
                 'accettate',    x.accettate,
                 'dirette',      x.dirette,
                 'conclusi',     x.conclusi,
                 'importo_cent', x.importo_cent)
               order by x.importo_cent desc, x.proposte desc), '[]'::jsonb)
          from (
            select coalesce(s.name, 'Non specificato') as nome,
                   sum(v.richieste) as richieste, sum(v.proposte) as proposte,
                   sum(v.accettate) as accettate, sum(v.dirette) as dirette,
                   sum(v.conclusi) as conclusi, sum(v.importo_cent) as importo_cent
              from public.analisi_mesi_vive v
              left join public.services s on s.id = v.service_id
             where v.professional_id = v_pro and v.origine = any(v_origini)
               and v.mese between v_da and v_a
             group by 1
          ) x
         where x.richieste + x.proposte + x.dirette + x.conclusi > 0
      ),

      'per_comune', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'comune',       x.nome,
                 'conclusi',     x.conclusi,
                 'importo_cent', x.importo_cent)
               order by x.importo_cent desc), '[]'::jsonb)
          from (
            select coalesce(c.nome, 'Comune non indicato') as nome,
                   sum(v.conclusi) as conclusi, sum(v.importo_cent) as importo_cent
              from public.analisi_mesi_vive v
              left join public.comuni c on c.istat = v.comune_istat
             where v.professional_id = v_pro and v.origine = any(v_origini)
               and v.mese between v_da and v_a
             group by 1
          ) x
         where x.conclusi > 0
      ),

      'prima_risposta', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'fascia', b.fascia, 'richieste', b.n, 'arrivate', b.arrivate)
               order by b.fascia), '[]'::jsonb)
          from (
            select case when r.minuti <= 60 then 1
                        when r.minuti <= 240 then 2
                        when r.minuti <= 1440 then 3
                        else 4 end as fascia,
                   count(*) as n,
                   count(*) filter (where exists (
                     select 1 from public.professional_work_events x
                      where x.professional_id = v_pro
                        and x.richiesta = r.rif
                        and x.evento in ('proposta_accettata', 'lavoro_concluso')
                   )) as arrivate
              from public.professional_work_events r
             where r.professional_id = v_pro
               and r.evento = 'prima_risposta'
               and r.minuti is not null
               and r.avvenuto_al >= v_ini and r.avvenuto_al < v_fin
             group by 1
          ) b
      ),

      'senza_risposta', (
        with senza as (
          select q.avvenuto_al, q.service_id
            from public.professional_work_events q
           where q.professional_id = v_pro
             and q.evento = 'richiesta_ricevuta'
             and q.avvenuto_al >= v_ini and q.avvenuto_al < v_fin
             and q.avvenuto_al < now() - interval '48 hours'
             and not exists (
               select 1 from public.professional_work_events x
                where x.professional_id = v_pro
                  and (
                    (x.evento = 'prima_risposta' and x.rif = q.rif)
                    or (x.richiesta = q.rif
                        and x.evento in ('prenotazione_diretta', 'proposta_inviata', 'proposta_accettata'))
                  )
             )
        )
        select jsonb_build_object(
                 'quante', (select count(*) from senza),
                 'ultime', coalesce((
                   select jsonb_agg(jsonb_build_object('data', z.avvenuto_al, 'servizio', z.nome)
                                    order by z.avvenuto_al desc)
                     from (
                       select s1.avvenuto_al, coalesce(sv.name, 'Non specificato') as nome
                         from senza s1
                         left join public.services sv on sv.id = s1.service_id
                        order by s1.avvenuto_al desc
                        limit 10
                     ) z), '[]'::jsonb))
      ),

      'clienti', (
        with fatti as (
          select a.customer_id, a.starts_at
            from public.appointments a
           where a.professional_id = v_pro
             and a.status = 'completed'
             and a.customer_id is not null
        )
        select jsonb_build_object(
                 'clienti', count(distinct f.customer_id),
                 'tornati', count(distinct f.customer_id) filter (where exists (
                   select 1 from fatti f2
                    where f2.customer_id = f.customer_id and f2.starts_at < f.starts_at)),
                 'lavori_senza_cliente', (
                   select count(*) from public.appointments a
                    where a.professional_id = v_pro and a.status = 'completed'
                      and a.customer_id is null
                      and a.starts_at >= v_ini and a.starts_at < v_fin))
          from fatti f
         where f.starts_at >= v_ini and f.starts_at < v_fin
      ),

      'saturazione', (
        select jsonb_agg(jsonb_build_object(
                 'mese',        g.mese::date,
                 'venduti',     vend.minuti,
                 'disponibili', greatest(disp.minuti - ass.minuti, 0))
               order by g.mese)
          from generate_series(v_da, v_a, interval '1 month') g(mese)
          cross join lateral (
            select (g.mese::date)::timestamp at time zone 'Europe/Rome' as ini,
                   ((g.mese::date) + interval '1 month')::timestamp at time zone 'Europe/Rome' as fin
          ) m
          cross join lateral (
            select coalesce(sum(extract(epoch from (pa.end_time - pa.start_time)) / 60), 0)::integer as minuti
              from generate_series(g.mese::date, (g.mese::date + interval '1 month' - interval '1 day')::date,
                                   interval '1 day') d(giorno)
              join public.professional_availability pa
                on pa.professional_id = v_pro
               and pa.weekday = extract(dow from d.giorno)
          ) disp
          cross join lateral (
            select coalesce(sum(extract(epoch from (least(b.ends_at, m.fin) - greatest(b.starts_at, m.ini))) / 60), 0)::integer as minuti
              from public.professional_availability_blocks b
             where b.professional_id = v_pro
               and b.starts_at < m.fin and b.ends_at > m.ini
          ) ass
          cross join lateral (
            select coalesce(sum(a.duration_minutes), 0)::integer as minuti
              from public.appointments a
             where a.professional_id = v_pro
               and a.status in ('confirmed', 'completed')
               and a.starts_at >= m.ini and a.starts_at < m.fin
          ) vend
      )
    ));
  end loop;

  return v_out || jsonb_build_object(
    'piano', v_piano,
    'con_esterni', coalesce(p_con_esterni, false),
    -- Da qui in avanti il registro ha il dettaglio (prima risposta, richieste
    -- senza risposta): prima, solo i mesi condensati.
    'dettaglio_dal', (date_trunc('month', now() at time zone 'Europe/Rome') - interval '25 months')::date
  );
end;
$function$;

revoke all on function public.analisi_avanzata(date, date, date, date, boolean) from public, anon;
grant execute on function public.analisi_avanzata(date, date, date, date, boolean) to authenticated;

commit;
