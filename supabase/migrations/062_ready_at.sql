-- ---------------------------------------------------------------------------
-- 062 — «pronto a ricevere richieste» smette di essere una frase
-- ---------------------------------------------------------------------------
--
-- IL PROBLEMA. La 057 ha creato professionals.ready_at, l'ha protetta dal
-- client e ha lasciato scritto che lo stato lo scrive il server. Nessuno l'ha
-- mai scritta: 29/08/2026, sei professionisti in produzione, sei ready_at NULL.
-- Nel frattempo la guida del primo accesso mostrava la frase «pronto a ricevere
-- richieste» calcolandosela nel browser, senza alcun rapporto con la colonna.
-- Una colonna vuota e una frase che sembra un semaforo sono la stessa bugia
-- detta due volte.
--
-- LA REGOLA, decisa il 29/08 e volutamente stretta: pronto = i clienti ti
-- trovano. Cioe' almeno un servizio dichiarato (senza, getProfessionals filtra
-- per serviceSlug e il pro non esiste in nessun elenco) e profilo non
-- disattivato. Zone e orari restano consigli: senza, si compare lo stesso.
-- Il telefono non puo' essere un requisito finche' le chiamate non esistono nel
-- prodotto — quando esisteranno, si aggiunge qui e in un posto solo.
--
-- CHI LA SCRIVE. Due trigger, non una route: se dipendesse da una chiamata
-- applicativa, il primo servizio aggiunto dal pannello admin, da uno script o
-- da un import lascerebbe lo stato indietro senza che nessuno se ne accorga.
-- Il database sa quando cambia la condizione, ed e' l'unico che lo sa sempre.
--
-- ready_at NON si sposta se e' gia' acceso e la condizione resta vera: e' la
-- data in cui sei diventato trovabile, non l'ora dell'ultimo salvataggio.
-- Torna NULL se la condizione cade (ultimo servizio tolto, profilo spento).
--
-- PRIVACY. Nessun dato personale nuovo, nessuna finalita' nuova: e' uno stato
-- calcolato da righe che gia' esistono, sulla riga del professionista, e muore
-- con lei. Niente nuova voce di RoPA.
--
-- Idempotente: create or replace, drop-then-create per i trigger.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. La condizione, in un posto solo
-- ---------------------------------------------------------------------------

create or replace function private.pro_e_pronto(p_professional uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1
             from public.professional_services s
            where s.professional_id = p_professional
         )
     and exists (
           select 1
             from public.professionals p
            where p.id = p_professional
              and p.deactivated_at is null
         );
$$;

comment on function private.pro_e_pronto(uuid) is
  'Pronto = almeno un servizio dichiarato e profilo non disattivato. Zone, orari e telefono non entrano: senza, si compare lo stesso.';

-- ---------------------------------------------------------------------------
-- 2. L'applicazione dello stato su una riga
-- ---------------------------------------------------------------------------

create or replace function private.applica_ready_at(p_professional uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valore timestamptz;
begin
  select case
           when private.pro_e_pronto(p_professional) then coalesce(p.ready_at, now())
           else null
         end
    into v_valore
    from public.professionals p
   where p.id = p_professional;

  -- Nessuna riga: niente da fare. Nessun cambiamento: nessuna scrittura, cosi'
  -- non si sveglia il trigger di protezione per nulla.
  update public.professionals p
     set ready_at = v_valore
   where p.id = p_professional
     and p.ready_at is distinct from v_valore;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. I due trigger che la tengono vera
-- ---------------------------------------------------------------------------

create or replace function public.sync_ready_at_da_servizi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pro uuid;
begin
  if tg_op = 'DELETE' then
    v_pro := old.professional_id;
  else
    v_pro := new.professional_id;
  end if;
  perform private.applica_ready_at(v_pro);
  -- Su UPDATE del professional_id anche il vecchio proprietario cambia stato.
  if tg_op = 'UPDATE' and old.professional_id is distinct from new.professional_id then
    perform private.applica_ready_at(old.professional_id);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.sync_ready_at_da_profilo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.applica_ready_at(new.id);
  return new;
end;
$$;

drop trigger if exists sync_ready_at_servizi on public.professional_services;
create trigger sync_ready_at_servizi
  after insert or delete or update of professional_id on public.professional_services
  for each row execute function public.sync_ready_at_da_servizi();

-- Solo la riaccensione/spegnimento del profilo tocca lo stato. Il trigger
-- aggiorna la stessa riga: non rientra su se stesso perche' la UPDATE interna
-- nomina la sola colonna ready_at, che non e' nell'elenco "update of".
drop trigger if exists sync_ready_at_profilo on public.professionals;
create trigger sync_ready_at_profilo
  after update of deactivated_at on public.professionals
  for each row execute function public.sync_ready_at_da_profilo();

-- ---------------------------------------------------------------------------
-- 4. La protezione della 057, adattata: il client no, i nostri trigger si'
-- ---------------------------------------------------------------------------
--
-- Il trigger della 057 rifiuta qualunque cambio di ready_at che arrivi da un
-- utente autenticato: giusto, e' esattamente la garanzia che «pronto» non se lo
-- possa dichiarare da solo con una chiamata REST. Ma ora ready_at la scrivono i
-- nostri trigger, e la loro UPDATE arriva dentro la stessa richiesta, con lo
-- stesso auth.uid(): senza distinguere, aggiungere un servizio fallirebbe con
-- un errore incomprensibile.
--
-- La distinzione e' pg_trigger_depth(): una UPDATE scritta dal client fa
-- scattare questo trigger a profondita' 1; quella generata da uno dei nostri
-- trigger a profondita' 2 o piu'. Un client non puo' salire di profondita' da
-- solo — dovrebbe passare da un nostro trigger, che tocca solo ready_at.
--
-- L'elenco delle colonne protette e' RIPETUTO per intero (come nella 057): la
-- funzione si sostituisce, non si estende, e una colonna dimenticata qui
-- sarebbe una colonna che il professionista puo' riscriversi da solo.
create or replace function public.protect_professional_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not private.is_admin_or_cs()
     and pg_trigger_depth() <= 1 then
    if new.verification_status is distinct from old.verification_status
       or new.subscription_tier is distinct from old.subscription_tier
       or new.user_id is distinct from old.user_id
       or new.verification_level is distinct from old.verification_level
       or new.verification_level_at is distinct from old.verification_level_at
       or new.ready_at is distinct from old.ready_at then
      raise exception 'Non puoi modificare stato di verifica, livello, piano, proprietario o pubblicazione del profilo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_professional_columns on public.professionals;
create trigger protect_professional_columns
  before update on public.professionals
  for each row execute function public.protect_professional_columns();

-- ---------------------------------------------------------------------------
-- 5. Allineamento di cio' che c'e' gia'
-- ---------------------------------------------------------------------------
-- Gira come proprietario della migrazione (auth.uid() nullo): la protezione non
-- si attiva. Accende chi era gia' trovabile senza saperlo e spegne chi non lo e'.

update public.professionals p
   set ready_at = now()
 where p.ready_at is null
   and p.deactivated_at is null
   and exists (
         select 1 from public.professional_services s
          where s.professional_id = p.id
       );

update public.professionals p
   set ready_at = null
 where p.ready_at is not null
   and (
     p.deactivated_at is not null
     or not exists (
           select 1 from public.professional_services s
            where s.professional_id = p.id
         )
   );
