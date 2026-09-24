-- 094_tetto_esame_cessazione.sql
--
-- IL BUCO CHE QUESTA MIGRAZIONE CHIUDE. Dalla 080 il badge non cade finche' il
-- caso aspetta NOI (`verification_under_review`): chi ha caricato un documento
-- non paga la nostra lentezza, ed e' giusto. Ma quella regola non ha un tetto,
-- e su un caso aperto per CESSAZIONE dice una cosa che non possiamo sostenere:
-- il registro dichiara che la partita IVA non risulta piu' attiva, il
-- professionista risponde, e da quel momento l'etichetta «Verificato» resta
-- accesa ai clienti per tutto il tempo che ci mettiamo noi a guardare. Senza
-- una regola di escalation sulla coda — che abbiamo deciso di non costruire —
-- quel tempo non ha un limite: un'etichetta falsa che nessuno ha deciso di
-- tenere accesa e' esattamente il difetto che la 080 voleva togliere.
--
-- IL TETTO: 14 giorni solari dall'apertura del caso, e solo sui casi aperti per
-- cessazione. Non e' un numero nuovo, sono i due numeri gia' dichiarati messi
-- in fila: 7 giorni di finestra al professionista (FINESTRA_RICONTROLLO_GIORNI,
-- 080) piu' i 5 giorni lavorativi del nostro esame (SLA_VERIFICA_GIORNI_LAVORATIVI,
-- che in giorni solari sono 7). Oltre quel giorno l'etichetta si spegne anche
-- se il caso e' ancora sul nostro tavolo: se abbiamo sforato, il costo lo
-- paghiamo noi in visibilita' promessa, non il cliente in informazione falsa.
--
-- COSA NON FA. Non tocca il LIVELLO: quello lo toglie una persona, con
-- motivazione scritta (art. 22 GDPR, Reg. P2B art. 4). Questa resta una regola
-- di LETTURA, reversibile: appena il controllo passa, badge e punti tornano da
-- soli. E non tocca gli altri tre motivi di ricontrollo (scadenza, procedura,
-- intestazione): li' il registro non dice che la partita IVA e' spenta, dice
-- che va riguardata, e la regola della 080 basta.
--
-- DOVE STA LA REGOLA GEMELLA: `tettoRicontrollo()` in src/lib/vat.ts, con la
-- stessa costante. Se una delle due cambia senza l'altra, la scheda pubblica e
-- l'ordinamento dicono cose diverse sullo stesso profilo.
--
-- PRIVACY. La colonna nuova e' sulla tabella pubblica come le due della 080 e
-- non aggiunge niente di deducibile: dice quando si spegne un'etichetta, non
-- perche'. Il motivo del ricontrollo resta in professional_verification, sotto
-- RLS.
--
-- DIFETTO TROVATO PER STRADA — LA 089 HA RIPORTATO INDIETRO IL PUNTEGGIO.
-- `professionals_score` e' stata riscritta dalla 089 (17/09) copiando il corpo
-- della 072, come il suo stesso commento dichiara: «Il resto del corpo e'
-- identico alla 072: copiato, non riscritto». Solo che fra la 072 e la 089 il
-- corpo era cambiato tre volte, e in produzione quelle tre cose sono sparite
-- senza che nessuno se ne accorgesse, perche' nessuno le controlla:
--   * la voce VERIFICA e' tornata a leggere `professionals.verification_status`
--     — l'interruttore manuale della pagina admin — invece di
--     `verification_level` + la caduta del badge (080). Cioe': dal 17/09 la
--     regola «alla scadenza il badge cade davvero» NON vale piu' per l'ordine,
--     solo per l'etichetta. Metteva un tetto a una regola che intanto era
--     scomparsa.
--   * la voce PREZZO e' tornata a guardare solo `min_price`, e chi dichiara la
--     tariffa nell'unita' del mestiere e' di nuovo «senza prezzo» (077).
--   * il TEMPO DI RISPOSTA e' tornato a ricalcolarsi da request_messages invece
--     di leggere `professional_signals` (075).
--   * la funzione e' tornata SECURITY DEFINER, dopo che la 075 l'aveva portata
--     a SECURITY INVOKER apposta.
-- Qui la funzione viene ricomposta una volta sola: 075 + 077 + 080 + 089 + il
-- tetto di questa migrazione. La firma resta quella della 089 (cinque
-- argomenti, col comune): e' quella che chiama src/lib/data.ts.
--
-- Idempotente: add column if not exists, create or replace delle funzioni,
-- backfill con guardia, e drop della firma a quattro argomenti se un ambiente
-- se la ritrova addosso (in produzione non c'e': la 089 l'aveva gia' tolta).

