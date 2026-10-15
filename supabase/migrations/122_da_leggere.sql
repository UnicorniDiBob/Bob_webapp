-- 122_da_leggere.sql
--
-- «DA LEGGERE»: UN SEGNO PERSONALE SULLA PROPRIA CONVERSAZIONE (15/10,
-- decisioni di André del 15/10; scorrere a destra in /messaggi).
--
-- COSA E'. Come su WhatsApp: chi rimanda una conversazione la segna «da
-- leggere» e la ritrova evidenziata, contata nel pallino dei messaggi, finche'
-- non la riapre. E' una preferenza della propria casella, non un messaggio:
-- l'altra parte non vede niente, e niente cambia nel suo pallino, nelle sue
-- notifiche o nello stato della richiesta. Per questo due colonne, una per
-- parte, sulla riga che gia' rappresenta la conversazione
-- (request_professionals = richiesta + pro): cliente_da_leggere per il
-- cliente, pro_da_leggere per il pro.
--
-- CHI LE SCRIVE. Solo segna_da_leggere(), chiamata dalla route
-- /api/conversazioni/da-leggere col service role dopo aver letto la sessione:
-- la funzione decide la parte da p_utente (il cliente della richiesta → la sua
-- colonna; l'utente del pro → la sua), e a chiunque altro risponde «non_tuo».
-- Il pro oggi puo' aggiornare la propria riga («Pro updates own assignments»):
-- senza la guardia qui sotto potrebbe cambiare il segno del cliente, o il suo
-- fuori dalla funzione. Il cliente non ha UPDATE su questa tabella.
--
-- STATO VIVO LETTO PRIMA DI SCRIVERE (15/10, sola lettura; dettagli nella
-- PR): colonne id, request_id, professional_id, status, created_at,
-- archived_at; policy «Pro reads own assignments», «Pro updates own
-- assignments», «User inserts own request_professionals», «User reads own
-- request_professionals»; trigger analisi_partecipazione (solo OF status) e
-- proteggi_archiviazione (120, solo OF archived_at, non cambia). Nessuna
-- funzione condivisa viene riscritta.
--
-- PRIVACY. Una preferenza d'interfaccia sulla propria casella, nessuna
-- finalita' nuova: il registro dei trattamenti non cambia. La conservazione
-- segue la riga (request_professionals).
--
-- Idempotente: add column if not exists, create or replace, drop-then-create
-- del trigger, revoke e grant ripetibili.

alter table public.request_professionals
  add column if not exists cliente_da_leggere boolean not null default false,
  add column if not exists pro_da_leggere boolean not null default false;

comment on column public.request_professionals.cliente_da_leggere is
  'Il cliente ha segnato questa conversazione «da leggere» (122). Solo per lui; lo scrive segna_da_leggere().';
comment on column public.request_professionals.pro_da_leggere is
  'Il pro ha segnato questa conversazione «da leggere» (122). Solo per lui; lo scrive segna_da_leggere().';

-- La guardia: nessun utente cambia i due segni da solo, solo la funzione
-- (service role, auth.uid() nullo). Stessa forma di proteggi_archiviazione.
create or replace function public.proteggi_da_leggere()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.cliente_da_leggere is distinct from old.cliente_da_leggere
      or new.pro_da_leggere is distinct from old.pro_da_leggere)
     and auth.uid() is not null
     and not private.is_admin_or_cs() then
    raise exception 'Il segno «da leggere» si cambia dalla propria lista dei messaggi'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.proteggi_da_leggere() from public, anon, authenticated;

drop trigger if exists proteggi_da_leggere on public.request_professionals;
create trigger proteggi_da_leggere
  before update of cliente_da_leggere, pro_da_leggere on public.request_professionals
  for each row execute function public.proteggi_da_leggere();

-- Segna o toglie «da leggere» per CHI chiama: la parte la decide p_utente,
-- mai chi chiama la route. Una conversazione archiviata si puo' segnare (il
-- pro rilegge la sua chat in sola lettura); l'interfaccia del cliente li'
-- non lo offre.
create or replace function public.segna_da_leggere(
  p_richiesta uuid,
  p_professionista uuid,
  p_utente uuid,
  p_valore boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lato text;
begin
  if exists (
    select 1 from public.requests r where r.id = p_richiesta and r.customer_id = p_utente
  ) then
    v_lato := 'cliente';
  elsif exists (
    select 1 from public.professionals p where p.id = p_professionista and p.user_id = p_utente
  ) then
    v_lato := 'pro';
  else
    return jsonb_build_object('ok', false, 'motivo', 'non_tuo');
  end if;

  if v_lato = 'cliente' then
    update public.request_professionals
       set cliente_da_leggere = coalesce(p_valore, false)
     where request_id = p_richiesta and professional_id = p_professionista;
  else
    update public.request_professionals
       set pro_da_leggere = coalesce(p_valore, false)
     where request_id = p_richiesta and professional_id = p_professionista;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'non_tuo');
  end if;

  return jsonb_build_object('ok', true, 'lato', v_lato, 'valore', coalesce(p_valore, false));
end;
$$;

revoke execute on function public.segna_da_leggere(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.segna_da_leggere(uuid, uuid, uuid, boolean) to service_role;
