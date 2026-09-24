-- 093_quote_intake_altro.sql
--
-- I cinque "-altro" dei servizi core (idraulico-altro, elettricista-altro,
-- imbianchino-altro, pulizie-altro, tuttofare-altro) sono rimasti a
-- quote_level='survey' con quote_fields vuoto dopo la 092: il fallback
-- generico a tre campi di quella migrazione mirava solo agli altri dieci
-- servizi (spec §4 fine sezione), non ai cataloghi "altro" dei cinque core.
-- Risultato: un cliente che sceglie "altro" dentro idraulico o pulizie non
-- riceve nessuna domanda strutturata, mentre lo stesso fallback esiste gia'
-- per fotografo, traslochi eccetera. Stesso trattamento qui: nessuna
-- ragione per cui "altro" dentro un servizio core debba essere piu' povero
-- di "altro" fuori dal core five.
--
-- Idempotente: update per slug, valori statici, nessuno stato da rileggere.

begin;

update public.subservices s
   set quote_level = 'survey',
       quote_fields = '[
  {"key":"what_exactly","type":"text","label":"Cosa ti serve esattamente?","required":true,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"quantity","type":"number","label":"Quante volte / quanti pezzi / quante ore?",
   "required":false,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"deadline","type":"text","label":"Entro quando ti serve?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb
 where s.slug in (
   'idraulico-altro', 'elettricista-altro', 'imbianchino-altro',
   'pulizie-altro', 'tuttofare-altro'
 );

commit;
