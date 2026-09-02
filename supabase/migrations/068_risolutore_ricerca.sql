-- 068: dalla frase scritta al catalogo — il risolutore della ricerca.
--
-- La 067 ha messo in tabella COME si scrivono le cose. Questa migrazione
-- risponde alla domanda che segue: data una frase qualsiasi battuta in una
-- casella, che cosa sta cercando questa persona, e dove?
--
-- DUE DOMANDE IN UNA FRASE. «idraulico milano» e «perde il rubinetto a porta
-- romana» contengono due informazioni diverse: un mestiere e un luogo. Se il
-- luogo non viene tolto dalla frase prima del confronto, «milano» sporca il
-- confronto col catalogo e nessun termine somiglia più a niente. Quindi prima
-- si stacca il DOVE, poi si confronta il resto col vocabolario.
--
-- La zona si cerca prima della città, e vince la corrispondenza più lunga: la
-- zona è più precisa (è il gettone che la 057/058 usa per il filtro), e senza
-- la regola della lunghezza «porta nuova» verrebbe deciso da «porta».
--
-- QUATTRO MODI DI SOMIGLIARE, IN ORDINE DI FIDUCIA. Uno solo non basta,
-- perché una casella di ricerca riceve tre cose molto diverse: una parola a
-- metà mentre si scrive, una frase intera, e un refuso.
--   1.00  la frase è esattamente un termine             «scarico otturato»
--   0.85  un termine sta dentro la frase, parola intera «mi si e otturato lo scarico»
--   0.80  un termine comincia con quello che ho battuto «idra» -> «idraulico»
--   0.40+ somiglianza: trigrammi, oppure quante parole  «rubinetti», «zanzarire»
--         piene del termine ricompaiono nella frase
--
-- La soglia è 0.40 e non 0.35: sotto quel valore, con 491 termini, arrivava
-- rumore. Si alza o si abbassa qui, in un posto solo.
--
-- IL PUNTEGGIO VA MOSTRATO, NON NASCOSTO. Sopra 0.80 la risposta è una
-- risposta: si può portare la persona direttamente sui risultati. Fra 0.40 e
-- 0.80 è un «forse cercavi», e l'interfaccia deve dirlo — perché a quel
-- livello il risolutore, onestamente, non sa. Esempio vero: «ho bisogno di un
-- preventivo per il bagno» dà due candidati a 0.45, Emergenza allagamento
-- (dal sinonimo «bagno allagato») e Rifacimento impianto bagno. Hanno in
-- comune con la frase una parola sola, «bagno», e quella parola sta in
-- mezzo catalogo: fra i due non decide il senso, decide l'ordine alfabetico.
-- Nessuna formula lo risolve senza capire l'italiano; a risolverlo sono due
-- cose fuori da qui — un sinonimo messo a mano quando il registro delle
-- ricerche mostrerà «bagno» fra le domande a vuoto, e un'interfaccia che a
-- 0.45 propone invece di affermare, con Bob come via d'uscita.
--
-- PERCHÉ IN SQL E NON IN TYPESCRIPT. Il confronto per somiglianza usa
-- l'indice GIN a trigrammi della 067, che vive nel database; rifarlo in
-- TypeScript vorrebbe dire portarsi in memoria tutto il vocabolario a ogni
-- richiesta. E la normalizzazione deve essere LA STESSA che ha scritto i
-- termini in tabella: due implementazioni della stessa regola sono due regole.
--
-- Idempotente: create or replace, add column if not exists, drop-then-create
-- per trigger e policy.

-- ---------------------------------------------------------------------------
-- 1. Le parole piene di una frase.
--    Servono al quarto modo di somigliare: «perde il rubinetto» e «rubinetto
--    che perde» hanno le stesse parole piene in ordine diverso, e nessun
--    confronto per prefisso o per sottostringa le mette in relazione.
--    Gli articoli e le preposizioni si buttano da tutte e due le parti, così
--    «aiuto compiti» resta confrontabile anche se un giorno «aiuto» finisse
--    fra le parole vuote.
-- ---------------------------------------------------------------------------

