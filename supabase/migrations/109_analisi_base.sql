-- 109_analisi_base.sql
--
-- L'ANALISI BASE (04/10, Lucio). Fase 1 delle Analisi:
-- docs/SPEC_analisi_professionista.md, §2, §3.2 e §7.
--
-- UGUALE PER TUTTI. «Se promettiamo che sia uguale, deve essere uguale»
-- (Lucio, 04/10): Free, Plus e Business leggono la stessa funzione, senza
-- nessun controllo di piano dentro. Il listino la segna inclusa sui tre piani.
--
-- COSA RESTITUISCE, per il mese scelto (predefinito: questo):
--   - i conteggi del mese: richieste ricevute, risposte date, proposte
--     inviate, accettate, prenotazioni dirette, lavori conclusi, disdetti,
--     importo e minuti dei lavori conclusi. Numeri grezzi, nessun rapporto:
--     i rapporti sono l'Analisi avanzata;
--   - i totali da sempre: lavori conclusi e importo;
--   - quello che e' gia' prenotato da oggi in avanti;
--   - l'elenco dei lavori conclusi nel mese, con gli importi;
--   - i mesi in cui c'e' qualcosa, per il selettore.
-- analisi_base_storico() da' invece tutto in una volta, per l'Excel: un
-- riepilogo per ogni mese e tutti i lavori conclusi.
--
-- DA DOVE. Conteggi e importi dalla vista analisi_mesi_vive (108): la stessa
-- fonte dell'Analisi avanzata, cosi' i due numeri non possono divergere.
-- L'elenco dei lavori da appointments, che non si condensa mai.
--
-- SECURITY INVOKER: il pro legge solo le sue righe perche' lo vuole la RLS
-- delle tabelle sotto, e il pro si ricava da auth.uid(), mai da un
-- parametro.
--
-- Idempotente: create or replace.

begin;

create or replace function public.analisi_base(p_mese date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
  v_pro uuid;
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  v_mese date;
  v_inizio timestamptz;
  v_fine timestamptz;
begin
  select p.id into v_pro
    from public.professionals p
   where p.user_id = (select auth.uid());
  if v_pro is null then
    return null;
  end if;

  v_mese := date_trunc('month', coalesce(p_mese, v_oggi))::date;
  v_inizio := v_mese::timestamp at time zone 'Europe/Rome';
  v_fine := (v_mese + interval '1 month')::timestamp at time zone 'Europe/Rome';

  return jsonb_build_object(
    'mese', v_mese,
    'conteggi', (
      select jsonb_build_object(
        'richieste',    coalesce(sum(v.richieste), 0),
        'risposte',     coalesce(sum(v.risposte), 0),
        'proposte',     coalesce(sum(v.proposte), 0),
        'accettate',    coalesce(sum(v.accettate), 0),
        'dirette',      coalesce(sum(v.dirette), 0),
        'conclusi',     coalesce(sum(v.conclusi), 0),
        'disdetti',     coalesce(sum(v.disdetti), 0),
        'importo_cent', coalesce(sum(v.importo_cent), 0),
        'minuti',       coalesce(sum(v.minuti_lavoro), 0))
        from public.analisi_mesi_vive v
       where v.professional_id = v_pro and v.origine = 'bob' and v.mese = v_mese
    ),
    'totali', (
      select jsonb_build_object(
        'conclusi',     coalesce(sum(v.conclusi), 0),
        'importo_cent', coalesce(sum(v.importo_cent), 0))
        from public.analisi_mesi_vive v
       where v.professional_id = v_pro and v.origine = 'bob'
    ),
    'prenotati', (
      select jsonb_build_object(
        'appuntamenti', count(*),
        'minuti',       coalesce(sum(a.duration_minutes), 0))
        from public.appointments a
       where a.professional_id = v_pro
         and a.status = 'confirmed'
         and a.starts_at >= now()
    ),
    'lavori', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'data',         a.starts_at,
               'titolo',       a.title,
               'cliente',      a.customer_name,
               'importo_cent', case when a.price is null then null
                                    else round(a.price * 100)::integer end,
               'minuti',       a.duration_minutes,
               'comune',       coalesce(c.nome, a.location_city))
             order by a.starts_at), '[]'::jsonb)
        from public.appointments a
        left join public.comuni c on c.istat = a.comune_istat
       where a.professional_id = v_pro
         and a.status = 'completed'
         and a.starts_at >= v_inizio
         and a.starts_at < v_fine
    ),
    'mesi', (
      select coalesce(jsonb_agg(m.mese order by m.mese desc), '[]'::jsonb)
        from (
          select v.mese from public.analisi_mesi_vive v
           where v.professional_id = v_pro and v.mese <= v_oggi
          union
          select date_trunc('month', v_oggi)::date
        ) m
    )
  );
end;
$function$;

create or replace function public.analisi_base_storico()
returns jsonb
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
  v_pro uuid;
begin
  select p.id into v_pro
    from public.professionals p
   where p.user_id = (select auth.uid());
  if v_pro is null then
    return null;
  end if;

  return jsonb_build_object(
    'mesi', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'mese',         s.mese,
               'richieste',    s.richieste,
               'risposte',     s.risposte,
               'proposte',     s.proposte,
               'accettate',    s.accettate,
               'dirette',      s.dirette,
               'conclusi',     s.conclusi,
               'disdetti',     s.disdetti,
               'importo_cent', s.importo_cent,
               'minuti',       s.minuti)
             order by s.mese), '[]'::jsonb)
        from (
          select v.mese,
                 sum(v.richieste) as richieste, sum(v.risposte) as risposte,
                 sum(v.proposte) as proposte, sum(v.accettate) as accettate,
                 sum(v.dirette) as dirette, sum(v.conclusi) as conclusi,
                 sum(v.disdetti) as disdetti, sum(v.importo_cent) as importo_cent,
                 sum(v.minuti_lavoro) as minuti
            from public.analisi_mesi_vive v
           where v.professional_id = v_pro and v.origine = 'bob'
           group by v.mese
        ) s
    ),
    'lavori', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'data',         a.starts_at,
               'titolo',       a.title,
               'cliente',      a.customer_name,
               'importo_cent', case when a.price is null then null
                                    else round(a.price * 100)::integer end,
               'minuti',       a.duration_minutes,
               'comune',       coalesce(c.nome, a.location_city))
             order by a.starts_at), '[]'::jsonb)
        from public.appointments a
        left join public.comuni c on c.istat = a.comune_istat
       where a.professional_id = v_pro
         and a.status = 'completed'
    )
  );
end;
$function$;

revoke all on function public.analisi_base(date) from public, anon;
grant execute on function public.analisi_base(date) to authenticated;
revoke all on function public.analisi_base_storico() from public, anon;
grant execute on function public.analisi_base_storico() to authenticated;

commit;