begin;

-- ---------------------------------------------------------------------------
-- 1) La copia pubblica del tetto
-- ---------------------------------------------------------------------------
alter table public.professionals
  add column if not exists verification_badge_max_until timestamptz;

comment on column public.professionals.verification_badge_max_until is
  'Il giorno in cui l''etichetta si spegne ANCHE se il caso aspetta noi: recheck_opened_at + 14 giorni, valorizzata solo sui ricontrolli aperti per cessazione. Nulla su ogni altro motivo. Copia pubblica calcolata dal trigger sync_verification_level; la regola gemella in TypeScript e'' tettoRicontrollo(), in src/lib/vat.ts.';

create index if not exists professionals_badge_max_until_idx
  on public.professionals (verification_badge_max_until)
  where verification_badge_max_until is not null;

-- ---------------------------------------------------------------------------
-- 2) Lo stesso trigger che gia' copia il livello tiene in pari anche il tetto
-- ---------------------------------------------------------------------------
create or replace function public.sync_professional_verification_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  data_livello timestamptz;
  spegne_il timestamptz;
  tetto_il timestamptz;
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
  -- Il tetto vale solo dove il registro dice che la partita IVA e' spenta.
  tetto_il := case
    when new.recheck_reason = 'cessazione' and new.recheck_opened_at is not null
      then new.recheck_opened_at + make_interval(days => 14)
    else null
  end;
  in_esame := new.vat_review_opened_at is not null;

  update public.professionals p
     set verification_level = new.level,
         verification_level_at = data_livello,
         verification_badge_until = spegne_il,
         verification_badge_max_until = tetto_il,
         verification_under_review = in_esame
   where p.id = new.professional_id
     and (p.verification_level is distinct from new.level
          or p.verification_level_at is distinct from data_livello
          or p.verification_badge_until is distinct from spegne_il
          or p.verification_badge_max_until is distinct from tetto_il
          or p.verification_under_review is distinct from in_esame);
  return new;
end;
$$;

drop trigger if exists sync_verification_level on public.professional_verification;
create trigger sync_verification_level
  after insert or update on public.professional_verification
  for each row execute function public.sync_professional_verification_level();

update public.professionals p
   set verification_badge_max_until = case
         when v.recheck_reason = 'cessazione' and v.recheck_opened_at is not null
           then v.recheck_opened_at + make_interval(days => 14)
         else null
       end
  from public.professional_verification v
 where v.professional_id = p.id
   and p.verification_badge_max_until is distinct from case
         when v.recheck_reason = 'cessazione' and v.recheck_opened_at is not null
           then v.recheck_opened_at + make_interval(days => 14)
         else null
       end;

-- ---------------------------------------------------------------------------
-- 3) Il punteggio: ricomposto, e con il tetto prima di tutto il resto
-- ---------------------------------------------------------------------------
-- Una funzione si sostituisce intera, non a pezzi: qui c'e' tutto il corpo
-- buono — i gettoni col comune (089), i segnali pubblici (075), la tariffa
-- (077), la verifica vera con la sua caduta (080) — piu' il tetto (094).
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
  'Il punteggio di merito 0-100 pubblicato su /come-funziona#ordine, con gli addendi in chiaro. Chi dichiara il lavoro cercato ordina PRIMA (offre_intervento), il punteggio ordina dentro il gruppo. SECURITY INVOKER dalla 075. Dalla 077 la voce prezzo conta anche la tariffa nell''unita'' del mestiere. Dalla 080 la voce verifica legge verification_level (il blocco 10, tracciato) e non piu'' verification_status, e una verifica spenta vale 0 salvo quando il caso aspetta noi (verification_under_review). Dalla 094 quel «salvo» ha un tetto: sui ricontrolli aperti per CESSAZIONE la voce vale 0 dopo verification_badge_max_until (apertura del caso + 14 giorni) anche se il caso aspetta ancora noi. Il livello nel database lo toglie comunque solo una persona. Dalla 089 il gettone di comune vale 18, fra quartiere e citta''. La 094 ricompone la funzione dopo che la 089 ne aveva copiato il corpo dalla 072, riportando indietro verifica, prezzo, tempo di risposta e SECURITY INVOKER. Vedi docs/RICERCA.md sezione 4.';

revoke all on function public.professionals_score(uuid[], text, text, text, text) from public;
grant execute on function public.professionals_score(uuid[], text, text, text, text) to anon, authenticated;

commit;
