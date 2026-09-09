-- 074: LA DISDETTA HA UNA DATA, E LA DATA STA NEL DATABASE.
--
-- COS'ERA PRIMA. `lib/disdetta.ts` diceva la verita' di oggi — «ha effetto
-- subito, perche' finche' gli abbonamenti a pagamento non sono attivi non c'e'
-- nessun periodo da far scadere» — e la bozza dei ToS pro (4.3) prometteva
-- gia' l'altra: «con effetto dalla fine del periodo in corso». Due frasi vere
-- in due momenti diversi, e in mezzo il giorno del checkout, in cui qualcuno
-- si sarebbe dovuto ricordare di cambiarle tutte e due insieme. Questa
-- migrazione toglie quel giorno dal calendario: il prodotto sa gia' fare
-- l'abbonamento mensile, e quale dei due comportamenti applicare lo decide un
-- dato, non una riga di codice da riscrivere.
--
-- LA REGOLA, IN DUE RIGHE.
--   · Se il piano non costa niente a chi ce l'ha — oggi tutti, perche' i piani
--     si attivano con un codice — la disdetta ha effetto SUBITO. Non c'e'
--     nessun periodo pagato da far scadere, e tenere un professionista su Bob
--     Pro per tre settimane «fino alla fine del periodo» quando non ha mai
--     pagato niente sarebbe una finzione che lui vede benissimo.
--   · Se il piano lo paga, la disdetta ha effetto alla fine del MESE DI
--     ABBONAMENTO IN CORSO, contato dal giorno in cui quel piano e' stato
--     attivato — la stessa data che `/impostazioni/piano` mostra gia' come
--     «Attivo dal», e che vive in `subscription_tier_events` dalla 025.
-- La conseguenza e' che il giorno in cui il primo pagamento entra, il ramo
-- cambia da solo. Nessun deploy sincronizzato con niente.
--
-- PERCHE' DUE COLONNE E NON UNA. `disdetta_effettiva_dal` e' quando il piano
-- scende; `disdetta_chiesta_il` e' quando l'ha chiesto lui. Servono tutte e
-- due: la prima al lavoro notturno, la seconda a rispondere fra sei mesi alla
-- domanda «quando l'ho disdetto?», che e' esattamente il tipo di domanda per
-- cui un marketplace deve avere una risposta scritta (art. 4 P2B chiede
-- motivazione e tracciabilita' sulle restrizioni; qui la restrizione la chiede
-- l'interessato, ma la data resta dovuta).
--
-- LE COLONNE LE SCRIVE IL SERVER, NON IL BROWSER. Vanno dentro
-- `protect_professional_columns` insieme a piano e verifica. Senza, la policy
-- «Pro updates own profile» della 017 lascerebbe al professionista la
-- possibilita' di spostarsi la data da solo: disdire e poi mettere l'anno 3000
-- vorrebbe dire tenersi il piano per sempre. La data la calcoliamo noi.
--
-- IL DECLASSAMENTO LO FA UN LAVORO NOTTURNO, non una lettura pigra.
-- `professionals.subscription_tier` e' la colonna che legge mezza
-- applicazione — cancelli, portfolio, prenotazione diretta, ordinamento — e
-- una regola «il piano e' X, ma se c'e' una data passata allora e' free» andrebbe
-- ripetuta in ognuno di quei posti, e dimenticata in uno. Meglio una riga che
-- cambia una volta. Il giro sta in `system_job_runs` (049) come gli altri:
-- un lavoro che nessuno guarda e' un lavoro che non sai se e' girato.
--
-- CANCELLAZIONE E CONSERVAZIONE: nessun dato nuovo sulla persona, due date sul
-- profilo professionista, che muoiono con lui. Nessuna riga nuova nel registro
-- dei trattamenti: e' la stessa finalita' contrattuale della riga che c'e'.
--
-- Idempotente: add column if not exists, create or replace, unschedule prima
-- di schedule.

begin;

alter table public.professionals
  add column if not exists disdetta_chiesta_il timestamptz;
alter table public.professionals
  add column if not exists disdetta_effettiva_dal timestamptz;

comment on column public.professionals.disdetta_chiesta_il is
  'Quando il professionista ha chiesto la disdetta. Resta come prova della data, anche dopo che il piano e'' sceso.';
comment on column public.professionals.disdetta_effettiva_dal is
  'Quando il piano scende a free. NULL = nessuna disdetta in corso. La scrive solo il server: vedi protect_professional_columns.';

-- Il lavoro notturno legge solo queste: indice parziale, non uno su tutta la
-- tabella per una colonna che e' NULL nel 99% delle righe.
create index if not exists idx_professionals_disdetta_da_applicare
  on public.professionals (disdetta_effettiva_dal)
  where disdetta_effettiva_dal is not null;

-- --------------------------------------------------------------------------
-- Le due date le scrive il server
-- --------------------------------------------------------------------------
-- Stessa forma della versione viva in produzione, con due colonne in piu'
-- nell'elenco. `pg_trigger_depth() <= 1` e `auth.uid() is not null` restano:
-- il primo lascia lavorare i trigger che scrivono su questa tabella, il
-- secondo lascia lavorare il service role e il cron, che sessione non ne
-- hanno.
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
       or new.ready_at is distinct from old.ready_at
       or new.disdetta_chiesta_il is distinct from old.disdetta_chiesta_il
       or new.disdetta_effettiva_dal is distinct from old.disdetta_effettiva_dal then
      raise exception 'Non puoi modificare stato di verifica, livello, piano, proprietario, pubblicazione o disdetta del profilo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_professional_columns on public.professionals;
create trigger protect_professional_columns
  before update on public.professionals
  for each row execute function public.protect_professional_columns();

-- --------------------------------------------------------------------------
-- Il lavoro notturno
-- --------------------------------------------------------------------------
-- Porta a free chi ha una disdetta scaduta e pulisce le due date. La riga in
-- subscription_tier_events la scrive da se' il trigger on_subscription_tier_change,
-- che c'e' dalla 025: qui non si duplica.
create or replace function public.applica_disdette_scadute()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inizio timestamptz := now();
  v_quanti int := 0;
  v_chi jsonb;
begin
  with scadute as (
    select id, subscription_tier
    from public.professionals
    where disdetta_effettiva_dal is not null
      and disdetta_effettiva_dal <= now()
      and subscription_tier is distinct from 'free'
    for update
  ), fatte as (
    update public.professionals p
       set subscription_tier = 'free',
           disdetta_effettiva_dal = null,
           disdetta_chiesta_il = null
      from scadute s
     where p.id = s.id
    returning p.id, s.subscription_tier as da
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object('professional_id', id, 'da', da)), '[]'::jsonb)
    into v_quanti, v_chi
    from fatte;

  -- Anche una disdetta gia' passata ma su un profilo tornato a free da solo
  -- va ripulita, altrimenti la data resta li' a dire una cosa non piu' vera.
  update public.professionals
     set disdetta_effettiva_dal = null,
         disdetta_chiesta_il = null
   where disdetta_effettiva_dal is not null
     and disdetta_effettiva_dal <= now()
     and subscription_tier = 'free';

  insert into public.system_job_runs (job, started_at, finished_at, ok, outcome)
  values ('applica_disdette_scadute', v_inizio, now(), true,
          jsonb_build_object('declassati', v_quanti, 'chi', v_chi));
exception when others then
  insert into public.system_job_runs (job, started_at, finished_at, ok, error)
  values ('applica_disdette_scadute', v_inizio, now(), false, sqlerrm);
  raise;
end;
$$;

-- Nessuno la esegue dal browser: la chiama il cron, e la chiamiamo noi a mano
-- quando serve provarla.
revoke execute on function public.applica_disdette_scadute() from public, anon, authenticated;

-- 03:40 UTC, venti minuti dopo la purga della memoria cliente (034): due
-- lavori notturni non hanno ragione di partire insieme.
select cron.unschedule('applica-disdette-scadute')
where exists (select 1 from cron.job where jobname = 'applica-disdette-scadute');

select cron.schedule('applica-disdette-scadute', '40 3 * * *',
                     $cron$select public.applica_disdette_scadute();$cron$);

commit;
