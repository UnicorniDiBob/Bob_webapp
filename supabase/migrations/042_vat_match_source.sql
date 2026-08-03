-- 042: da quale nome è arrivata la corrispondenza.
--
-- La concessione automatica del livello dipende dal confronto fra la
-- denominazione del registro e i nomi che conosciamo del professionista: il
-- nome pubblico del profilo, oppure la ragione sociale che ha dichiarato lui.
-- I due non hanno lo stesso peso — il primo è quello che i clienti vedranno
-- accanto al badge, il secondo è testo scritto dall'interessato — quindi il
-- registro deve dire quale dei due ha deciso.
--
-- Serve a tre cose concrete:
--   1. controllare a posteriori le concessioni basate su un dato
--      autodichiarato, senza bloccare il professionista mentre aspetta;
--   2. dare alla telemetria (10.7) un numero vero su quanto pesa ciascuna via;
--   3. rendere spiegabile una decisione, se un domani viene contestata.
--
-- Idempotente.

alter table public.professional_verification
  add column if not exists vat_match_source text;

alter table public.professional_verification
  drop constraint if exists professional_verification_match_source_check;
alter table public.professional_verification
  add constraint professional_verification_match_source_check
  check (vat_match_source is null
         or vat_match_source in ('profile_name', 'declared_name', 'staff'));

comment on column public.professional_verification.vat_match_source is
  'Come è stata attribuita la partita IVA: profile_name = l''intestazione combacia col nome pubblico del profilo; declared_name = combacia con la ragione sociale dichiarata dal professionista (dato autodichiarato, da ricontrollare); staff = attribuita a mano da una persona.';

-- Le concessioni fondate su un nome dichiarato sono quelle da rivedere per
-- prime: indice parziale così la lista si apre in un istante anche fra un anno.
create index if not exists professional_verification_declared_match_idx
  on public.professional_verification (vat_match_source)
  where vat_match_source = 'declared_name';
