-- 102: la distanza entra nel punteggio (cutover della 098).
--
-- IL CANCELLO DELLA 098 SI APRE QUI. La 098 aveva messo `punti_distanza`
-- solo come colonna di confronto, con una precondizione bloccante esplicita:
-- "nessuna migrazione di cutover finché cap_centroids (pezzo 3) non dà a
-- Milano un punto base più fine del comune". La 101 ha costruito
-- `cap_centroids`: da qui, `professionals.postal_code` (085) dà un punto per
-- CAP a chi l'ha scritto, non più il centroide unico del comune che faceva
-- collassare ogni pro milanese sullo stesso punto (San Siro e Gratosoglio,
-- 7,12 km veri, stessa banda — il difetto che la 098 documenta per esteso).
--
-- DEVIAZIONE DALLA TRACCIA: NON SI USA professional_coverage.center_lat/lng.
-- La traccia di questo lavoro lo chiedeva come ripiego intermedio (fra
-- cap_centroids e il centroide del comune). La 098 aveva già scartato
-- esplicitamente questa stessa idea, con un motivo che resta vero oggi
-- quanto allora: `professionals_score` è SECURITY INVOKER dalla 075, e la
-- RLS di `professional_coverage` (057) nega la lettura ad anon/authenticated
-- — solo il professionista proprietario o lo staff vedono quella riga.
-- Aggiungerlo come fallback non romperebbe niente in modo rumoroso: per
-- ogni cliente che chiama la ricerca la join restituirebbe silenziosamente
-- zero righe, il codice sembrerebbe corretto, e si ricadrebbe comunque sul
-- comune — cioè il ripiego esisterebbe sulla carta e non nel comportamento
-- reale, esattamente il tranello che la 098 nomina ("quel tranello è stato
-- evitato, non ripetuto"). Ripeterlo ora, in silenzio, sarebbe la stessa
-- cosa. Il fallback resta a due soli livelli: cap_centroids, poi comuni.
-- Se in futuro serve davvero il centro del cerchio di copertura, la strada
-- è renderlo leggibile con lo stesso criterio delle altre tabelle che questa
-- funzione legge (RLS pubblica o un dato derivato da pubblicare, come
-- coverage_keys già fa per zone/comuni) — non una funzione SECURITY DEFINER
-- che farebbe uscire coordinate precise di un professionista attraverso le
-- bande di distanza a chiunque interroghi la ricerca.
--
-- LE BANDE (max 4, sostituiscono la colonna-solo-confronto della 098):
-- ≤5 km → 4, ≤10 km → 3, ≤25 km → 2, ≤50 km → 1, oltre → 0, punto mancante
-- (professionista o richiesta senza coordinate) → 2, il centro della scala:
-- né premiato né penalizzato da un dato che manca, stesso principio della
-- banda 10 sul tempo di risposta (075).
--
-- L'AREA SI RISCALA PER FARE POSTO: la vecchia scala (specificità del
-- gettone: zona 20, comune 18, città 15, provincia 8, regione 4, macro 3,
-- Italia 2 — 094) valeva da sola 20 punti su 100. Sposta 4 punti dentro
-- `punti_distanza`, mantenendo le proporzioni relative fra i livelli:
-- zona 16, comune 14, città 12, provincia 6, regione 3, macro 2, Italia 1.
-- Stesso ridimensionamento sui due rami di ripiego che valevano quanto
-- "città" (15 → 12): nessuna copertura dichiarata ma città che combacia; un
-- professionista a zone contro una richiesta senza zona. Per lo stesso
-- motivo scende a 12 anche il ramo "nessuna città nella richiesta" (prima
-- 15, un valore isolato che non aveva senso lasciare sopra "città" ora che
-- "città" vale 12).
--
-- CONTO DEI 100 PUNTI, VERIFICATO: valutazione 25 + area 16 + distanza 4 +
-- risposta 20 + prezzo 15 + disponibilità 10 + verifica 7 + completezza 3
-- = 100. La frase di /come-funziona "la zona e il tempo di risposta pesano
-- uguale fra loro" resta vera: area (16) conta ancora meno di risposta (20)
-- da sola, ma "zona" nel senso della pagina è area+distanza insieme (chi
-- lavora dove serve, misurato in due modi) — 16 + 4 = 20, esattamente pari
-- a risposta. Il paragrafo di quella pagina cambia nella prossima migrazione
-- di questo lavoro, non qui: qui cambia solo il calcolo.
--
-- RLS VERIFICATA SULLE TABELLE CHE QUESTA VERSIONE LEGGE IN PIÙ: solo
-- `cap_centroids` (101) è nuova qui — lettura pubblica per chiunque
-- (`using (true)`, nessuna riga staff-only), quindi SECURITY INVOKER resta
-- sicuro: un cliente anonimo legge le stesse righe che leggerebbe lo staff,
-- come già verificato dalla 098 per comuni/city_zones/cities/
-- professional_coverage_public/professionals.
--
-- Idempotente: drop-then-create (il parametro nuovo cambia la firma).

drop function if exists public.professionals_score(uuid[], text, text, text, text);

