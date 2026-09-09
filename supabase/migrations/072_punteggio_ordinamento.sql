-- 072_punteggio_ordinamento.sql
--
-- PERCHE' ESISTE
--
-- Fino a oggi l'ordine dei professionisti era una catena di spareggi scritta
-- in JavaScript (`getProfessionals` in src/lib/data.ts): intervento, area,
-- verifica, valutazione, prezzo, ognuno che decide tutto quando il precedente
-- pareggia. La tabella dei pesi pubblicata su /come-funziona#ordine e in
-- docs/RICERCA.md descriveva invece un PUNTEGGIO. Le due cose non erano la
-- stessa, e la pagina pubblica e' quella che vale: art. 22 co. 4-bis Cod.
-- Consumo verso i clienti, art. 5 Reg. UE 2019/1150 verso i professionisti.
-- Questa migrazione rende vero il punteggio, e lo fa in SQL perche' due dei
-- segnali che lo compongono — le valutazioni e il tempo di risposta misurato —
-- stanno in tabelle che il browser di un cliente non puo' leggere.
--
-- DUE FASI, NON UNA SOMMA SOLA
--
-- Chi dichiara proprio il lavoro cercato sta in un gruppo che viene PRIMA:
-- nessun punteggio di merito lo scavalca. Il punteggio ordina DENTRO il
-- gruppo. In una somma unica un profilo pieno di stelle avrebbe potuto
-- superare chi fa esattamente quel lavoro, che e' la domanda che il cliente
-- ha fatto.
--
-- QUANDO NON SAPPIAMO, VALE LA MEDIA
--
-- Un segnale che non abbiamo ancora misurato non toglie punti: il tempo di
-- risposta senza dati vale il centro della scala, le valutazioni si smorzano
-- verso la media della piattaforma e non verso zero, gli orari non dichiarati
-- valgono il centro. Un ordinamento che punisce l'assenza di dati misura noi,
-- non il professionista: cinque pro su sei non hanno orari perche' non li
-- abbiamo mai chiesti.
--
-- COSA NON ENTRA, E RESTA FUORI FINCHE' NON E' SCRITTO QUI E IN PAGINA
--
-- Il comportamento del singolo cliente, la sua cronologia, qualunque
-- profilazione, e qualunque pagamento. Il punteggio e' identico per tutti.

-- ---------------------------------------------------------------------------
-- Il punteggio di merito, 0-100, con i suoi addendi in chiaro.
--
-- Restituisce le singole voci e non solo il totale: docs/RICERCA.md promette
-- di saper rispondere a un professionista che chiede perche' e' settimo, e
-- una risposta si da' con gli addendi, non con un numero.
--
-- SECURITY DEFINER e' necessario, non comodo: `ratings` e soprattutto
-- `request_messages` non sono leggibili da chi non e' parte della
-- conversazione, ed e' giusto. La funzione ne fa uscire solo aggregati per
-- professionista — un conteggio, una media, dei minuti — mai un messaggio,
-- mai un cliente. `search_path` e' fissato perche' un definer con path
-- mutabile e' un rilievo degli advisor e un rischio vero.
-- ---------------------------------------------------------------------------

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
      end as chiave_zona
    from (select 1) uno
    left join public.cities c on c.slug = p_city_slug
  ),
  gettoni as (
    select chiave_zona || chiavi_base as chiavi from richiesta
  ),
  media_piattaforma as (
    -- La media di tutte le valutazioni. Con zero valutazioni si parte da 4.0:
    -- un valore neutro dichiarato, non uno zero travestito da media.
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
  -- AREA (0-20). La precisione dell'area con cui il professionista risponde
  -- alla richiesta. La regola di compatibilita' della 057/058 vale ancora e
  -- sta qui: chi non ha dichiarato nessuna area vale come «tutta la citta' in
  -- cui e' iscritto», altrimenti il giorno del deploy spariscono cinque pro
  -- su sei. E una richiesta senza quartiere non penalizza chi lavora per
  -- quartieri: vale come chi ha dichiarato la citta'.
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
            -- `= any(subquery)` con una colonna array e' ambiguo: Postgres
            -- puo' leggerlo come «uno dei valori restituiti» invece di «uno
            -- degli elementi dell'array». L'exists non lascia scelta.
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
  -- VALUTAZIONE (0-25), smorzata verso la media della piattaforma e non verso
  -- zero. Cinque recensioni finte non bastano a vincere, e un profilo nuovo
  -- non parte ultimo per il solo fatto di essere nuovo: parte dalla media.
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
    -- La media smorzata verso la media della piattaforma: peso 5 al prior,
    -- come pubblicato. Poi la scala: 3,0 stelle valgono 0 punti e 5,0 ne
    -- valgono 25. Senza questo secondo passaggio il punteggio si schiaccia —
    -- con tutte le medie fra 4,7 e 4,9 la voce «valutazione» distribuiva
    -- meno di un punto su venticinque, cioe' non distingueva nessuno.
    -- Sotto le tre stelle la valutazione smette di dare punti: non toglie
    -- nulla al resto, ma non aggiunge.
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
  -- RISPOSTA (0-20). Misurata, non dichiarata: la mediana dei minuti fra il
  -- primo messaggio del cliente su una richiesta e la prima risposta del
  -- professionista su quella stessa richiesta, negli ultimi 90 giorni.
  -- `professionals.response_time_label` NON entra qui: e' una frase che il
  -- professionista scrive su di se', e premiarla vorrebbe dire premiare chi
  -- scrive, non chi risponde.
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
  -- PREZZO (0-15). Punti per un prezzo DICHIARATO, non per un prezzo basso.
  -- Premiare il piu' economico su prezzi che nessuno verifica sarebbe
  -- premiare chi scrive il numero piu' piccolo; un prezzo visibile invece e'
  -- la cosa che al cliente serve per decidere. Quindici punti se il prezzo
  -- c'e' sul lavoro cercato, dieci se c'e' su qualcosa che offre.
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
  -- DISPONIBILITA' (0-10). Orari veri piu' prenotazione immediata. Chi non ha
  -- dichiarato orari sta al centro (5): oggi sono cinque su sei, e non perche'
  -- non lavorino.
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
  -- VERIFICA (0-7) e COMPLETEZZA (0-3). Fatti noti, non misure mancanti:
  -- «non verificato» e' una risposta, non un dato che ci manca.
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
  'Il punteggio di merito 0-100 pubblicato su /come-funziona#ordine, con gli addendi in chiaro. Chi dichiara il lavoro cercato ordina PRIMA (offre_intervento), il punteggio ordina dentro il gruppo. Vedi docs/RICERCA.md sezione 4.';

revoke all on function public.professionals_score(uuid[], text, text, text) from public;
grant execute on function public.professionals_score(uuid[], text, text, text) to anon, authenticated;

-- Gli indici che questa funzione vuole. Con sei professionisti non servono a
-- niente; servono al primo mese in cui i professionisti sono seicento, ed e'
-- piu' facile crearli ora che ricordarsene allora.
create index if not exists ratings_professional_idx
  on public.ratings (professional_id);
create index if not exists request_messages_pro_request_idx
  on public.request_messages (professional_id, request_id, created_at);
create index if not exists professional_services_pro_idx
  on public.professional_services (professional_id);
