-- 069: i token al sicuro, e fra due risposte quasi pari vince la più precisa.
--
-- Due correzioni, trovate dalla stessa sessione di prove sul risolutore della
-- 068. La prima è una trappola armata nel modo in cui si ri-semina il
-- catalogo; la seconda è un ordine di risposta che contraddiceva una regola
-- che questo progetto ha già dichiarato.
--
-- ===========================================================================
-- PARTE 1 - I token non dipendono più dalla versione di UNA funzione.
-- ===========================================================================
--
-- IL DIFETTO, trovato provando a ri-seminare il catalogo. La 067 dice, e dice
-- giusto, che per rendere cercabile un intervento aggiunto in admin basta
-- rigiocare le sue due insert. Ma quel file contiene anche
-- `create or replace function public.search_terms_normalizza()` nella versione
-- di allora, che non conosce la colonna tokens: rigiocare la 067 dopo la 068
-- riporta indietro il trigger, e da quel momento ogni termine nuovo nasce con
-- tokens vuoto.
--
-- Non è un guasto che si vede. La riga c'è, si legge, si trova per prefisso e
-- per trigrammi: sparisce solo dal confronto per parole piene, cioè da quello
-- che fa funzionare «mi si è otturato lo scarico». Una ricerca che peggiora in
-- silenzio. Provato: dopo un replay della 067, 74 termini su 150 senza parole
-- piene, e «pulizie fine locazione» che smetteva di trovare
-- «Fine locazione o trasloco».
--
-- In produzione NON è avvenuto — 491 termini, 0 senza token, le migrazioni
-- applicate nell'ordine giusto e nessuna ri-semina. Trappola armata, non
-- incendio.
--
-- LA CORREZIONE. I token li scrive un trigger PROPRIO, con un nome proprio,
-- che la 067 non conosce e quindi non può togliere. Il nome conta: a parità di
-- evento Postgres esegue i trigger in ordine alfabetico, e
-- `search_terms_tokens_trg` viene dopo `search_terms_normalizza_trg` — prima
-- si normalizza il termine, poi si prendono le parole piene di quel termine.
-- Senza clausola OF: qualunque scrittura ricalcola, così non esiste un modo di
-- aggiornare la riga che lasci i due campi in disaccordo. Il trigger della 068
-- continua a scriverli: è una ridondanza voluta, se una strada si rompe
-- l'altra tiene.

create or replace function public.search_terms_set_tokens()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.tokens := public.search_tokens(new.term);
  return new;
end;
$$;

comment on function public.search_terms_set_tokens() is
  'Tiene search_terms.tokens in accordo col termine. Trigger separato di proposito: un replay della 067 non lo puo portare indietro.';

drop trigger if exists search_terms_tokens_trg on public.search_terms;
create trigger search_terms_tokens_trg
  before insert or update on public.search_terms
  for each row execute function public.search_terms_set_tokens();

-- Ripara quello che una ri-semina avesse gia' lasciato indietro, e qualunque
-- altro disaccordo. Diretto e non passando dal trigger: e' la riga che deve
-- valere anche se il trigger in carica fosse quello vecchio.
update public.search_terms
   set tokens = public.search_tokens(term)
 where tokens is distinct from public.search_tokens(term);

