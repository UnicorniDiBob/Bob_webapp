-- 093_quote_intake_altro.sql
--
-- I cinque sotto-servizi "-altro" del core five (idraulico, elettricista,
-- imbianchino, pulizie, tuttofare) sono rimasti a quote_level='survey' /
-- quote_fields='[]'::jsonb, il default della 091: la 092 ha popolato ogni
-- sotto-servizio nominato in spec §4 piu' il fallback generico per gli
-- altri dieci servizi, ma non ha toccato questi cinque perche' non sono
-- nominati ne' nella tabella del core five ne' nella lista dei dieci.
--
-- Verificato in produzione prima di scrivere questo file (21 settembre):
-- sono esattamente questi cinque ad avere quote_fields vuoto fra tutti gli
-- slug '%-altro' — gli altri dieci (fotografo-altro, giardiniere-altro,
-- ecc.) hanno gia' il fallback generico dalla 092, perche' quella query
-- filtrava per servizio, non per sotto-servizio.
--
-- Conseguenza scoperta il 20-21 settembre: quote_fields vuoto per un
-- sotto-servizio risolto (non null: risolto proprio a "-altro") fa si' che
-- il client (BobChat.tsx) non offra mai la scheda lavoro per quella
-- conversazione — "mai una scheda vuota" e' la regola giusta, ma "-altro"
-- diventava cosi' un vicolo cieco strutturale, non un esito onesto quando
-- nulla si adatta.
--
-- Stesso fallback generico spec §4 fine sezione, gia' usato dalla 092 per
-- gli altri dieci servizi. Idempotente: update per slug, valori statici.

begin;

update public.subservices
   set quote_level = 'survey',
       quote_fields = '[
  {"key":"what_exactly","type":"text","label":"Cosa ti serve esattamente?","required":true,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"quantity","type":"number","label":"Quante volte / quanti pezzi / quante ore?",
   "required":false,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"deadline","type":"text","label":"Entro quando ti serve?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb
 where slug in (
   'idraulico-altro', 'elettricista-altro', 'imbianchino-altro',
   'pulizie-altro', 'tuttofare-altro'
 );

commit;
