-- 110_analisi_avanzata.sql
--
-- L'ANALISI AVANZATA (04/10, Lucio). Fase 2 delle Analisi, senza i ricavi
-- esterni (arrivano a parte): docs/SPEC_analisi_professionista.md, §3.3,
-- §3.4 e §3.7.
--
-- UGUALE PER PLUS E BUSINESS, e chiusa per il Free. Il piano si controlla
-- QUI, non solo nella pagina: una pagina che nasconde un bottone non e' un
-- limite di piano. Il Free riceve un errore 42501 con una frase leggibile.
--
-- DUE PERIODI. p_da..p_a e, se c'e', p_contro_da..p_contro_a: mesi interi
-- (si prende il mese delle date passate). Ogni periodo restituisce lo stesso
-- blocco, cosi' la pagina li mette fianco a fianco:
--   totali       i conteggi e gli importi del periodo (vista 108);
--   per_mese     gli stessi, mese per mese, per l'andamento;
--   per_servizio proposte, accettate, dirette, conclusi e importo;
--   per_comune   lavori conclusi e importo per comune;
--   prima_risposta  per fascia di attesa (<1h, 1-4h, 4-24h, oltre), quante
--                richieste e quante sono arrivate a un appuntamento: dal
--                registro, quindi solo dove c'e' il dettaglio (25 mesi);
--   senza_risposta  richieste ricevute da piu' di 48 ore a cui il pro non
--                ha mai risposto, e che non sono diventate una prenotazione
--                diretta o una proposta: quante, e le ultime dieci (data e
--                servizio, niente del cliente);
--   clienti      clienti registrati con un lavoro concluso nel periodo, e
--                quanti di loro ne avevano gia' avuto uno prima. Gli
--                appuntamenti scritti dal pro senza cliente registrato non
--                si possono contare, e il numero lo dice;
--   saturazione  per mese, minuti venduti (confermati + conclusi) contro
--                minuti disponibili (orari settimanali meno le assenze).
--                La disponibilita' non ha storia: per i mesi passati vale
--                quella di oggi, e la pagina lo scrive.
--
-- SECURITY INVOKER: la RLS delle tabelle sotto fa il resto. Il pro viene da
-- auth.uid(), mai da un parametro.
--
-- Idempotente: create or replace.

begin;

