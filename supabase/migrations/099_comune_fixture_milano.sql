-- 099: semina comune e CAP sulle cinque fixture di dimostrazione, per dare
-- alla 098 qualcosa da leggere.
--
-- PERCHÉ. Verificato dalla 098: professionals.comune_istat è NULL su tutti e
-- sei i professionisti in produzione, perché tutti e sei predatano la 085
-- (17/09) — non un percorso di scrittura rotto, un timing. Le cinque
-- `b1000000-…` sono dimostrazione (create il 3 giugno 2026, mai passate da
-- un questionario vero) e la loro base è Milano per costruzione: la città di
-- Bob su cui vivono (professionals.city_id) è già Milano, e non hanno un
-- titolare che possa aprire `/impostazioni/azienda` a scriverlo da sé.
-- FOTOPRO-MILANO resta fuori apposta: è un'attività vera, lo scrive il suo
-- titolare dalla scheda, non una migrazione.
--
-- COSA SEMINA. comune_istat/comune_name/provincia/regione = Milano (gli
-- stessi valori di public.comuni dove istat='015146', letti da produzione
-- prima di scrivere questo file, non a memoria). Il CAP è uno dei 42 di
-- Milano per ciascuna riga — cinque diversi, non lo stesso ripetuto cinque
-- volte, perché sarebbe più facile scambiarlo per un copia-incolla che per
-- un dato vero. Nessuno dei due conta ancora per punti_distanza: la 098
-- risolve il punto base solo al livello di comune (professionals.comune_istat
-- → comuni.lat/lng), non al CAP — il CAP arriva con il pezzo 3
-- (cap_centroids), non costruito qui. Fino ad allora tutte e cinque
-- risolvono allo stesso punto — è esattamente il cancello di cutover scritto
-- nella 098, non un difetto di questa semina.
--
-- PERCHÉ UNA MIGRAZIONE E NON UN UPDATE A MANO. Regola di progetto: niente
-- di irripetibile fuori da git. Un valore scritto a mano su Supabase e mai
-- messo in un file è esattamente il buco della migrazione 056.
--
-- Idempotente: aggiorna solo le righe che ancora non hanno comune_istat, così
-- rieseguirla non sovrascrive un valore che un giorno un titolare vero avesse
-- scritto da sé (non possibile oggi per queste cinque, ma la guardia costa
-- una riga e vale per sempre).

begin;

update public.professionals
   set comune_istat = '015146',
       comune_name = 'Milano',
       province = 'Milano',
       region = 'Lombardia',
       postal_code = casi.cap
  from (values
    ('b1000000-0000-0000-0000-000000000003'::uuid, '20121'),
    ('b1000000-0000-0000-0000-000000000004'::uuid, '20124'),
    ('b1000000-0000-0000-0000-000000000005'::uuid, '20133'),
    ('b1000000-0000-0000-0000-000000000006'::uuid, '20144'),
    ('b1000000-0000-0000-0000-000000000007'::uuid, '20156')
  ) as casi(id, cap)
 where public.professionals.id = casi.id
   and public.professionals.comune_istat is null;

commit;
