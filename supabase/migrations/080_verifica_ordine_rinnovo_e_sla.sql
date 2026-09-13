-- 080_verifica_ordine_rinnovo_e_sla.sql
--
-- Quattro cose che si tengono, piu' due difetti trovati per strada.
--
-- 1) I PUNTI DELL'ORDINE VENGONO DALLA VERIFICA VERA. La voce «verifica» del
--    punteggio leggeva `professionals.verification_status`, un interruttore che
--    una persona girava dalla pagina admin senza motivazione obbligatoria e
--    senza riga nel registro. Il controllo tracciato — la partita IVA
--    riscontrata — vive in `verification_level` (blocco 10) e non pesava
--    niente. E /come-funziona#ordine al cliente prometteva gia' l'altra cosa:
--    «un profilo con la partita IVA controllata viene prima di uno ancora da
--    controllare». Scala: documents_verified 7, vat_verified 5, none 0. Il
--    massimo resta 7, quindi nessun'altra voce si sposta.
--
-- 2) ALLA SCADENZA IL BADGE CADE DAVVERO. La 078 aveva messo la data e il giro
--    notturno (079) porta le righe in Ricontrollo, ma nessuno LEGGEVA la
--    scadenza: un badge scaduto restava sulla scheda e continuava a pesare. Qui
--    il punteggio azzera la voce verifica; la regola gemella sull'etichetta sta
--    in src/lib/vat.ts, ed e' la stessa.
--
--    QUANDO CADE: la prima fra la scadenza annuale e la fine della finestra del
--    ricontrollo, 7 giorni dall'apertura del caso (i 5 giorni lavorativi gia'
--    dichiarati). Un numero solo per due strade: la scadenza apre il
--    ricontrollo 7 giorni prima, quindi la finestra coincide; una cessazione lo
--    apre subito, e da li' il professionista ha la stessa finestra. Senza la
--    seconda meta', una cessazione lascerebbe l'etichetta accesa per tutti i
--    mesi che mancano alla scadenza — cioe' proprio quando il registro dice
--    gia' che e' falsa.
--
--    IL LIVELLO NON SI TOCCA: lo toglie una persona, con motivazione scritta
--    (art. 22 GDPR). Questa e' una regola di LETTURA, reversibile: al rinnovo
--    badge e punti tornano da soli. Il preavviso a 30 giorni della 078 resta il
--    preavviso di questa restrizione (Reg. P2B art. 4).
--
-- 3) CHI HA FATTO LA SUA PARTE NON PAGA LA NOSTRA LENTEZZA. Se il
--    professionista carica i documenti, il badge regge finche' non decidiamo
--    noi, anche se intanto la data passa. Conferma: un altro anno. Rifiuto:
--    cade. Il contrario puniva chi aveva risposto.
--
--    UNA COLONNA SOLA PER «DI CHI E' LA PALLA»: `vat_review_opened_at`.
--    Valorizzata = aspetta noi, l'orologio dell'SLA corre e il badge tiene.
--    Nulla = aspetta lui, e il badge segue la data. Sono la stessa cosa vista
--    da due parti, e in due colonne separate potrebbero divergere.
--      pending                              -> nostra
--      docs_requested / recheck             -> sua
--      documento caricato su un caso aperto -> nostra, da adesso
--      null / rejected                      -> caso chiuso
--
-- 4) L'SLA SI PUO' MISURARE. vat.ts dichiara 5 giorni lavorativi dal 12/09 e
--    accanto c'era scritto perche' nessuno li contava: «la coda non ha un
--    timestamp di ingresso». Adesso ce l'ha, ed e' lo stesso di sopra.
--
-- DIFETTO A — IL RINNOVO NON RINNOVAVA. `set_verification_expiry` (078)
-- spostava la scadenza solo se il livello CAMBIA, ma un rinnovo conferma lo
-- stesso livello: la conferma manuale dopo i documenti avrebbe lasciato la
-- scadenza dov'era, e il professionista sarebbe rimasto senza badge subito dopo
-- che glielo avevamo riconfermato. Il giro notturno non lo vedeva perche' la
-- data la scrive a mano. Ora riparte a ogni riscontro nuovo, e il trigger si
-- sveglia anche su vat_checked_at: prima non era nella sua lista di colonne.
--
-- DIFETTO B — IL REGISTRO TACEVA SUI RICONTROLLI. Il vincolo sugli eventi non
-- contemplava 'vat_recheck_opened', che e' esattamente quello che il giro
-- notturno scrive quando apre un ricontrollo, e l'errore dell'insert non veniva
-- letto. Non se n'era accorto nessuno perche' `scadenze_guardate` e' sempre
-- stato 0.
--
-- PRIVACY. Le due colonne nuove su `professionals` sono in lettura pubblica
-- come il resto della tabella (mig 003) e non aggiungono niente di deducibile:
-- una dice quando si spegne il badge, l'altra che c'e' un esame in corso — cosa
-- si stia esaminando e perche' restano in professional_verification, sotto RLS.
--
-- Idempotente: add column if not exists, drop-then-create di vincoli e trigger,
-- create or replace delle funzioni, backfill con guardia.