create or replace function public.professionals_score(
  p_ids uuid[],
  p_city_slug text default null,
  p_zone_slug text default null,
  p_subservice_slug text default null,
  p_comune_istat text default null,
  p_cap text default null
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
  punti_distanza numeric,
  risposta_minuti numeric,
  valutazioni integer
)
language sql
stable
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
      pr.verification_level,
      pr.verification_badge_until,
      pr.verification_badge_max_until,
      pr.verification_under_review,
      pr.city_id,
      pr.comune_istat,
      pr.postal_code
    from public.professionals pr
    where pr.id = any(p_ids)
      and pr.deactivated_at is null
  ),
  area as (
    select
      b.id,
      case
        -- "Nessuna città nella richiesta" allineato al valore di "città"
        -- (12): un default che vale più della città vera non avrebbe senso
        -- dopo il riscalaggio.
        when p_city_slug is null then 12::numeric
        else greatest(
          coalesce((
            select max(
              case split_part(k, ':', 1)
                when 'zone' then 16 when 'comune' then 14 when 'city' then 12
                when 'prov' then 6  when 'reg' then 3     when 'macro' then 2
                when 'it' then 1
                else 0
              end
            )
            from unnest(coalesce(cp.coverage_keys, '{}'::text[])) as k
            where exists (select 1 from gettoni g where k = any(g.chiavi))
          ), 0),
          case
            when cp.coverage_keys is null or cardinality(cp.coverage_keys) = 0
              then case when ct.slug = p_city_slug then 12 else 0 end
            when p_zone_slug is null
                 and exists (
                   select 1 from unnest(cp.coverage_keys) as k where k like 'zone:%'
                 )
              then 12
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
      case
        when b.verification_badge_max_until is not null
             and b.verification_badge_max_until <= now()
          then 0::numeric
        when b.verification_badge_until is not null
             and b.verification_badge_until <= now()
             and not coalesce(b.verification_under_review, false)
          then 0::numeric
        else case b.verification_level
          when 'documents_verified' then 7::numeric
          when 'vat_verified' then 5::numeric
          else 0::numeric
        end
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
  ),
  -- Il punto del professionista: il CAP dichiarato (085), poi il centroide
  -- del comune. Non il centro del cerchio di copertura — vedi il commento
  -- in testa al file.
  base_punto as (
    select
      b.id,
      coalesce(cc.lat, co.lat) as lat,
      coalesce(cc.lng, co.lng) as lng
    from base b
    left join public.cap_centroids cc on cc.cap = b.postal_code
    left join public.comuni co on co.istat = b.comune_istat
  ),
  -- Il punto della richiesta: il CAP se il cliente l'ha dato (p_cap), poi la
  -- zona (city_zones, se dichiarata), poi il comune.
  richiesta_punto as (
    select
      coalesce(cc.lat, z.lat, co.lat) as lat,
      coalesce(cc.lng, z.lng, co.lng) as lng
    from (select 1) uno
    left join public.cap_centroids cc on cc.cap = p_cap
    left join public.cities c on c.slug = p_city_slug
    left join public.city_zones z
      on z.city_id = c.id and z.slug = p_zone_slug and p_zone_slug is not null
    left join public.comuni co
      on co.istat = coalesce(p_comune_istat, c.comune_istat)
  ),
  distanza as (
    select
      bp.id,
      case
        when bp.lat is null or bp.lng is null or rq.lat is null or rq.lng is null
          then 2::numeric
        when hk.km <= 5  then 4::numeric
        when hk.km <= 10 then 3::numeric
        when hk.km <= 25 then 2::numeric
        when hk.km <= 50 then 1::numeric
        else 0::numeric
      end as punti
    from base_punto bp
    cross join richiesta_punto rq
    cross join lateral (
      select case
        when bp.lat is null or rq.lat is null then null
        else 6371000 * 2 * asin(sqrt(
               power(sin(radians(rq.lat - bp.lat) / 2), 2)
               + cos(radians(bp.lat)) * cos(radians(rq.lat))
                 * power(sin(radians(rq.lng - bp.lng) / 2), 2)
             )) / 1000
      end as km
    ) hk
  )
  select
    b.id as professional_id,
    i.offre as offre_intervento,
    round(
      a.punti + vp.punti + rp.punti + pz.punti + d.punti
        + al.punti_verifica + al.punti_completezza + ds.punti, 2
    ) as punti,
    a.punti as punti_area,
    vp.punti as punti_valutazione,
    rp.punti as punti_risposta,
    pz.punti as punti_prezzo,
    d.punti as punti_disponibilita,
    al.punti_verifica,
    al.punti_completezza,
    ds.punti as punti_distanza,
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
  join intervento i on i.id = b.id
  join distanza ds on ds.id = b.id;
$$;

comment on function public.professionals_score(uuid[], text, text, text, text, text) is
  'Punteggio di ordinamento (072, riscalata 089/094/102): valutazione 25, area 16, distanza 4, risposta 20, prezzo 15, disponibilità 10, verifica 7, completezza 3 = 100. La 102 sposta punti_distanza dentro punti (prima 098: colonna di solo confronto) ora che cap_centroids (101) dà un punto più fine del comune. SECURITY INVOKER: legge solo tabelle a lettura pubblica, mai professional_coverage (privata).';

revoke all on function public.professionals_score(uuid[], text, text, text, text, text) from public;
grant execute on function public.professionals_score(uuid[], text, text, text, text, text) to anon, authenticated;
