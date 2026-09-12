-- 077_prezzo_anche_a_tariffa.sql
--
-- PERCHE' ESISTE
--
-- La voce «prezzo» del punteggio (072, riscritta dalla 075) guardava soltanto
-- `min_price`: la forbice «da 40 a 60 euro». Ma un professionista puo'
-- dichiarare il prezzo anche come **tariffa nell'unita' del suo mestiere** —
-- `rate_amount` con `rate_unit`, per esempio 20 €/ora — e in quel caso il
-- punteggio si comportava come se non avesse scritto nessun prezzo.
--
-- Non e' un caso di scuola: delle 8 righe di offerta senza forbice, **3 hanno
-- una tariffa** (Milano Clean Squad, 20 / 20 / 30 €/ora su pulizie ordinarie,
-- pulizia profonda e uffici piccoli). Chi ha risposto alla domanda nel modo
-- giusto per il suo mestiere prendeva meno punti di chi ha risposto nel modo
-- che ci aspettavamo noi. Verificato in produzione: su una ricerca di
-- «pulizie ordinarie» quel professionista passa da 10 a 15 punti, e nessun
-- altro cambia.
--
-- La regola diventa: **conta un prezzo, in qualunque forma sia stato
-- dichiarato** — forbice, solo massimo, o tariffa.
-- `coalesce(min_price, max_price, rate_amount) is not null`.
--
-- QUELLO CHE ANCORA NON TORNA, E VA DETTO
--
-- La scheda pubblica mostra la forbice, quindi quelle tre tariffe il cliente
-- **non le vede** ancora: e' la voce aperta «tariffa nell'unita' del mestiere
-- e costi accessori — colonne in database, nessuna interfaccia». Da oggi il
-- punteggio premia la dichiarazione, com'e' giusto (il buco e' nostro, non
-- suo), ma la promessa di `/come-funziona#ordine` — «un preventivo che non
-- c'e' non ti aiuta a decidere» — e' mantenuta a meta' finche' la scheda non
-- lo scrive. Le due cose vanno chiuse insieme, e la seconda e' interfaccia.
--
-- NUMERAZIONE: la 076 resta ai doppioni del catalogo, come concordato con
-- Lucio dopo la collisione della 075. Non si prende un numero prenotato solo
-- perche' il file non c'e' ancora.
--
-- Identica alla 075 tranne la CTE `prezzo`. Idempotente: drop + create or
-- replace, come le precedenti.

begin;

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
  risposta as (
    select b.id, sg.risposta_minuti as minuti
    from base b
    left join public.professional_signals sg on sg.professional_id = b.id
  ),
  -- PREZZO (0-15). Conta un prezzo DICHIARATO, in qualunque forma: la forbice,
  -- il solo massimo, o la tariffa nell'unita' del mestiere. Prima guardava
  -- solo `min_price`, e tre righe con la tariffa oraria contavano come «senza
  -- prezzo». Restano zero punti solo a chi non ha scritto niente da nessuna
  -- parte. I punti vanno alla dichiarazione, non al numero piu' basso.
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
            and coalesce(ps.min_price, ps.max_price, ps.rate_amount) is not null
        ) then 15::numeric
        when exists (
          select 1 from public.professional_services ps
          where ps.professional_id = b.id
            and coalesce(ps.min_price, ps.max_price, ps.rate_amount) is not null
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
  'Il punteggio di merito 0-100 pubblicato su /come-funziona#ordine, con gli addendi in chiaro. Chi dichiara il lavoro cercato ordina PRIMA (offre_intervento), il punteggio ordina dentro il gruppo. SECURITY INVOKER dalla 075. Dalla 077 la voce prezzo conta anche la tariffa nell''unita'' del mestiere, non solo la forbice. Vedi docs/RICERCA.md sezione 4.';

revoke all on function public.professionals_score(uuid[], text, text, text) from public;
grant execute on function public.professionals_score(uuid[], text, text, text) to anon, authenticated;

commit;
