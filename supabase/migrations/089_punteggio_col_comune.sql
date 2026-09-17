-- 089: l'ordinamento impara il comune.
--
-- PERCHÉ
-- Dalla 087 un professionista può coprire i comuni e dalla 088 una richiesta
-- sa da quale comune arriva. Ma `professionals_score` (072) pesa i gettoni con
-- un elenco scritto a mano — zone 20, city 15, prov 8, reg 4, macro 3, it 2 —
-- e `comune` lì dentro non c'è: cade nell'`else 0`. Cioè: l'idraulico di
-- Cologno che risponde a una richiesta di Cologno prende zero punti d'area,
-- meno di chi ha dichiarato «tutta la provincia». L'incontro avviene e
-- l'ordine lo rovina.
--
-- COSA CAMBIA
-- Due cose sole, dentro la stessa funzione:
--   1. `comune` vale 18 — fra il quartiere (20) e la città (15). Un comune è
--      più preciso di «tutta Milano» e meno di «Isola».
--   2. La funzione accetta il comune della richiesta (p_comune_istat), perché
--      la città di Bob e il comune del cliente possono non coincidere: chi
--      scrive dal CAP di Sesto è a Sesto anche se la città scelta è Milano.
--      Senza questo parametro il gettone del comune della RICHIESTA non entra
--      mai nel confronto, e la regola nuova non servirebbe a niente.
--
-- PERCHÉ SI CANCELLA LA VECCHIA FIRMA
-- Un parametro in più con un default crea un'altra funzione, non la sostituisce:
-- con quattro argomenti Postgres non saprebbe quale chiamare e risponderebbe
-- «function is not unique». Quindi drop e ricreazione — nessuna vista dipende
-- da questa funzione, la chiama solo src/lib/data.ts via rpc.
--
-- Il resto del corpo è identico alla 072: copiato, non riscritto.
--
-- CONFORMITÀ
-- Nessun dato nuovo, nessuna finalità nuova: è l'ordinamento pubblicato su
-- /come-funziona#ordine, con un addendo in più nella stessa voce «area».
-- L'ordinamento resta spiegabile riga per riga (Reg. P2B art. 5): la tabella
-- dei pesi va aggiornata in docs/RICERCA.md §4 con «comune 18».
--
-- Idempotente: drop if exists + create or replace.

drop function if exists public.professionals_score(uuid[], text, text, text);

create or replace function public.professionals_score(
  p_ids uuid[],
  p_city_slug text default null,
  p_zone_slug text default null,
  p_subservice_slug text default null,
  p_comune_istat text default null
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
security definer
set search_path = public, extensions, pg_temp
as $$
  with richiesta as (
    select
      coalesce(c.coverage_keys, '{}'::text[]) as chiavi_base,
      case
        when p_zone_slug is not null and p_city_slug is not null
          then array['zone:' || p_city_slug || '/' || p_zone_slug]
        else '{}'::text[]
      end as chiave_zona,
      -- Il comune della richiesta (088). Può essere diverso da quello della
      -- città: è tutto il punto della 087.
      case
        when p_comune_istat is not null
          then array['comune:' || p_comune_istat]
        else '{}'::text[]
      end as chiave_comune
    from (select 1) uno
    left join public.cities c on c.slug = p_city_slug
  ),
  gettoni as (
    select chiave_zona || chiave_comune || chiavi_base as chiavi from richiesta
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
                when 'zone' then 20 when 'comune' then 18 when 'city' then 15
                when 'prov' then 8  when 'reg' then 4    when 'macro' then 3
                when 'it' then 2
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
  risposta as (
    select
      b.id,
      percentile_cont(0.5) within group (order by x.minuti) as minuti
    from base b
    left join (
      select
        m.professional_id,
        m.request_id,
        extract(epoch from (
          min(m.created_at) filter (where m.sender_type = 'professional')
          - min(m.created_at) filter (where m.sender_type = 'customer')
        )) / 60 as minuti
      from public.request_messages m
      where m.created_at > now() - interval '90 days'
      group by m.professional_id, m.request_id
    ) x on x.professional_id = b.id and x.minuti is not null and x.minuti >= 0
    group by b.id
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

comment on function public.professionals_score(uuid[], text, text, text, text) is
  'Il punteggio di merito 0-100 pubblicato su /come-funziona#ordine, con gli addendi in chiaro. Chi dichiara il lavoro cercato ordina PRIMA (offre_intervento), il punteggio ordina dentro il gruppo. Dalla 089 il gettone di comune vale 18, fra quartiere e città. Vedi docs/RICERCA.md sezione 4.';

revoke all on function public.professionals_score(uuid[], text, text, text, text) from public;
grant execute on function public.professionals_score(uuid[], text, text, text, text) to anon, authenticated;