-- ===========================================================================
-- PARTE 2 - Fra due risposte quasi pari, vince quella più precisa.
-- ===========================================================================
--
-- IL DIFETTO, visto in produzione sul vocabolario vero. Due domande su sedici
-- mettevano il mestiere davanti all'intervento:
--
--   «pulizie fine locazione navigli»
--     Pulizie [contenuto 0.85]  prima di  Fine locazione o trasloco [somiglianza 0.83]
--   «quanto costa imbiancare casa»
--     Imbianchino [contenuto 0.85]  prima di  Tinteggiatura interni [contenuto 0.85]
--
-- Nel primo caso il generico vince per due centesimi. Nel secondo i due
-- punteggi sono identici e decide l'ordine alfabetico: «Imbianchino» viene
-- prima di «Tinteggiatura interni», e questo è tutto il ragionamento.
--
-- Ma chi scrive «pulizie fine locazione» ha già detto il mestiere e ha
-- aggiunto il lavoro: la seconda metà della frase è l'informazione in più, e
-- portarlo su «Pulizie» butta via proprio quella. È anche in contraddizione
-- con la regola dichiarata del ranking dei professionisti — chi dichiara
-- l'intervento esatto batte chi dichiara solo il mestiere — e due parti dello
-- stesso motore di ricerca non possono ordinare il mondo in due modi.
--
-- LA CORREZIONE, e perché non è «aggiungo qualche punto agli interventi».
-- Sommare un bonus vorrebbe dire mescolare due cose diverse — quanto la frase
-- somiglia al termine, e quanto quel termine è specifico — in un unico numero
-- che poi non si sa più leggere, e che finirebbe mostrato alla persona come
-- «fiducia». Invece il punteggio resta quello che è e si arrotonda a bande di
-- 0.05 SOLO per ordinare: dentro una banda i punteggi si dichiarano
-- equivalenti, ed è lì che entra il secondo criterio. Fuori dalla banda comanda
-- ancora il punteggio, quindi 0.99 sta sempre davanti a 0.85 e il prefisso
-- (0.80) sta sempre sotto al contenuto (0.85).
--
-- L'ordine dei criteri, a parità di banda:
--   1. una corrispondenza esatta resta prima di tutto — se la frase È un
--      termine, quel termine è la risposta e non si discute;
--   2. poi l'intervento prima del mestiere;
--   3. poi il punteggio pieno, il peso, il nome.
--
-- Cambia solo l'ORDINE della risposta, non chi ci sta dentro: la soglia di 0.40
-- e i quattro modi di somigliare restano quelli della 068.
--
-- Idempotente: create or replace.

create or replace function public.search_resolve(p_query text, p_limit int default 8)
returns jsonb
language plpgsql
stable
set search_path = public, extensions, pg_temp
as $$
declare
  v_norm     text;
  v_what     text;
  v_city     text;
  v_zone     text;
  v_parola   text;
  v_citta    text;
  v_near_me  boolean := false;
  v_matches  jsonb;