create or replace function public.analisi_avanzata(
  p_da date,
  p_a date,
  p_contro_da date default null,
  p_contro_a date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
  v_pro uuid;
  v_piano text;
  v_out jsonb := '{}'::jsonb;
  v_chiave text;
  v_da date;
  v_a date;
  v_ini timestamptz;
  v_fin timestamptz;
  i integer;
begin
  select p.id, p.subscription_tier into v_pro, v_piano
    from public.professionals p
   where p.user_id = (select auth.uid());
  if v_pro is null then
    return null;
  end if;
  if v_piano not in ('pro', 'business') then
    raise exception 'Le Analisi avanzate sono incluse in Bob Plus e Bob Business'
      using errcode = '42501';
  end if;

  for i in 1..2 loop
    if i = 1 then
      v_chiave := 'periodo';
      v_da := date_trunc('month', p_da)::date;
      v_a := date_trunc('month', p_a)::date;
    else
      exit when p_contro_da is null or p_contro_a is null;
      v_chiave := 'contro';
      v_da := date_trunc('month', p_contro_da)::date;
      v_a := date_trunc('month', p_contro_a)::date;
    end if;

    if v_da is null or v_a is null or v_a < v_da or v_a > v_da + interval '120 months' then
      raise exception 'analisi_avanzata: periodo non valido (% - %)', v_da, v_a;
    end if;

    v_ini := v_da::timestamp at time zone 'Europe/Rome';
    v_fin := (v_a + interval '1 month')::timestamp at time zone 'Europe/Rome';

    v_out := v_out || jsonb_build_object(v_chiave, jsonb_build_object(
      'da', v_da,
      'a', v_a,

      'totali', (
        select jsonb_build_object(
          'richieste',    coalesce(sum(v.richieste), 0),
          'risposte',     coalesce(sum(v.risposte), 0),
          'risposte_1h',  coalesce(sum(v.risposte_1h), 0),
          'risposte_4h',  coalesce(sum(v.risposte_4h), 0),
          'risposte_24h', coalesce(sum(v.risposte_24h), 0),
          'proposte',     coalesce(sum(v.proposte), 0),
          'accettate',    coalesce(sum(v.accettate), 0),
          'rifiutate',    coalesce(sum(v.rifiutate), 0),
          'dirette',      coalesce(sum(v.dirette), 0),
          'conclusi',     coalesce(sum(v.conclusi), 0),
          'disdetti',     coalesce(sum(v.disdetti), 0),
          'importo_cent', coalesce(sum(v.importo_cent), 0),
          'minuti',       coalesce(sum(v.minuti_lavoro), 0))
          from public.analisi_mesi_vive v
         where v.professional_id = v_pro and v.origine = 'bob'
           and v.mese between v_da and v_a
      ),

      'per_mese', (
        select jsonb_agg(jsonb_build_object(
                 'mese',         g.mese::date,
                 'richieste',    coalesce(s.richieste, 0),
                 'proposte',     coalesce(s.proposte, 0),
                 'accettate',    coalesce(s.accettate, 0),
                 'dirette',      coalesce(s.dirette, 0),
                 'conclusi',     coalesce(s.conclusi, 0),
                 'importo_cent', coalesce(s.importo_cent, 0))
               order by g.mese)
          from generate_series(v_da, v_a, interval '1 month') g(mese)
          left join lateral (
            select sum(v.richieste) as richieste, sum(v.proposte) as proposte,
                   sum(v.accettate) as accettate, sum(v.dirette) as dirette,
                   sum(v.conclusi) as conclusi, sum(v.importo_cent) as importo_cent
              from public.analisi_mesi_vive v
             where v.professional_id = v_pro and v.origine = 'bob'
               and v.mese = g.mese::date
          ) s on true
      ),

      'per_servizio', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'servizio',     x.nome,
                 'richieste',    x.richieste,
                 'proposte',     x.proposte,
                 'accettate',    x.accettate,
                 'dirette',      x.dirette,
                 'conclusi',     x.conclusi,
                 'importo_cent', x.importo_cent)
               order by x.importo_cent desc, x.proposte desc), '[]'::jsonb)
          from (
            select coalesce(s.name, 'Non specificato') as nome,
                   sum(v.richieste) as richieste, sum(v.proposte) as proposte,
                   sum(v.accettate) as accettate, sum(v.dirette) as dirette,
                   sum(v.conclusi) as conclusi, sum(v.importo_cent) as importo_cent
              from public.analisi_mesi_vive v
              left join public.services s on s.id = v.service_id
             where v.professional_id = v_pro and v.origine = 'bob'
               and v.mese between v_da and v_a
             group by 1
          ) x
         where x.richieste + x.proposte + x.dirette + x.conclusi > 0
      ),

      'per_comune', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'comune',       x.nome,
                 'conclusi',     x.conclusi,
                 'importo_cent', x.importo_cent)
               order by x.importo_cent desc), '[]'::jsonb)
          from (
            select coalesce(c.nome, 'Comune non indicato') as nome,
                   sum(v.conclusi) as conclusi, sum(v.importo_cent) as importo_cent
              from public.analisi_mesi_vive v
              left join public.comuni c on c.istat = v.comune_istat
             where v.professional_id = v_pro and v.origine = 'bob'
               and v.mese between v_da and v_a
             group by 1
          ) x
         where x.conclusi > 0
      ),

      'prima_risposta', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'fascia', b.fascia, 'richieste', b.n, 'arrivate', b.arrivate)
               order by b.fascia), '[]'::jsonb)
          from (
            select case when r.minuti <= 60 then 1
                        when r.minuti <= 240 then 2
                        when r.minuti <= 1440 then 3
                        else 4 end as fascia,
                   count(*) as n,
                   count(*) filter (where exists (
                     select 1 from public.professional_work_events x
                      where x.professional_id = v_pro
                        and x.richiesta = r.rif
                        and x.evento in ('proposta_accettata', 'lavoro_concluso')
                   )) as arrivate
              from public.professional_work_events r
             where r.professional_id = v_pro
               and r.evento = 'prima_risposta'
               and r.minuti is not null
               and r.avvenuto_al >= v_ini and r.avvenuto_al < v_fin
             group by 1
          ) b
      ),

      'senza_risposta', (
        with senza as (
          select q.avvenuto_al, q.service_id
            from public.professional_work_events q
           where q.professional_id = v_pro
             and q.evento = 'richiesta_ricevuta'
             and q.avvenuto_al >= v_ini and q.avvenuto_al < v_fin
             and q.avvenuto_al < now() - interval '48 hours'
             and not exists (
               select 1 from public.professional_work_events x
                where x.professional_id = v_pro
                  and (
                    (x.evento = 'prima_risposta' and x.rif = q.rif)
                    or (x.richiesta = q.rif
                        and x.evento in ('prenotazione_diretta', 'proposta_inviata', 'proposta_accettata'))
                  )
             )
        )
        select jsonb_build_object(
                 'quante', (select count(*) from senza),
                 'ultime', coalesce((
                   select jsonb_agg(jsonb_build_object('data', z.avvenuto_al, 'servizio', z.nome)
                                    order by z.avvenuto_al desc)
                     from (
                       select s1.avvenuto_al, coalesce(sv.name, 'Non specificato') as nome
                         from senza s1
                         left join public.services sv on sv.id = s1.service_id
                        order by s1.avvenuto_al desc
                        limit 10
                     ) z), '[]'::jsonb))
      ),

      'clienti', (
        with fatti as (
          select a.customer_id, a.starts_at
            from public.appointments a
           where a.professional_id = v_pro
             and a.status = 'completed'
             and a.customer_id is not null
        )
        select jsonb_build_object(
                 'clienti', count(distinct f.customer_id),
                 'tornati', count(distinct f.customer_id) filter (where exists (
                   select 1 from fatti f2
                    where f2.customer_id = f.customer_id and f2.starts_at < f.starts_at)),
                 'lavori_senza_cliente', (
                   select count(*) from public.appointments a
                    where a.professional_id = v_pro and a.status = 'completed'
                      and a.customer_id is null
                      and a.starts_at >= v_ini and a.starts_at < v_fin))
          from fatti f
         where f.starts_at >= v_ini and f.starts_at < v_fin
      ),

      'saturazione', (
        select jsonb_agg(jsonb_build_object(
                 'mese',        g.mese::date,
                 'venduti',     vend.minuti,
                 'disponibili', greatest(disp.minuti - ass.minuti, 0))
               order by g.mese)
          from generate_series(v_da, v_a, interval '1 month') g(mese)
          cross join lateral (
            select (g.mese::date)::timestamp at time zone 'Europe/Rome' as ini,
                   ((g.mese::date) + interval '1 month')::timestamp at time zone 'Europe/Rome' as fin
          ) m
          cross join lateral (
            select coalesce(sum(extract(epoch from (pa.end_time - pa.start_time)) / 60), 0)::integer as minuti
              from generate_series(g.mese::date, (g.mese::date + interval '1 month' - interval '1 day')::date,
                                   interval '1 day') d(giorno)
              join public.professional_availability pa
                on pa.professional_id = v_pro
               and pa.weekday = extract(dow from d.giorno)
          ) disp
          cross join lateral (
            select coalesce(sum(extract(epoch from (least(b.ends_at, m.fin) - greatest(b.starts_at, m.ini))) / 60), 0)::integer as minuti
              from public.professional_availability_blocks b
             where b.professional_id = v_pro
               and b.starts_at < m.fin and b.ends_at > m.ini
          ) ass
          cross join lateral (
            select coalesce(sum(a.duration_minutes), 0)::integer as minuti
              from public.appointments a
             where a.professional_id = v_pro
               and a.status in ('confirmed', 'completed')
               and a.starts_at >= m.ini and a.starts_at < m.fin
          ) vend
      )
    ));
  end loop;

  return v_out || jsonb_build_object(
    'piano', v_piano,
    -- Da qui in avanti il registro ha il dettaglio (prima risposta, richieste
    -- senza risposta): prima, solo i mesi condensati.
    'dettaglio_dal', (date_trunc('month', now() at time zone 'Europe/Rome') - interval '25 months')::date
  );
end;
$function$;

revoke all on function public.analisi_avanzata(date, date, date, date) from public, anon;
grant execute on function public.analisi_avanzata(date, date, date, date) to authenticated;

commit;