create or replace function public.search_tokens(p_text text)
returns text[]
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    array_agg(t) filter (
      where t <> '' and t <> all (array[
        'a','ad','agli','ai','al','alla','alle','allo','anche','c','che','chi',
        'ci','col','come','con','cui','da','dal','dalla','dalle','dallo','dei',
        'del','della','delle','dello','di','e','ed','gli','ho','i','il','in',
        'io','la','le','lo','ma','mi','mia','mie','miei','mio','ne','nel',
        'nella','nelle','no','non','o','per','piu','qualche','quale','quali',
        'quando','questa','queste','questi','questo','se','si','sono','su',
        'sui','sul','sulla','sulle','tra','un','una','uno',
        'cerco','cercasi','vorrei','serve','servirebbe','bisogno'
      ])
    ),
    '{}'::text[]
  )
  from unnest(string_to_array(coalesce(public.search_normalize(p_text), ''), ' ')) as t;
$$;

comment on function public.search_tokens(text) is
  'Le parole piene di una frase, senza articoli, preposizioni e verbi di intenzione. Usata dal confronto per sovrapposizione di parole in search_resolve.';

-- ---------------------------------------------------------------------------
-- 2. Le parole piene di ogni termine, scritte una volta sola.
--    Ricalcolarle a ogni battuta di tasto vuol dire 491 chiamate di regexp per
--    lettera. Le scrive il trigger che già normalizza il termine: una colonna
--    e non una colonna generata, perché search_tokens dipende da unaccent e
--    quindi non è immutable.
-- ---------------------------------------------------------------------------

alter table public.search_terms
  add column if not exists tokens text[] not null default '{}'::text[];

comment on column public.search_terms.tokens is
  'Parole piene del termine, mantenute dal trigger. Derivato: non si scrive a mano.';

create or replace function public.search_terms_normalizza()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.term := public.search_normalize(new.term);
  if new.term is null then
    raise exception 'search_terms: il termine è vuoto dopo la normalizzazione';
  end if;
  new.tokens := public.search_tokens(new.term);
  return new;
end;
$$;

drop trigger if exists search_terms_normalizza_trg on public.search_terms;
create trigger search_terms_normalizza_trg
  before insert or update of term on public.search_terms
  for each row execute function public.search_terms_normalizza();

-- Riempie le righe già in tabella facendo scattare il trigger su di esse.
-- `set term = term` non è un giro a vuoto: è un update DI term, che è la
-- condizione del trigger.
update public.search_terms set term = term where cardinality(tokens) = 0;

create index if not exists search_terms_tokens_idx
  on public.search_terms using gin (tokens);

-- ---------------------------------------------------------------------------
-- 3. Una policy sola sulla lettura.
--    La 067 aveva dato all'admin una policy `for all`, che comprende anche
--    SELECT: da quel momento OGNI lettura pubblica valutava due policy invece
--    di una, e gli advisor lo dicevano (multiple_permissive_policies, cinque
--    ruoli). La scrittura si spezza nei tre verbi che le servono davvero e
--    SELECT torna a essere governato da una regola sola.
--
--    private.is_admin() sta dentro un select: così Postgres lo valuta una
--    volta per interrogazione e non una volta per riga. È lo stesso motivo per
--    cui in questo repo si scrive ( select auth.uid() ) e non auth.uid().
-- ---------------------------------------------------------------------------

drop policy if exists "Admin writes search terms" on public.search_terms;

drop policy if exists "Admin inserts search terms" on public.search_terms;
create policy "Admin inserts search terms"
  on public.search_terms for insert
  with check ((select private.is_admin()));

