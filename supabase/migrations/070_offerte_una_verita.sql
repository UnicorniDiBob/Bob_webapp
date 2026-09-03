-- 070: che lavori fa un professionista — una verità sola, e senza doppioni.
--
-- LE DUE VERITÀ, E COME DISCORDAVANO DAVVERO. Oggi «quali lavori fa questo
-- professionista» ha due risposte:
--   - `professionals.subservice_slugs`, un array di slug: sono i chip che il
--     professionista accende in «La tua azienda». Nessun prezzo.
--   - `professional_services`, una riga per intervento con prezzo, unità di
--     misura, città e prenotazione immediata.
-- Non è un rischio di deriva futura: al 2 settembre 2026 discordano su cinque
-- professionisti su sei.
--   idraulico    riga con prezzo per «riparazione perdite» (40-60€)
--                chip accesi per perdita rubinetto, emergenza allagamento,
--                sostituzione rubinetteria — nessuno dei quali ha una riga
--   pulizie      quattro righe (prenotazione immediata) + un chip in più,
--                «pulizie altro», senza riga
--   elettricista, imbianchino, tuttofare, fotografo
--                una riga ciascuno, zero chip accesi
-- Cioè: l'idraulico ha un prezzo per un lavoro che non dichiara, e dichiara
-- tre lavori che non ha prezzato. Il ranking deve sapere «fa QUESTO
-- intervento?» e oggi le due fonti risponderebbero cose diverse.
--
-- LA SCELTA: `professional_services` è la verità. Ha già la forma che serve —
-- una riga per intervento, col suo prezzo, la sua unità e il suo flag di
-- prenotazione immediata — e `subservice_slugs` non può portare un prezzo.
-- La colonna array verrà eliminata, ma NON qui: prima deve smettere di
-- leggerla il codice.
--
-- L'ORDINE È OBBLIGATO, IN UN VERSO SOLO. Vercel mette in produzione `main` da
-- sé, e le migrazioni passano da Supabase a mano: le due cose non sono
-- sincronizzate. Il passaggio di consegne del 30 agosto racconta questo stesso
-- pericolo nel verso opposto — codice nuovo in produzione prima della colonna,
-- e PostgREST rifiuta la select svuotando l'elenco dei professionisti. Qui è
-- lo specchio: togliere la colonna prima che il codice smetta di leggerla
-- rompe «La tua azienda» al professionista. Quindi:
--   070 (questa)  additiva: vincolo + riempimento. Non rompe niente, si può
--                 applicare quando si vuole.
--   poi il codice: chip che scrivono righe, useProfessional, la configurazione
--                 della prenotazione immediata, gli orari, e toCard che smette
--                 di prendere professional_services[0].
--   071           `drop column subservice_slugs`, solo a codice già in
--                 produzione.
--
-- I prezzi delle righe nuove restano NULL di proposito: dichiarare dodici
-- lavori non deve obbligare a fissare dodici prezzi, e un prezzo inventato da
-- una migrazione sarebbe peggio di nessun prezzo. Sarà la schermata a
-- chiederli, e ogni professionista confermerà o correggerà il suo elenco.
--
-- Idempotente: create index if not exists, insert con `not exists` + on
-- conflict do nothing.

-- ---------------------------------------------------------------------------
-- 1. Un intervento, una riga.
--    Oggi non c'è niente che impedisca due righe per lo stesso lavoro dello
--    stesso professionista: due prezzi diversi per la stessa cosa, e il
--    ranking che ne pesca una a caso. Il coalesce dà una chiave confrontabile
--    anche alla riga «solo mestiere, nessun intervento» (subservice_id NULL,
--    quella che crea l'iscrizione): senza, NULL non è uguale a NULL e quelle
--    righe si potrebbero duplicare a piacere.
--    Verificato prima di crearlo: 0 doppioni in produzione.
-- ---------------------------------------------------------------------------

create unique index if not exists professional_services_un_intervento_idx
  on public.professional_services (
    professional_id,
    coalesce(subservice_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- ---------------------------------------------------------------------------
-- 2. Il riempimento: unione delle due fonti.
--    Ogni chip accesso che non ha una riga se la prende. Il servizio non si
--    indovina: è quello del catalogo a cui l'intervento appartiene. La città
--    è quella che il professionista ha già sulle sue righe, e se non ne ha
--    quella del suo profilo — city_id è NOT NULL, quindi va risolta qui.
--    In produzione questo crea 4 righe: i tre lavori dell'idraulico e
--    «pulizie altro» delle pulizie.
-- ---------------------------------------------------------------------------

insert into public.professional_services (professional_id, service_id, subservice_id, city_id)
select p.id, sub.service_id, sub.id,
       coalesce(
         (select ps.city_id from public.professional_services ps
           where ps.professional_id = p.id
           order by ps.city_id limit 1),
         p.city_id
       )
from public.professionals p
cross join lateral unnest(coalesce(p.subservice_slugs, '{}'::text[])) as u(dichiarato)
join public.subservices sub on sub.slug = u.dichiarato
where p.city_id is not null
  and not exists (
    select 1 from public.professional_services ps
     where ps.professional_id = p.id
       and ps.subservice_id = sub.id
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Scritto nello schema, così non serve ricordarselo.
-- ---------------------------------------------------------------------------

comment on table public.professional_services is
  'Che lavori fa un professionista, e a che prezzo: una riga per intervento offerto. Dal 070 e la verita unica. La riga con subservice_id NULL vuol dire «il mestiere, nessun intervento specifico»: la crea l iscrizione e resta legittima.';

comment on column public.professionals.subservice_slugs is
  'DEPRECATA dal 070, la eliminera la 071. La verita e professional_services. Non leggerla in codice nuovo: al 02/09/2026 discordava dalle righe su cinque professionisti su sei.';