begin
  v_norm := public.search_normalize(p_query);
  if v_norm is null then
    return jsonb_build_object(
      'query', p_query, 'normalized', null, 'what', null,
      'city', null, 'zone', null, 'near_me', false, 'matches', '[]'::jsonb);
  end if;

  if v_norm ~ '(^| )vicino a me( |$)' then
    v_near_me := true;
    v_norm := regexp_replace(v_norm, '(^| )vicino a me( |$)', ' ', 'g');
  end if;

  v_what := trim(regexp_replace(v_norm, ' +', ' ', 'g'));

  select z.slug, c.slug, n.nome
    into v_zone, v_city, v_parola
  from public.city_zones z
  join public.cities c on c.id = z.city_id
  cross join lateral (
    select public.search_normalize(p) as nome
    from unnest(string_to_array(z.label, '/')) as p
    union
    select public.search_normalize(replace(z.slug, '-', ' '))
  ) n
  where n.nome is not null
    and v_what ~ ('(^| )' || n.nome || '( |$)')
  order by length(n.nome) desc
  limit 1;

  if v_parola is not null then
    v_what := trim(regexp_replace(v_what, '(^| )' || v_parola || '( |$)', ' ', 'g'));
  end if;

  v_parola := null;

  select n.nome, c.slug
    into v_parola, v_citta
  from public.cities c
  cross join lateral (
    select public.search_normalize(c.name) as nome
    union
    select public.search_normalize(replace(c.slug, '-', ' '))
  ) n
  where n.nome is not null
    and v_what ~ ('(^| )' || n.nome || '( |$)')
  order by length(n.nome) desc
  limit 1;

  if v_parola is not null then
    v_city := coalesce(v_citta, v_city);
    v_what := trim(regexp_replace(v_what, '(^| )' || v_parola || '( |$)', ' ', 'g'));
  end if;
  v_what := nullif(trim(regexp_replace(coalesce(v_what, ''), ' +', ' ', 'g')), '');

  if v_what is null or char_length(v_what) < 2 then
    v_matches := '[]'::jsonb;
  else
    with q as (
      select v_what as frase, public.search_tokens(v_what) as toks
    ),
    punteggi as (
      select
        st.kind, st.service_id, st.subservice_id, st.display, st.weight,
        case
          when st.term = q.frase then 1.00::real
          when position(' ' || st.term || ' ' in ' ' || q.frase || ' ') > 0 then 0.85::real
          when st.term like q.frase || '%' then 0.80::real
          when cardinality(q.toks) >= 2
               and not exists (select 1 from unnest(st.tokens) x where x = any (q.toks))
            then 0::real
          else least(0.99::real, greatest(
                 similarity(
                   coalesce(nullif(array_to_string(st.tokens, ' '), ''), st.term),
                   coalesce(nullif(array_to_string(q.toks, ' '), ''), q.frase)
                 ),
                 case
                   when cardinality(st.tokens) = 0 or cardinality(q.toks) = 0 then 0::real
                   else (
                     (select count(*) from unnest(st.tokens) x where x = any (q.toks))::real
                     / cardinality(st.tokens)::real * 0.9::real
                   )::real
                 end
               ))
        end as score,
        case
          when st.term = q.frase then 'esatto'
          when position(' ' || st.term || ' ' in ' ' || q.frase || ' ') > 0 then 'contenuto'
          when st.term like q.frase || '%' then 'prefisso'
          else 'somiglianza'
        end as modo
      from public.search_terms st
      cross join q
    ),
    migliori as (
      select distinct on (
        service_id, coalesce(subservice_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ) kind, service_id, subservice_id, display, weight, score, modo
      from punteggi
      where score >= 0.40
      order by service_id,
               coalesce(subservice_id, '00000000-0000-0000-0000-000000000000'::uuid),
               score desc, weight desc
    ),
    -- La banda e i criteri che entrano in gioco dentro di essa. Vivono in una
    -- CTE e non dentro un order by perché lo stesso ordine serve due volte:
    -- per tagliare a p_limit e per costruire la risposta.
    ordinate as (
      select m.kind, s.slug as service_slug, sub.slug as subservice_slug,
             m.display, m.score, m.modo, m.weight,
             round((m.score / 0.05)::numeric) as banda,
             (m.modo = 'esatto') as esatto,
             (m.subservice_id is not null) as preciso
      from migliori m
      join public.services s on s.id = m.service_id
      left join public.subservices sub on sub.id = m.subservice_id
    )
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'kind', r.kind,
                 'service', r.service_slug,
                 'subservice', r.subservice_slug,
                 'display', r.display,
                 'score', round(r.score::numeric, 2),
                 'how', r.modo
               )
               order by r.banda desc, r.esatto desc, r.preciso desc,
                        r.score desc, r.weight desc, r.display
             ),
             '[]'::jsonb
           )
      into v_matches
    from (
      select * from ordinate
      order by banda desc, esatto desc, preciso desc, score desc, weight desc, display
      limit p_limit
    ) r;
  end if;

  return jsonb_build_object(
    'query', p_query,
    'normalized', v_norm,
    'what', v_what,
    'city', v_city,
    'zone', v_zone,
    'near_me', v_near_me,
    'matches', v_matches
  );
end;
$$;

comment on function public.search_resolve(text, int) is
  'Da una frase battuta in una casella: il luogo (zona e città), se ha detto «vicino a me», e i punti di catalogo che sta cercando, con un punteggio di fiducia. A parità di banda di punteggio vince la corrispondenza esatta, poi l''intervento sul mestiere. Legge solo dati di catalogo, pubblici.';

grant execute on function public.search_resolve(text, int) to anon, authenticated;
