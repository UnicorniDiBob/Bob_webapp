-- 098: la copertura diventa un filtro con esclusioni, la distanza entra come
-- colonna di confronto (non ancora nel punteggio pubblicato).
--
-- IL DIFETTO CHE HA FATTO NASCERE QUESTA MIGRAZIONE. L'area vale per
-- specificità del gettone dichiarato (zona 20, comune 18, città 15, provincia
-- 8, regione 4, macro 3, Italia 2, professionals_score/094, CTE `area`): due
-- professionisti che coprono tutta Italia valgono uguale su una richiesta di
-- Milano, che il professionista sia a Milano o a Palermo. E lo schema di oggi
-- (professional_coverage, 057/087) ha un solo meccanismo — INCLUSIONI, mai
-- esclusioni — quindi escludere anche un solo comune irrilevante da una
-- copertura nazionale costringe a passare allo scope `comuni` e spuntare
-- ~7.903 comuni su 7.904 a mano: ognuno pubblica `comune:<istat>` (18 punti)
-- al posto di `it:*` (2). LO STESSO DIFETTO VALE A SCALA DI CITTÀ: escludere
-- un quartiere da «tutta Milano» (15 punti) costringe a scope `zones` con 87
-- quartieri su 88 spuntati, ognuno da 20 punti. Non è un caso limite del
-- nazionale, è strutturale a ogni confine di scope.
--
-- DUE PARTI, DUE CALENDARI DIVERSI DENTRO LA STESSA MIGRAZIONE.
--
-- PARTE A — la copertura diventa filtro con esclusioni. VA IN PRODUZIONE
-- SUBITO, senza il confronto affiancato che la parte B invece richiede: non
-- tocca `punti` (nessuna riga esistente ha un'esclusione, quindi il
-- comportamento di ogni copertura scritta prima di oggi è IDENTICO — provato
-- in src/lib/copertura.test.ts, non assunto: 220 confronti fra la regola
-- vecchia congelata nel test e quella nuova, più la prova che un'esclusione
-- vera invece cambia il risultato, altrimenti il primo confronto sarebbe
-- vero anche per un'esclusione che il codice ignora sempre). Il predicato di
-- ammissione vive in TypeScript (src/lib/copertura.ts, trovaPerRichiesta/
-- rangoCopertura), non in SQL: professionals_score scora solo chi
-- getProfessionals ha già ammesso, quindi questa parte non tocca la funzione.
--
-- PARTE B — la distanza come punteggio, IN SCAFFOLDING. Aggiunge
-- `punti_distanza` come colonna di confronto in PIÙ, senza toccare `punti`:
-- l'ordinamento pubblico resta quello vecchio (area per specificità + resto)
-- finché uno strumento di confronto non ha verificato le bande su richieste
-- vere e su fixture sintetiche (professionals.is_test_fixture, qui sotto).
-- Solo una migrazione di cutover successiva sposterà `area` dentro `punti` —
-- una `create or replace` sola, stesso schema di rollback della 089→094. **IL
-- CUTOVER HA UNA PRECONDIZIONE BLOCCANTE, vedi più sotto: non prima che il
-- pezzo 3 (centroidi da CAP) esista per Milano.**
--
-- LE BANDE. Non quelle del tempo di risposta copiate 1:1 (<5/<15/<30/<60 km,
-- 20/16/12/8/4): calcolato sugli 88 nuclei NIL di Milano in produzione
-- (3.828 coppie), il 95% delle distanze intra-cittadine sta fra 0,6 e 12 km e
-- il 99% sotto 14,1 km — con quelle soglie il 99,7% delle coppie milanesi
-- varrebbe 20 o 16 e nient'altro, cioè esattamente il problema che l'area per
-- specificità ha oggi, spostato di un livello. Bande scelte sulla stessa
-- distribuzione (mediana 6,2 km, p75 8,6, p90 10,8): <1,5 km → 20, <4 → 17,
-- <8 → 14, <15 → 10, <40 → 5, oltre → 0 (mai un punto "sconosciuto": qui la
-- distanza è sempre calcolabile quando i due punti esistono, quindi lontano
-- vale zero come una risposta misurata e lenta, non come un dato mancante —
-- il centro come tempo di risposta non misurato è la banda 10, riservata a
-- quando un punto manca davvero). Con le bande vecchie Duomo–Isola (3,0 km) e
-- Duomo–San Siro (3,9 km) valevano entrambe 20; con queste valgono 17 — la
-- distinzione che dentro Milano serve davvero, PURCHÉ il punto base del
-- professionista sia più preciso del solo comune: vedi la precondizione qui
-- sotto, perché oggi non lo è.
--
-- ═══════════════════════════════════════════════════════════════════════
-- PRECONDIZIONE DI CUTOVER — NON UNA NOTA A MARGINE, UN CANCELLO.
-- ═══════════════════════════════════════════════════════════════════════
-- Il punto base del professionista, finché il pezzo 3 non esiste, è SEMPRE
-- e SOLO il centroide del comune (professionals.comune_istat → comuni.lat/
-- lng). Per Milano questo è UN SOLO PUNTO (45,46679 · 9,19035) per OGNI
-- professionista milanese, indipendentemente da dove sia davvero: un pro a
-- San Siro e uno a Gratosoglio — 7,12 km veri di distanza fra loro,
-- verificato ora sulle coordinate NIL vere — risultano nello STESSO punto,
-- quindi prendono la STESSA banda su qualunque richiesta di Milano (per una
-- richiesta a Loreto: banda 17 per entrambi; per una a San Siro o a
-- Gratosoglio: banda 14 per entrambi, verificato con lo stesso calcolo della
-- CTE qui sotto). OGGI L'AREA PER SPECIFICITÀ DISTINGUE QUESTI DUE CASI (chi
-- ha dichiarato `zone:milano/san-siro` vale 20, chi ha dichiarato solo
-- `city:milano` vale 15) — `punti_distanza`, dentro Milano, NON li distingue
-- affatto finché resta al livello di comune. SPOSTARE IL CUTOVER PRIMA CHE
-- IL PEZZO 3 ESISTA RENDEREBBE L'ORDINAMENTO DENTRO MILANO STRETTAMENTE
-- PEGGIORE DI OGGI, nella città del pilota — l'esatto contrario dello scopo
-- di questa migrazione. Il cancello: **nessuna migrazione di cutover finché
-- `cap_centroids` (pezzo 3, non ancora costruito) non dà a Milano un punto
-- base più fine del comune.** Fuori da Milano — dove oggi l'area non
-- discrimina comunque niente di più fine del comune — questo limite non si
-- applica: la distanza è già un miglioramento reale, verificato sulle
-- distanze inter-città (vedi sotto).
--
-- CONSEGUENZA SUL CONFRONTO: uno strumento che confronta `punti` vecchio
-- contro `punti_distanza` nuovo su richieste vere di Milano può SOLO
-- validare la parte inter-città (un professionista di Milano contro uno
-- fuori Milano) — mai la parte intra-Milano, che resta invalidabile finché
-- ogni pro milanese collassa sullo stesso punto. Un risultato verde su quel
-- confronto NON copre Milano, e va detto ogni volta che lo si legge, non
-- solo qui.
--
-- IL PUNTO BASE DEL PROFESSIONISTA. Il centro del cerchio di copertura
-- (professional_coverage.center_lat/lng) NON si usa: è dichiaratamente
-- privato dalla 057 ("il centro del cerchio resta privato: pubblichiamo solo
-- le zone", stesso testo in AreaLavoroEditor.tsx) e comunque irraggiungibile
-- da qui — la RLS di professional_coverage nega la lettura ad anon/
-- authenticated, e questa funzione è SECURITY INVOKER apposta dalla 075: un
-- cliente che chiama la ricerca leggerebbe righe vuote, non un errore, e il
-- buco passerebbe inosservato. Si usa invece professionals.comune_istat (085,
-- già pubblico quanto il resto della riga che questa funzione legge) verso
-- public.comuni (086, lettura pubblica). Non è la precisione promessa dal
-- punto 3 del piano — un centroide da CAP dentro Milano, non ancora
-- costruito, vedi il cancello qui sopra — ma è reale, non fabbricata, e
-- riusa dati già pubblici: nessuna riga di professionals_score restituisce
-- comune_istat o coordinate, solo il punteggio già in banda, stessa
-- disciplina di professional_signals (075) per il tempo di risposta.
--
-- RLS VERIFICATA SULLE CINQUE TABELLE CHE QUESTA FUNZIONE LEGGE PER LA
-- DISTANZA E PER L'ESCLUSIONE: `comuni`, `city_zones`, `cities`,
-- `professional_coverage_public` e `professionals` hanno tutte una policy
-- di SELECT pubblica (`using (true)` o equivalente). SECURITY INVOKER
-- (075) è quindi sicuro qui: un cliente anonimo o autenticato legge le
-- stesse righe che leggerebbe lo staff, nessuna riga sparisce in silenzio
-- sotto RLS come sarebbe successo con `professional_coverage.center_lat`
-- (vedi sopra) — quel tranello è stato evitato, non ripetuto.
--
-- STATO REALE OGGI, VERIFICATO SUI SEI PROFESSIONISTI IN PRODUZIONE:
-- `professionals.comune_istat` è NULL su tutti e sei — le cinque fixture
-- (`b1000000-…`, create il 3 giugno 2026) e l'unico professionista vero
-- (FOTOPRO-MILANO, iscritto il 9 settembre 2026). NON È UN BUCO NEL
-- PERCORSO DI SCRITTURA: la colonna esiste dalla 085 (17 settembre 2026,
-- vedi HANDOFF.md) e tutti e sei gli account, senza eccezioni, sono nati
-- PRIMA di quella data — nessuno dei sei ha mai riaperto il questionario
-- (`/onboarding/profilo`) o la scheda (`/impostazioni/azienda`) da allora,
-- ed entrambe le pagine scrivono `comune_istat` (verificato leggendo il
-- codice di tutte e due, non uno solo). `useStatoProfilo.ts` lo sa già e lo
-- dice: la voce di checklist "Dove hai la base" (chiave `base`, non
-- bloccante) esiste apposta, con la conseguenza scritta a mano — "Senza
-- comune e CAP la mappa della tua area parte dal centro città invece che da
-- dove sei" — che è esattamente il collasso descritto sopra, previsto
-- prima ancora che questa migrazione esistesse. Oggi questo significa che
-- `punti_distanza` calcolato su dati veri restituisce la banda 10 (punto
-- mancante) per tutti e sei su ogni richiesta, verificato ora con la stessa
-- CTE di questo file eseguita in sola lettura. Non blocca la migrazione —
-- lo scaffolding regge un punto mancante per costruzione — ma **prima di
-- qualunque confronto serio**, FOTOPRO-MILANO (l'unico caso reale) va in
-- `/impostazioni/azienda` a scrivere comune e CAP, altrimenti il confronto
-- misura solo colonne di 10.
--
-- IL PUNTO DELLA RICHIESTA. La zona (city_zones, se il cliente l'ha detta),
-- altrimenti il comune della richiesta (p_comune_istat se c'è, il comune
-- della città di Bob altrimenti) — nessun dato nuovo da cablare, tutto già
-- in schema dalla 086/087/088.
--
-- LE FIXTURE DI CONFRONTO. professionals.is_test_fixture: sparisce da ogni
-- superficie rivolta al cliente — un solo punto di applicazione,
-- getProfessionals in src/lib/data.ts, che è l'unico posto da cui passano
-- tutti gli elenchi pubblici (carica ogni professionista attivo e filtra in
-- memoria, non è per-città) — ma resta scorabile chiamando
-- professionals_score per id, perché questa funzione filtra solo su
-- deactivated_at, mai su is_test_fixture. Non si riusa deactivated_at: una
-- riga disattivata sparisce anche dalla CTE `base` qui sotto, quindi
-- diventerebbe non scorabile — inutile per confrontare. Convenzione doppia,
-- non alternativa: il nome dell'attività porta comunque il prefisso
-- "[FIXTURE]", perché un booleano dimenticato in una query nuova è un
-- incidente silenzioso, un nome che grida "FIXTURE" in ogni log non lo è.
--
-- CONFORMITÀ. Nessun dato personale nuovo: comune_istat è già letto da questa
-- stessa funzione per altre finalità pubblicate (085), qui si aggiunge solo
-- un uso, non una colonna. is_test_fixture è geografia di prova, non un
-- professionista vero: nessuna riga di RoPA nuova.
--
-- Idempotente: add column if not exists, drop-then-create dei vincoli e
-- della funzione a firma invariata, create or replace per il resto.

begin;

-- ---------------------------------------------------------------------------
-- PARTE A.1 — le esclusioni: colonne private, e il vincolo che le tiene
-- sul livello giusto
-- ---------------------------------------------------------------------------

alter table public.professional_coverage
  add column if not exists excluded_comuni_istat text[] not null default '{}',
  add column if not exists excluded_zone_slugs text[] not null default '{}';

comment on column public.professional_coverage.excluded_comuni_istat is
  'Comuni esclusi da una copertura più larga (provincia/regione/macroregione/Italia). Vuoto = nessuna esclusione, lo stato di ogni riga scritta prima della 098. Pubblicati come gettoni da private.excluded_keys_for, mai come centro o raggio.';
comment on column public.professional_coverage.excluded_zone_slugs is
  'Quartieri esclusi da "tutta la città" (scope=city). Vuoto = nessuna esclusione. Non ha senso su scope=zones: lì si esclude semplicemente non selezionando quel quartiere fra le inclusioni.';

alter table public.professional_coverage drop constraint if exists professional_coverage_esclusioni_scope;
alter table public.professional_coverage add constraint professional_coverage_esclusioni_scope check (
  (excluded_comuni_istat = '{}' or scope in ('province', 'region', 'macro_region', 'national'))
  and
  (excluded_zone_slugs = '{}' or scope = 'city')
);

create index if not exists professional_coverage_esclusi_comuni_idx
  on public.professional_coverage using gin (excluded_comuni_istat);
create index if not exists professional_coverage_esclusi_zone_idx
  on public.professional_coverage using gin (excluded_zone_slugs);

-- ---------------------------------------------------------------------------
-- PARTE A.2 — le esclusioni pubblicate, stesso vocabolario delle inclusioni
-- ---------------------------------------------------------------------------

alter table public.professional_coverage_public
  add column if not exists excluded_keys text[] not null default '{}';

comment on column public.professional_coverage_public.excluded_keys is
  'Gettoni esclusi (098), stesso vocabolario di coverage_keys: comune:<istat>, zone:<città>/<slug>. Riempita solo dal trigger publish_coverage_keys, come coverage_keys. Vuoto per ogni riga pubblicata prima della 098 — il default della colonna, non un backfill.';

create or replace function private.excluded_keys_for(p_coverage_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $BODY$
declare
  r record;
  keys text[] := '{}';
  m text;
  z text;
begin
  select c.excluded_comuni_istat, c.excluded_zone_slugs, ci.slug as city_slug
    into r
    from public.professional_coverage c
    left join public.cities ci on ci.id = c.city_id
   where c.id = p_coverage_id;

  if not found then
    return '{}';
  end if;

  foreach m in array coalesce(r.excluded_comuni_istat, '{}') loop
    keys := keys || ('comune:' || m);
  end loop;

  if r.city_slug is not null then
    foreach z in array coalesce(r.excluded_zone_slugs, '{}') loop
      keys := keys || ('zone:' || r.city_slug || '/' || z);
    end loop;
  end if;

  return keys;
end;
$BODY$;

revoke all on function private.excluded_keys_for(uuid) from public;
revoke all on function private.excluded_keys_for(uuid) from anon;
revoke all on function private.excluded_keys_for(uuid) from authenticated;

-- Lo stesso trigger di sempre (057/087), ricomposto per pubblicare anche le
-- esclusioni. Il trigger stesso (create trigger publish_coverage_keys, 057)
-- non cambia: cambia solo cosa fa la funzione che chiama.
create or replace function public.publish_coverage_keys()
returns trigger
language plpgsql
security definer
set search_path = ''
as $BODY$
declare
  pid uuid;
  all_keys text[];
  all_excluded text[];
  best text;
begin
  pid := coalesce(new.professional_id, old.professional_id);

  select coalesce(array_agg(distinct k), '{}')
    into all_keys
    from public.professional_coverage c,
         unnest(private.coverage_keys_for(c.id)) as k
   where c.professional_id = pid;

  select coalesce(array_agg(distinct k), '{}')
    into all_excluded
    from public.professional_coverage c,
         unnest(private.excluded_keys_for(c.id)) as k
   where c.professional_id = pid;

  select c.scope
    into best
    from public.professional_coverage c
   where c.professional_id = pid
   order by array_position(
     array['zones', 'comuni', 'city', 'province', 'region', 'macro_region', 'national'],
     c.scope)
   limit 1;

  if all_keys = '{}' then
    delete from public.professional_coverage_public where professional_id = pid;
    return coalesce(new, old);
  end if;

  insert into public.professional_coverage_public
    (professional_id, coverage_keys, excluded_keys, best_scope, updated_at)
  values (pid, all_keys, all_excluded, best, now())
  on conflict (professional_id) do update
    set coverage_keys = excluded.coverage_keys,
        excluded_keys = excluded.excluded_keys,
        best_scope = excluded.best_scope,
        updated_at = now();

  return coalesce(new, old);
end;
$BODY$;

revoke all on function public.publish_coverage_keys() from public;
revoke all on function public.publish_coverage_keys() from anon;
revoke all on function public.publish_coverage_keys() from authenticated;

-- ---------------------------------------------------------------------------
-- PARTE A.3 — le fixture di confronto, invisibili ovunque tranne che
-- allo strumento che le interroga per id
-- ---------------------------------------------------------------------------

alter table public.professionals
  add column if not exists is_test_fixture boolean not null default false;

comment on column public.professionals.is_test_fixture is
  'Riga di prova per confrontare punti_distanza (098) su distanze note prima di spostarla in punti: nessuna superficie rivolta al cliente la mostra (getProfessionals, src/lib/data.ts, filtra su questa colonna accanto a deactivated_at), ma resta scorabile chiamando professionals_score per id — questa funzione filtra solo su deactivated_at. Convenzione doppia: business_name porta comunque il prefisso "[FIXTURE]".';

create index if not exists professionals_test_fixture_idx
  on public.professionals (is_test_fixture)
  where is_test_fixture;

-- ---------------------------------------------------------------------------
-- PARTE B — punti_distanza, colonna di confronto: NON entra in `punti`
-- ---------------------------------------------------------------------------

drop function if exists public.professionals_score(uuid[], text, text, text, text);

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
  punti_distanza numeric,
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
      end as chiave_zona,
      -- Il comune della richiesta (088/089): puo' essere diverso da quello
      -- della citta', ed e' tutto il punto della 087.
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
      -- 098: solo per il punto base della distanza (Parte B). Già pubblico
      -- quanto il resto della riga che questa funzione legge (085) — nessuna
      -- colonna d'uscita restituisce questo valore, solo il punteggio in banda.
      pr.comune_istat
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
                when 'prov' then 8  when 'reg' then 4     when 'macro' then 3
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
        -- IL TETTO VIENE PRIMA (094): su un caso di cessazione l'etichetta si
        -- spegne anche se il caso aspetta noi.
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
  -- ---------------------------------------------------------------------
  -- PARTE B: punti_distanza. Il punto del professionista (comune, 085/086 —
  -- non il centro del cerchio, privato per costruzione, vedi il commento in
  -- testa al file) e il punto della richiesta (zona se c'è, comune
  -- altrimenti), banda haversine. Colonna di confronto: non entra in `punti`.
  --
  -- CHI TOCCA QUESTA CTE PER FARE IL CUTOVER (spostare `area` in `punti`):
  -- FERMO. Il punto base qui sotto è solo comune finché `cap_centroids`
  -- (pezzo 3) non esiste — dentro Milano ogni professionista risolve allo
  -- STESSO punto, quindi `punti_distanza` non distingue niente in città.
  -- Vedi «PRECONDIZIONE DI CUTOVER» in testa al file prima di procedere.
  -- ---------------------------------------------------------------------
  base_punto as (
    select b.id, co.lat, co.lng
    from base b
    left join public.comuni co on co.istat = b.comune_istat
  ),
  richiesta_punto as (
    select
      coalesce(z.lat, co.lat) as lat,
      coalesce(z.lng, co.lng) as lng
    from (select 1) uno
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
        -- Punto non risolvibile (comune senza coordinate, richiesta senza
        -- città): banda centrale, come il tempo di risposta non misurato —
        -- qui manca il dato, non è "lontano".
        when bp.lat is null or bp.lng is null or rq.lat is null or rq.lng is null
          then 10::numeric
        when hk.km <= 1.5 then 20::numeric
        when hk.km <= 4    then 17::numeric
        when hk.km <= 8    then 14::numeric
        when hk.km <= 15   then 10::numeric
        when hk.km <= 40   then 5::numeric
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
        + al.punti_verifica + al.punti_completezza, 2
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

comment on function public.professionals_score(uuid[], text, text, text, text) is
  'Il punteggio di merito 0-100 pubblicato su /come-funziona#ordine, con gli addendi in chiaro. Chi dichiara il lavoro cercato ordina PRIMA (offre_intervento), il punteggio ordina dentro il gruppo. SECURITY INVOKER dalla 075. `punti` NON è cambiata dalla 098: somma ancora l''area per specificità del gettone (072/077/080/089/094), non la distanza. `punti_distanza` (098) è una colonna di confronto in più — bande su distanza reale (comune/zona, mai il centro privato del cerchio), stesso peso massimo (20) che l''area vale oggi, pensata per sostituirla dopo un confronto affiancato su richieste vere e su professionals.is_test_fixture, non prima. Vedi il commento in testa a supabase/migrations/098_copertura_filtro_e_distanza.sql per le bande e perché.';

revoke all on function public.professionals_score(uuid[], text, text, text, text) from public;
grant execute on function public.professionals_score(uuid[], text, text, text, text) to anon, authenticated;

commit;
