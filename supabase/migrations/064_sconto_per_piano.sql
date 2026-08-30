-- ---------------------------------------------------------------------------
-- 064 — il codice sconto sconta, non decide il piano
-- ---------------------------------------------------------------------------
--
-- COM'ERA. promo_codes.grants_tier diceva un piano, e riscattare il codice
-- APPLICAVA quel piano: BOB-FOUNDER-2026 metteva chiunque su Business senza
-- chiedere niente a nessuno. Nel percorso di iscrizione il codice si inseriva
-- dentro il pannello di un piano gia' scelto, e poi ne applicava un altro:
-- sceglievi Pro, uscivi Business.
--
-- PERCHE' CAMBIA (deciso il 30/08 con Lucio). Un codice promozionale e' uno
-- SCONTO: agisce sul prezzo, non sulla scelta. Chi entra con il codice dei
-- fondatori deve vedere i tre piani a zero euro e scegliere quello che gli
-- serve — anche Free, anche Pro — invece di ricevere d'ufficio il pacchetto
-- piu' grosso. Per noi e' anche l'unico modo di provare il prodotto ai tre
-- livelli con un account solo: oggi per vedere l'esperienza Free bisognava
-- correggere subscription_tier a mano nel database.
--
-- LO SCONTO E' PER PIANO, non uno solo per tutti: un codice «primo mese di
-- Pro gratis» e un codice «-30% su Business» sono cose diverse, e con una
-- percentuale sola sarebbero indistinguibili. Tre colonne, una per piano.
-- Free e' gia' a zero e la sua colonna sara' quasi sempre irrilevante: esiste
-- perche' il giorno che Free avesse un prezzo non si dovra' rifare lo schema.
--
-- grants_tier NON viene tolta: resta come piano CONSIGLIATO, quello che il
-- percorso di iscrizione preseleziona. Smette solo di essere applicata da
-- sola. Toglierla vorrebbe dire perdere l'informazione «questo codice nasce
-- per Business» su un codice gia' riscattato in produzione.
--
-- CHI APPLICA IL PIANO. Sempre e solo il server: professionals
-- .subscription_tier e' protetta dal trigger protect_professional_columns
-- (057/062) e il client non puo' scriverla. La route /api/onboarding/promo
-- accetta la scelta di un piano soltanto se, con gli sconti effettivamente
-- riscattati, quel piano costa zero — altrimenti servirebbe un pagamento, e
-- il pagamento non c'e' ancora.
--
-- PRIVACY. Nessun dato personale nuovo: sono colonne di listino su una
-- tabella di codici. Nessuna riga di RoPA, nessuna nuova finalita'.
--
-- Idempotente: add column if not exists, guardia su pg_constraint.
-- ---------------------------------------------------------------------------

alter table public.promo_codes
  add column if not exists discount_free_pct smallint not null default 0,
  add column if not exists discount_pro_pct smallint not null default 0,
  add column if not exists discount_business_pct smallint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'promo_codes_discount_range'
  ) then
    alter table public.promo_codes
      add constraint promo_codes_discount_range check (
        discount_free_pct between 0 and 100
        and discount_pro_pct between 0 and 100
        and discount_business_pct between 0 and 100
      );
  end if;
end $$;

comment on column public.promo_codes.discount_free_pct is
  'Sconto percentuale sul piano Free (0-100). 100 = gratis.';
comment on column public.promo_codes.discount_pro_pct is
  'Sconto percentuale sul piano Bob Pro (0-100). 100 = gratis.';
comment on column public.promo_codes.discount_business_pct is
  'Sconto percentuale sul piano Bob Business (0-100). 100 = gratis.';
comment on column public.promo_codes.grants_tier is
  'Piano CONSIGLIATO dal codice: lo preseleziona, non lo applica piu''. Dal 30/08/2026 (migrazione 064) il piano lo sceglie la persona e lo applica il server solo se con gli sconti costa zero.';

-- Il codice dei fondatori: tutto a zero, e la scelta resta a chi entra.
update public.promo_codes
   set discount_free_pct = 100,
       discount_pro_pct = 100,
       discount_business_pct = 100
 where code = 'BOB-FOUNDER-2026';
