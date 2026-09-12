-- 075_segnali_pubblici.sql
--
-- PERCHE' ESISTE
--
-- La 072 ha reso vero il punteggio pubblicato, ma per farlo ha dovuto essere
-- `security definer` e chiamabile da chi visita il sito: uno dei suoi addendi,
-- il tempo di risposta, si calcola su `request_messages`, che un visitatore
-- non puo' leggere — e non deve. Gli advisor di Supabase lo hanno segnalato
-- due volte (lint 0028 e 0029), e la regola del progetto dice di sistemare i
-- rilievi «SECURITY DEFINER», non di conviverci: un elenco di avvisi
-- permanenti e' il modo piu' veloce per non accorgersi del prossimo.
--
-- La soluzione non e' togliere il tempo di risposta dal punteggio, ne'
-- rendere pubblici i messaggi. E' separare le due cose: **il numero
-- aggregato diventa un dato pubblico suo**, una riga per professionista, e la
-- funzione del punteggio torna `security invoker` perche' non ha piu' bisogno
-- di leggere niente di privato. Tutte le altre tabelle che il punteggio
-- consulta — professionals, cities, ratings, professional_services,
-- professional_coverage_public, professional_availability — hanno gia' una
-- policy di lettura pubblica.
--
-- COSA ESCE DAVVERO
--
-- Una mediana di minuti per professionista e il numero di conversazioni su cui
-- e' calcolata. Nessun messaggio, nessun cliente, nessuna data singola. E' lo
-- stesso numero che /come-funziona#ordine dichiara di usare per ordinare:
-- pubblicarlo come dato e' piu' onesto che calcolarlo di nascosto.
--
-- CANCELLAZIONE E CONSERVAZIONE: `on delete cascade` sul professionista, la
-- riga muore con lui. Nessun dato nuovo su nessuna persona fisica diversa dal
-- professionista, nessuna riga nuova nel registro dei trattamenti (stessa
-- finalita' contrattuale del profilo). Non si conserva niente: il valore si
-- ricalcola, e la finestra di 90 giorni scorre.
--
-- PERCHE' SERVE ANCHE IL GIRO NOTTURNO: la finestra e' mobile. Chi smetteva
-- di rispondere terrebbe per sempre la mediana buona dell'ultima volta, se il
-- valore si aggiornasse soltanto quando arriva un messaggio nuovo.
--
-- Idempotente: create table if not exists, create or replace, drop policy e
-- drop trigger prima di ricrearli, unschedule prima di schedule.

begin;

-- ---------------------------------------------------------------------------
-- Il dato pubblico
-- ---------------------------------------------------------------------------

create table if not exists public.professional_signals (
  professional_id uuid primary key
    references public.professionals(id) on delete cascade,
  risposta_minuti numeric,
  risposte_contate integer not null default 0,
  aggiornato_al timestamptz not null default now()
);

comment on table public.professional_signals is
  'Gli addendi del punteggio di ordinamento che non si possono calcolare leggendo solo tabelle pubbliche. Oggi uno: la mediana dei minuti di prima risposta, ultimi 90 giorni. Lettura pubblica di proposito — e'' un parametro di ordinamento dichiarato (art. 22 co. 4-bis Cod. Consumo, art. 5 Reg. UE 2019/1150). La scrive solo aggiorna_segnali_professionisti().';
comment on column public.professional_signals.risposta_minuti is
  'Mediana dei minuti fra il primo messaggio del cliente su una richiesta e la prima risposta del professionista. NULL = mai misurato, e nel punteggio vale il centro della scala, non zero.';
comment on column public.professional_signals.risposte_contate is
  'Su quante conversazioni e'' calcolata la mediana. Serve a dire «non lo sappiamo ancora» invece di far finta di saperlo.';

alter table public.professional_signals enable row level security;

drop policy if exists "Public read professional signals" on public.professional_signals;
create policy "Public read professional signals"
  on public.professional_signals for select using (true);

-- Nessuna policy di scrittura, per nessun ruolo: questa tabella la riempie
-- solo la funzione qui sotto. Un professionista che potesse scrivere il
-- proprio tempo di risposta renderebbe il parametro una dichiarazione, che e'
-- esattamente quello che la 072 ha evitato.

-- ---------------------------------------------------------------------------
-- Il calcolo, in un posto solo
-- ---------------------------------------------------------------------------

create or replace function public.aggiorna_segnali_professionisti(
  p_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_quanti integer;
begin
  insert into public.professional_signals as sg
    (professional_id, risposta_minuti, risposte_contate, aggiornato_al)
  select
    pr.id,
    x.mediana,
    coalesce(x.n, 0),
    now()
  from public.professionals pr
  left join (
    select
      per_richiesta.professional_id,
      percentile_cont(0.5) within group (order by per_richiesta.minuti) as mediana,
      count(*) as n
    from (
      select
        m.professional_id,
        m.request_id,
        extract(epoch from (
          min(m.created_at) filter (where m.sender_type = 'professional')
          - min(m.created_at) filter (where m.sender_type = 'customer')
        )) / 60 as minuti
      from public.request_messages m
      where m.created_at > now() - interval '90 days'
        and m.professional_id is not null
      group by m.professional_id, m.request_id
    ) per_richiesta
    where per_richiesta.minuti is not null
      and per_richiesta.minuti >= 0
    group by per_richiesta.professional_id
  ) x on x.professional_id = pr.id
  where p_ids is null or pr.id = any(p_ids)
  on conflict (professional_id) do update
    set risposta_minuti = excluded.risposta_minuti,
        risposte_contate = excluded.risposte_contate,
        aggiornato_al = excluded.aggiornato_al;

  get diagnostics v_quanti = row_count;
  return v_quanti;
end;
$$;

-- Nessuno la chiama dal browser: la chiamano il trigger, il cron, e noi a mano
-- quando serve provarla. E' questa revoca che tiene la funzione fuori dai
-- rilievi 0028/0029 degli advisor, come la 074 fa con le disdette.
revoke execute on function public.aggiorna_segnali_professionisti(uuid[])
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aggiornamento immediato quando un professionista risponde
-- ---------------------------------------------------------------------------

create or replace function public.segnali_da_messaggio()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- Un solo professionista per volta: il ricalcolo e' una query su poche
  -- righe, non un giro sulla tabella.
  perform public.aggiorna_segnali_professionisti(array[new.professional_id]);
  return null;
end;
$$;

revoke execute on function public.segnali_da_messaggio() from public, anon, authenticated;

drop trigger if exists request_messages_segnali_trg on public.request_messages;
create trigger request_messages_segnali_trg
  after insert on public.request_messages
  for each row
  when (new.sender_type = 'professional' and new.professional_id is not null)
  execute function public.segnali_da_messaggio();

-- ---------------------------------------------------------------------------
-- Il giro notturno, perche' la finestra scorre
-- ---------------------------------------------------------------------------

create or replace function public.aggiorna_tutti_i_segnali()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_inizio timestamptz := now();
  v_quanti integer;
begin
  v_quanti := public.aggiorna_segnali_professionisti(null);
  insert into public.system_job_runs (job, started_at, finished_at, ok, outcome)
  values ('aggiorna_segnali_professionisti', v_inizio, now(), true,
          jsonb_build_object('professionisti', v_quanti));
exception when others then
  insert into public.system_job_runs (job, started_at, finished_at, ok, error)
  values ('aggiorna_segnali_professionisti', v_inizio, now(), false, sqlerrm);
  raise;
end;
$$;

revoke execute on function public.aggiorna_tutti_i_segnali() from public, anon, authenticated;

-- 04:10 UTC: mezz'ora dopo l'ultimo dei due lavori notturni che c'erano (la
-- purga della memoria alle 03:17 e le disdette alle 03:40).
select cron.unschedule('aggiorna-segnali-professionisti')
where exists (select 1 from cron.job where jobname = 'aggiorna-segnali-professionisti');

select cron.schedule('aggiorna-segnali-professionisti', '10 4 * * *',
                     $cron$select public.aggiorna_tutti_i_segnali();$cron$);

-- Riempi subito, altrimenti fino a domani notte il tempo di risposta di tutti
-- vale il centro della scala e la 072 sembra rotta.
select public.aggiorna_segnali_professionisti(null);

-- ---------------------------------------------------------------------------
-- Il punteggio torna SECURITY INVOKER
-- ---------------------------------------------------------------------------
--
-- Identico alla 072 tranne la CTE `risposta`, che ora legge il dato pubblico
-- invece dei messaggi. Da qui in poi la funzione non tocca piu' nulla di
-- privato, e i due rilievi 0028/0029 non hanno piu' oggetto.

drop function if exists public.professionals_score(uuid[], text, text, text);

create or replace function public.professionals_score(
  p_ids uuid[],
  p_city_slug text default null,
  p_zone_slug text default null,
  p_subservice_slug text default null
)
returns table (
  professional_id uuid,
  offre_intervento boolean,
  punti numeric,
  punti_area numeric,
  punti_valutazione numeric,
  punti_risposta numeric,
  punti_prezzo numeric,
  punti_disponibilita numeric,
  punti_verifica numeric,
  punti_completezza numeric,
  risposta_minuti numeric,
  valutazioni integer
)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
  with richiesta as (
    select
      coalesce(c.coverage_keys, '{}'::text[]) as chiavi_base,
      case
        when p_zone_slug is not null and p_city_slug is not null
          then array['zone:' || p_city_slug || '/' || p_zone_slug]
        else '{}'::text[]
      end as chiave_zona
    from (select 1) uno
    left join public.cities c on c.slug = p_city_slug
  ),
  gettoni as (
    select chiave_zona || chiavi_base as chiavi from richiesta
  ),
  media_piattaforma as (
    select coalesce(avg(score), 4.0)::numeric as media from public.ratings
  ),
  base as (
    select
      pr.id,
      pr.bio,
      pr.business_name,
      pr.verification_status,
      pr.city_id
    from public.professionals pr
    where pr.id = any(p_ids)
      and pr.deactivated_at is null
  ),
  area as (
    select
      b.id,
      case
        when p_city_slug is null then 15::numeric
        else greatest(
          coalesce((
            select max(
              case split_part(k, ':', 1)
                when 'zone' then 20 when 'city' then 15 when 'prov' then 8
                when 'reg'  then 4  when 'macro' then 3 when 'it' then 2
                else 0
              end
            )
            from unnest(coalesce(cp.coverage_keys, '{}'::text[])) as k
            where exists (select 1 from gettoni g where k = any(g.chiavi))
          ), 0),
          case
            when cp.coverage_keys is null or cardinality(cp.coverage_keys) = 0
              then case when ct.slug = p_city_slug then 15 else 0 end
            when p_zone_slug is null
                 and exists (
                   select 1 from unnest(cp.coverage_keys) as k where k like 'zone:%'
                 )
              then 15
            else 0
          end
        )::numeric
      end as punti
    from base b
    left join public.professional_coverage_public cp on cp.professional_id = b.id
    left join public.cities ct on ct.id = b.city_id
  ),
  valutazione as (
    select
      b.id,
      count(r.id)::integer as n,
      coalesce(avg(r.score), 0)::numeric as media
    from base b
    left join public.ratings r on r.professional_id = b.id
    group by b.id
  ),
  valutazione_punti as (
    select
      v.id,
      v.n,
      round(
        (25 * greatest(0, least(1,
          (((v.media * v.n + mp.media * 5) / (v.n + 5)) - 3.0) / 2.0
        )))::numeric, 2
      ) as punti
    from valutazione v cross join media_piattaforma mp
  ),
  -- Qui la differenza con la 072: il numero arriva dalla tabella pubblica,
  -- non dai messaggi. NULL vuol dire «non ancora misurato» e vale il centro.
  risposta as (
    select b.id, sg.risposta_minuti as minuti
    from base b
    left join public.professional_signals sg on sg.professional_id = b.id
  ),
  prezzo as (
    select
      b.id,
      case
        when p_subservice_slug is not null and exists (
          select 1
          from public.professional_services ps
          join public.subservices ss on ss.id = ps.subservice_id
          where ps.professional_id = b.id
            and ss.slug = p_subservice_slug
            and ps.min_price is not null
        ) then 15::numeric
        when exists (
          select 1 from public.professional_services ps
          where ps.professional_id = b.id and ps.min_price is not null
        ) then 10::numeric
        else 0::numeric
      end as punti
    from base b
  ),
  disponibilita as (
    select
      b.id,
      case
        when exists (
               select 1 from public.professional_availability pa
               where pa.professional_id = b.id
             )
             and exists (
               select 1 from public.professional_services ps
               where ps.professional_id = b.id and ps.instant_book_enabled
             ) then 10::numeric
        when exists (
               select 1 from public.professional_availability pa
               where pa.professional_id = b.id
             ) then 7::numeric
        else 5::numeric
      end as punti
    from base b
  ),
  altro as (
    select
      b.id,
      case b.verification_status
        when 'verified' then 7::numeric
        when 'pending' then 3::numeric
        else 0::numeric
      end as punti_verifica,
      (
        (case when coalesce(length(btrim(b.bio)), 0) > 0 then 1 else 0 end)
        + (case when coalesce(length(btrim(b.business_name)), 0) > 0 then 1 else 0 end)
        + (case when exists (
              select 1 from public.professional_services ps
              where ps.professional_id = b.id and ps.subservice_id is not null
            ) then 1 else 0 end)
      )::numeric as punti_completezza
    from base b
  ),
  intervento as (
    select
      b.id,
      p_subservice_slug is not null and exists (
        select 1
        from public.professional_services ps
        join public.subservices ss on ss.id = ps.subservice_id
        where ps.professional_id = b.id and ss.slug = p_subservice_slug
      ) as offre
    from base b
  )
  select
    b.id as professional_id,
    i.offre as offre_intervento,
    round(
      a.punti + vp.punti + rp.punti + pz.punti + d.punti
        + al.punti_verifica + al.punti_completezza, 2
    ) as punti,
    a.punti as punti_area,
    vp.punti as punti_valutazione,
    rp.punti as punti_risposta,
    pz.punti as punti_prezzo,
    d.punti as punti_disponibilita,
    al.punti_verifica,
    al.punti_completezza,
    r.minuti as risposta_minuti,
    vp.n as valutazioni
  from base b
  join area a on a.id = b.id
  join valutazione_punti vp on vp.id = b.id
  join risposta r on r.id = b.id
  join lateral (
    select case
      when r.minuti is null then 10::numeric
      when r.minuti <= 30 then 20::numeric
      when r.minuti <= 120 then 16::numeric
      when r.minuti <= 480 then 12::numeric
      when r.minuti <= 1440 then 8::numeric
      when r.minuti <= 4320 then 4::numeric
      else 0::numeric
    end as punti
  ) rp on true
  join prezzo pz on pz.id = b.id
  join disponibilita d on d.id = b.id
  join altro al on al.id = b.id
  join intervento i on i.id = b.id;
$$;

comment on function public.professionals_score(uuid[], text, text, text) is
  'Il punteggio di merito 0-100 pubblicato su /come-funziona#ordine, con gli addendi in chiaro. Chi dichiara il lavoro cercato ordina PRIMA (offre_intervento), il punteggio ordina dentro il gruppo. SECURITY INVOKER dalla 075: legge solo tabelle a lettura pubblica. Vedi docs/RICERCA.md sezione 4.';

revoke all on function public.professionals_score(uuid[], text, text, text) from public;
grant execute on function public.professionals_score(uuid[], text, text, text) to anon, authenticated;

commit;