begin;

-- ---------------------------------------------------------------------------
-- 1) Il registro accetta l'evento che il giro notturno gia' scrive
-- ---------------------------------------------------------------------------
alter table public.verification_events
  drop constraint if exists verification_events_event_check;
alter table public.verification_events
  add constraint verification_events_event_check
  check (event in ('vat_submitted', 'vat_check_ok', 'vat_check_failed',
                   'documents_submitted', 'documents_requested', 'vat_rejected',
                   'level_granted', 'level_revoked', 'vat_recheck_opened'));

-- ---------------------------------------------------------------------------
-- 2) Di chi e' la palla
-- ---------------------------------------------------------------------------
alter table public.professional_verification
  add column if not exists vat_review_opened_at timestamptz;

comment on column public.professional_verification.vat_review_opened_at is
  'Da quando il caso aspetta NOI. Valorizzata: l''orologio dell''SLA corre e il badge tiene anche oltre la scadenza. Nulla: aspetta il professionista (documenti chiesti, ricontrollo appena aperto) o non c''e'' nessun caso. La tiene il trigger trg_vat_review_clock, non il codice applicativo.';

create index if not exists professional_verification_coda_idx
  on public.professional_verification (vat_review_opened_at)
  where vat_review_state = 'pending';

create or replace function public.set_vat_review_clock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.vat_review_state is null or new.vat_review_state = 'rejected' then
    new.vat_review_opened_at := null;
  elsif new.vat_review_state = 'pending' then
    if tg_op = 'INSERT' or old.vat_review_state is distinct from 'pending' then
      new.vat_review_opened_at := now();
    end if;
  elsif tg_op = 'INSERT' or old.vat_review_state is distinct from new.vat_review_state then
    new.vat_review_opened_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vat_review_clock on public.professional_verification;
create trigger trg_vat_review_clock
  before insert or update of vat_review_state
  on public.professional_verification
  for each row
  execute function public.set_vat_review_clock();

-- I casi gia' in coda non partono ciechi: l'ingresso si ricava dal registro,
-- che e' la fonte, e solo in mancanza di eventi si ripiega su updated_at.
update public.professional_verification v
   set vat_review_opened_at = coalesce(
     (select min(e.created_at)
        from public.verification_events e
       where e.professional_id = v.professional_id
         and e.event in ('vat_submitted', 'vat_check_failed')),
     v.updated_at
   )
 where v.vat_review_state = 'pending'
   and v.vat_review_opened_at is null;

-- ---------------------------------------------------------------------------
-- 3) Il documento caricato passa la palla a noi, in qualunque coda
-- ---------------------------------------------------------------------------
-- Il ricontrollo NON diventa `pending`: resta nella sua coda, col suo motivo
-- (079). Cambia solo di chi e' la palla — ed e' proprio li' che vive il rinnovo
-- annuale, cioe' il caso per cui la regola esiste.
create or replace function public.riporta_in_coda_dopo_documento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stato text;
begin
  select v.vat_review_state into stato
    from public.professional_verification v
   where v.professional_id = new.professional_id
   for update;

  if stato = 'docs_requested' then
    update public.professional_verification
       set vat_review_state = 'pending',
           updated_at = now()
     where professional_id = new.professional_id;

  elsif stato = 'recheck' then
    update public.professional_verification
       set vat_review_opened_at = now(),
           updated_at = now()
     where professional_id = new.professional_id;

  else
    return new;
  end if;

  insert into public.verification_events
    (professional_id, event, note, actor_name, actor_role)
  values (
    new.professional_id,
    'documents_submitted',
    'Il professionista ha caricato un documento: da adesso il caso aspetta noi.',
    'Sistema',
    'system'
  );

  return new;
end;
$$;

revoke execute on function public.riporta_in_coda_dopo_documento() from public, anon, authenticated;

drop trigger if exists trg_documento_riporta_in_coda on public.verification_documents;
create trigger trg_documento_riporta_in_coda
  after insert on public.verification_documents
  for each row
  execute function public.riporta_in_coda_dopo_documento();

-- ---------------------------------------------------------------------------
-- 4) La scadenza riparte a ogni riscontro nuovo, non solo quando sale il livello
-- ---------------------------------------------------------------------------
create or replace function public.set_verification_expiry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.level in ('vat_verified', 'documents_verified') then
    if tg_op = 'INSERT'
       or old.level is distinct from new.level
       or new.vat_expires_at is null
       or new.vat_checked_at is distinct from old.vat_checked_at then
      new.vat_expires_at := now() + interval '1 year';
    end if;
  else
    new.vat_expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_verification_expiry on public.professional_verification;