drop policy if exists "Admin updates search terms" on public.search_terms;
create policy "Admin updates search terms"
  on public.search_terms for update
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Admin deletes search terms" on public.search_terms;
create policy "Admin deletes search terms"
  on public.search_terms for delete
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- 4. Il risolutore.
--    Torna un oggetto solo, in un giro di rete: che cosa, dove, e i candidati
--    con quanto ci si può fidare di ognuno.
-- ---------------------------------------------------------------------------

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

  -- «vicino a me» è un luogo, non un mestiere: «idraulico vicino a me» fa
  -- 8.100 ricerche al mese in Italia (SEO.md §1-B). Se non lo si stacca,
  -- «me» resta dentro la frase e sporca ogni confronto.
  if v_norm ~ '(^| )vicino a me( |$)' then
    v_near_me := true;
    v_norm := regexp_replace(v_norm, '(^| )vicino a me( |$)', ' ', 'g');
  end if;

  v_what := trim(regexp_replace(v_norm, ' +', ' ', 'g'));

  -- La zona, con la città che porta con sé. Un'etichetta può contenere due
  -- nomi («Bande Nere / Lorenteggio»): si spezza sulla barra PRIMA di
  -- normalizzare, perché la normalizzazione la barra la butta via.
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

  -- La città, che può essere detta anche insieme alla zona
  -- («porta romana milano»).
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

  -- Solo se una citta' e' stata davvero nominata: `select into` su zero
  -- righe azzera i bersagli, e cancellerebbe la citta' che la zona ha dato.
  if v_parola is not null then
    v_city := coalesce(v_citta, v_city);
    v_what := trim(regexp_replace(v_what, '(^| )' || v_parola || '( |$)', ' ', 'g'));
  end if;
  v_what := nullif(trim(regexp_replace(coalesce(v_what, ''), ' +', ' ', 'g')), '');

  -- Sotto le due lettere non si confronta per prefisso: «i» somiglia a mezzo
  -- catalogo. Due lettere sono il minimo che vuole dire qualcosa, e ci sono
  -- termini di due lettere veri: «dj», «pt».
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
          -- Con due o piu' parole piene, almeno UNA deve essere in comune.
          -- Senza questa riga la somiglianza cieca decide da sola, e su una
          -- frase lunga inventa parentele: «ho bisogno di un preventivo per il
          -- bagno» somigliava a «Emergenza allagamento» allo 0.45 — per i
          -- trigrammi in comune fra «bisogno» e «allagamento» — e si prendeva
          -- il primo posto. Una risposta sicura e sbagliata è peggio di
          -- nessuna risposta: chi non trova niente finisce sul ripiego
          -- onesto (il mestiere padre, o Bob) e la sua frase finisce nel
          -- registro delle ricerche a vuoto, che è come il vocabolario impara.
          when cardinality(q.toks) >= 2
               and not exists (select 1 from unnest(st.tokens) x where x = any (q.toks))
            then 0::real
          -- La somiglianza si misura fra PAROLE PIENE da entrambe le parti,
          -- non sul testo grezzo: gli articoli e le preposizioni sono
          -- trigrammi che somigliano a tutto.
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
    -- Una destinazione, una riga. «idraulico», «idraulici» e «idraulica»
    -- portano tutte e tre su Idraulico, e un menu che scrive tre volte
    -- «Idraulico» sembra rotto.
    migliori as (
      select distinct on (
        service_id, coalesce(subservice_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ) kind, service_id, subservice_id, display, weight, score, modo
      from punteggi
      where score >= 0.40
      order by service_id,
               coalesce(subservice_id, '00000000-0000-0000-0000-000000000000'::uuid),
               score desc, weight desc
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
               order by r.score desc, r.weight desc, r.display
             ),
             '[]'::jsonb
           )
      into v_matches
    from (
      select m.kind, s.slug as service_slug, sub.slug as subservice_slug,
             m.display, m.score, m.modo, m.weight
      from migliori m
      join public.services s on s.id = m.service_id
      left join public.subservices sub on sub.id = m.subservice_id
      order by m.score desc, m.weight desc, m.display
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
  'Da una frase battuta in una casella: il luogo (zona e città), se ha detto «vicino a me», e i punti di catalogo che sta cercando, con un punteggio di fiducia. Legge solo dati di catalogo, pubblici.';

grant execute on function public.search_resolve(text, int) to anon, authenticated;
