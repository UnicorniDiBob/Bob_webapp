-- ---------------------------------------------------------------------------
-- Riporta a zero uno o piu' ACCOUNT DI PROVA, senza cancellarli
-- ---------------------------------------------------------------------------
--
-- PERCHE' ESISTE. Rifare il primo ingresso del professionista e' la prova che
-- si ripete piu' spesso, e ogni volta va rifatta a mano una ventina di delete.
-- Il 30/08 e' stato fatto due volte in un pomeriggio, la seconda perche' la
-- prima aveva lasciato in piedi la riga `professionals`: il questionario non la
-- ricreava, la citta' era gia' dentro e la guida si era gia' segnata come vista.
-- Un reset che lascia meta' stato non e' un reset: e' un bug piu' difficile da
-- vedere di quello che stavi cercando.
--
-- COSA FA. Cancella tutto quello che l'account ha PRODOTTO e lascia in piedi
-- l'identita': `auth.users`, `public.users`, `public.profiles`,
-- `public.profile_private`. Cosi' la password resta la stessa e non si consuma
-- nessuna delle 2 email/ora del mailer interno di Supabase (limite di
-- progetto, vedi DATA_COMPLIANCE): riaccedere e ricominciare, senza conferme.
--
-- COSA NON FA, e va fatto a mano nel browser. Tre cose vivono in localStorage e
-- il database non le tocca: il segnalibro della guida, il promemoria
-- giornaliero e la data di lettura delle notifiche. Finche' restano li', la
-- guida riprende da meta' e il promemoria non ricompare. Sulla console del
-- browser, con www.meetonda.com aperto:
--
--   ["bob.guida.pro.v1","bob.promemoria.profilo.v1","bob.notifiche.viste.v1","bob-chat-draft-v1","bob:manutenzione-chiusa"].forEach(k => localStorage.removeItem(k))
--
-- DOVE SI ESEGUE. Supabase > SQL Editor, sul progetto bijgitnulucdzluqjxrx.
--
-- LA PROTEZIONE. L'elenco qui sotto e' chiuso: lo script tocca SOLO le email
-- che ci stanno dentro. Puntare per sbaglio questo file su un professionista
-- vero vorrebbe dire cancellargli appuntamenti e recensioni senza possibilita'
-- di tornare indietro. Per aggiungere un account di prova si aggiunge una riga
-- QUI, in un commit, non si commenta il controllo.
--
-- DOPO IL PRIMO INGRESSO SI RIPARTE DA: /onboarding/piano
-- (la dashboard riapre la guida da sola, perche' la riga professionals non
-- esiste piu' e il questionario la ricrea).
--
-- ---------------------------------------------------------------------------
-- TRE CORREZIONI DEL 09/09, tutte trovate resettando cliente.prova
-- ---------------------------------------------------------------------------
--
-- 1. L'ELENCO E' UN CICLO, non una riga da cambiare a mano. Prima si eseguiva
--    lo script una volta per account modificando v_email: due esecuzioni, e
--    la seconda si dimentica.
--
-- 2. LE CANCELLAZIONI LATO CLIENTE STANNO FUORI DAL RAMO DEL PROFESSIONISTA.
--    Erano dentro `if v_pro is not null`, quindi su un account SOLO CLIENTE —
--    cliente.prova@bobapp.it e' esattamente quello — appuntamenti e recensioni
--    non venivano toccati: `appointments.request_id` e `ratings.request_id`
--    sono `on delete set null`, non cascade, quindi sopravvivevano alla
--    cancellazione delle richieste e restavano attaccati all'account.
--
-- 3. IL CONTATORE DEI CODICI PROMO SI SCALA. Cancellare la riscossione senza
--    toccare `promo_codes.used_count` lasciava il contatore gonfio di un'unita'
--    a ogni prova. Oggi BOB-FOUNDER-2026 ha `max_uses` NULL e quindi non
--    blocca niente, ma un contatore che cresce solo e' una cifra che prima o
--    poi qualcuno legge come vera.
-- ---------------------------------------------------------------------------

do $$
declare
  -- ↓↓↓ GLI ACCOUNT DI PROVA. Aggiungerne uno = una riga qui, in un commit. ↓↓↓
  v_ammessi text[] := array[
    'sig.mozzato@gmail.com',
    'cliente.prova@bobapp.it'
  ];
  v_email text;
  v_user  uuid;
  v_pro   uuid;
begin
  foreach v_email in array v_ammessi loop
    select id into v_user from auth.users where email = v_email;
    if v_user is null then
      raise exception 'Nessun account con email %', v_email;
    end if;

    select id into v_pro from public.professionals where user_id = v_user;

    if v_pro is not null then
      delete from public.request_messages                 where professional_id = v_pro;
      delete from public.request_professionals            where professional_id = v_pro;
      delete from public.professional_services            where professional_id = v_pro;
      delete from public.professional_coverage            where professional_id = v_pro;
      delete from public.professional_availability        where professional_id = v_pro;
      delete from public.professional_availability_blocks where professional_id = v_pro;
      delete from public.portfolio_items                  where professional_id = v_pro;
      delete from public.professional_verification        where professional_id = v_pro;
      delete from public.verification_events              where professional_id = v_pro;
      delete from public.subscription_tier_events         where professional_id = v_pro;
      delete from public.ratings                          where professional_id = v_pro;
      delete from public.appointments                     where professional_id = v_pro;
      -- La riga sparisce per intero: e' il questionario a ricrearla, ed e'
      -- quello il primo ingresso vero.
      delete from public.professionals where id = v_pro;
    end if;

    -- Lato utente. Vale per tutti, professionista o cliente: vedi la nota 2.
    delete from public.request_messages          where sender_id = v_user;
    delete from public.ratings                   where customer_id = v_user;
    delete from public.appointments              where customer_id = v_user;
    delete from public.requests                  where customer_id = v_user;
    delete from public.job_briefs                where user_id = v_user;
    delete from public.customer_memory           where user_id = v_user;
    delete from public.customer_addresses        where user_id = v_user;
    delete from public.profile_phone             where user_id = v_user;
    delete from public.onboarding_answers        where user_id = v_user;
    delete from public.support_tickets           where user_id = v_user;
    delete from public.communication_consents    where user_id = v_user;
    delete from public.account_deletion_requests where user_id = v_user;

    -- Codici promo: prima si scala il contatore, poi si toglie la riscossione.
    update public.promo_codes c
       set used_count = greatest(0, c.used_count - (
             select count(*) from public.promo_redemptions r
             where r.user_id = v_user and r.promo_code_id = c.id))
     where exists (select 1 from public.promo_redemptions r
                   where r.user_id = v_user and r.promo_code_id = c.id);
    delete from public.promo_redemptions where user_id = v_user;

    -- Le finestre degli avvisi di servizio (071) si rivedono da capo.
    update public.profiles set avvisi_visti_al = null where user_id = v_user;

    raise notice 'Account % riportato a zero (user_id %).', v_email, v_user;
  end loop;
end $$;

-- Controllo: tutte le colonne devono essere 0, tranne account_esiste e
-- profilo_resta, che devono essere 1 per ogni account dell'elenco.
with prova as (
  select id, email from auth.users
  where email in ('sig.mozzato@gmail.com', 'cliente.prova@bobapp.it')
)
select
  p.email,
  (select count(*) from public.professionals      x where x.user_id  = p.id) as professionals,
  (select count(*) from public.profile_phone      x where x.user_id  = p.id) as telefono,
  (select count(*) from public.onboarding_answers x where x.user_id  = p.id) as questionario,
  (select count(*) from public.promo_redemptions  x where x.user_id  = p.id) as promo,
  (select count(*) from public.support_tickets    x where x.user_id  = p.id) as ticket,
  (select count(*) from public.requests           x where x.customer_id = p.id) as richieste,
  (select count(*) from public.appointments       x where x.customer_id = p.id) as appuntamenti,
  (select count(*) from public.profiles           x where x.user_id  = p.id) as profilo_resta,
  1 as account_esiste
from prova p
order by p.email;

select used_count as founder_used_count
from public.promo_codes where code = 'BOB-FOUNDER-2026';