create trigger trg_set_verification_expiry
  before insert or update of level, vat_expires_at, vat_checked_at
  on public.professional_verification
  for each row
  execute function public.set_verification_expiry();

-- ---------------------------------------------------------------------------
-- 5) Quando cade il badge, e se c'e' un esame in corso: dove si ordina
-- ---------------------------------------------------------------------------
-- professionals_score e' security invoker e non puo' leggere
-- professional_verification (RLS stretta, ci sta il numero di partita IVA).
-- Quindi le due cose che servono all'ordine arrivano qui, tenute in pari dallo
-- stesso trigger che gia' copia il livello.
alter table public.professionals
  add column if not exists verification_badge_until timestamptz,
  add column if not exists verification_under_review boolean not null default false;

comment on column public.professionals.verification_badge_until is
  'Quando si spegne il badge: la prima fra vat_expires_at e recheck_opened_at + 7 giorni (la finestra del ricontrollo). Copia pubblica calcolata dal trigger sync_verification_level. La regola gemella in TypeScript e'' scadenzaBadge(), in src/lib/vat.ts.';

comment on column public.professionals.verification_under_review is
  'Vero quando il caso di verifica aspetta NOI. Finche'' e'' vero il badge tiene anche oltre la data: il professionista ha fatto la sua parte e sta aspettando la nostra.';

create index if not exists professionals_badge_until_idx
  on public.professionals (verification_badge_until)
  where verification_badge_until is not null;

create or replace function public.sync_professional_verification_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  data_livello timestamptz;
  spegne_il timestamptz;
  in_esame boolean;
begin
  data_livello := case
    when new.level = 'documents_verified' then new.documents_checked_at
    when new.level = 'vat_verified' then new.vat_checked_at
    else null
  end;
  spegne_il := least(
    new.vat_expires_at,
    new.recheck_opened_at + make_interval(days => 7)
  );
  in_esame := new.vat_review_opened_at is not null;

  update public.professionals p
     set verification_level = new.level,
         verification_level_at = data_livello,
         verification_badge_until = spegne_il,
         verification_under_review = in_esame
   where p.id = new.professional_id
     and (p.verification_level is distinct from new.level
          or p.verification_level_at is distinct from data_livello
          or p.verification_badge_until is distinct from spegne_il
          or p.verification_under_review is distinct from in_esame);
  return new;
end;
$$;

-- Il trigger deve svegliarsi anche quando cambia solo il ricontrollo o
-- l'orologio: e' after insert or update senza lista di colonne, quindi gia' ci
-- siamo. Lo si ricrea per sicurezza, e' idempotente.
drop trigger if exists sync_verification_level on public.professional_verification;
create trigger sync_verification_level
  after insert or update on public.professional_verification
  for each row execute function public.sync_professional_verification_level();

update public.professionals p
   set verification_badge_until = least(
         v.vat_expires_at,
         v.recheck_opened_at + make_interval(days => 7)
       ),
       verification_under_review = (v.vat_review_opened_at is not null)
  from public.professional_verification v
 where v.professional_id = p.id
   and (p.verification_badge_until is distinct from least(
          v.vat_expires_at, v.recheck_opened_at + make_interval(days => 7))
        or p.verification_under_review is distinct from (v.vat_review_opened_at is not null));

-- ---------------------------------------------------------------------------
-- 6) Il punteggio
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
      pr.verification_level,
      pr.verification_badge_until,
      pr.verification_under_review,
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
      case
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
  'Il punteggio di merito 0-100 pubblicato su /come-funziona#ordine, con gli addendi in chiaro. Chi dichiara il lavoro cercato ordina PRIMA (offre_intervento), il punteggio ordina dentro il gruppo. SECURITY INVOKER dalla 075. Dalla 077 la voce prezzo conta anche la tariffa nell''unita'' del mestiere, non solo la forbice. Dalla 080 la voce verifica legge verification_level (il blocco 10, tracciato) e non piu'' verification_status (il flag manuale). Dalla 080 una verifica spenta vale 0 (verification_badge_until: la prima fra scadenza e fine finestra del ricontrollo), salvo quando il caso aspetta noi (verification_under_review) — chi ha caricato i documenti non perde il badge per il tempo che ci mettiamo a guardarli. Il livello nel database lo toglie comunque solo una persona. Vedi docs/RICERCA.md sezione 4.';

revoke all on function public.professionals_score(uuid[], text, text, text) from public;
grant execute on function public.professionals_score(uuid[], text, text, text) to anon, authenticated;

commit;
