-- 060: il contatore dei riscatti del codice promo torna indietro.
--
-- IL DIFETTO, misurato. Il 27/08 in produzione promo_codes.used_count diceva 2
-- per BOB-FOUNDER-2026 mentre promo_redemptions aveva ZERO righe. Il contatore
-- si incrementa al riscatto e non viene mai decrementato: cancellando l'account
-- che ha riscattato, la riga di riscatto se ne va a cascata e il contatore
-- resta su. Oggi non fa danno perche' max_uses e' NULL — il codice non ha
-- tetto e non scade — ma il giorno che gli si mette un tetto (e va messo: i
-- fondatori entrano con Business gratis) quel tetto sarebbe sbagliato in
-- partenza, e nessuno lo scoprirebbe guardando il numero.
--
-- LA CURA. used_count smette di essere un numero che qualcuno incrementa e
-- diventa il conteggio delle righe di promo_redemptions, mantenuto da un
-- trigger su insert e su delete. Cosi' non puo' divergere: la verita' e' una
-- sola, le righe.
--
-- Idempotente.

create or replace function private.sync_promo_used_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
begin
  cid := coalesce(new.promo_code_id, old.promo_code_id);
  update public.promo_codes p
     set used_count = (
       select count(*) from public.promo_redemptions r
        where r.promo_code_id = cid
     )
   where p.id = cid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_promo_used_count on public.promo_redemptions;
create trigger sync_promo_used_count
  after insert or delete on public.promo_redemptions
  for each row execute function private.sync_promo_used_count();

-- Riallineamento una volta sola: tutti i codici, non solo quello dei fondatori.
update public.promo_codes p
   set used_count = (
     select count(*) from public.promo_redemptions r where r.promo_code_id = p.id
   )
 where p.used_count is distinct from (
     select count(*) from public.promo_redemptions r where r.promo_code_id = p.id
   );
