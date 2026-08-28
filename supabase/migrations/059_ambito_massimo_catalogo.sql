-- 059: fin dove può arrivare ogni mestiere, e chi può lavorare a distanza.
--
-- PERCHÉ È DATO DI CATALOGO E NON UNA SCELTA DEL PROFESSIONISTA
-- Un fotografo di matrimoni che copre l'Italia è normale. Un idraulico che
-- dichiara la stessa cosa è una richiesta persa per il cliente (arriva un
-- preventivo da 600 km) e una recensione negativa per noi. La domanda «quanto
-- puoi allontanarti» ha una risposta che dipende dal LAVORO, non dalla persona,
-- esattamente come l'unità di misura: perciò vive sul catalogo.
--
-- COME SONO STATI ASSEGNATI
-- - provincia: il mestiere richiede di essere fisicamente sul posto con
--   attrezzatura, e il cliente cerca vicino (idraulico, elettricista,
--   imbianchino, serramentista, giardiniere, pulizie, tuttofare).
-- - città: servizi di persona ricorrenti, dove spostarsi ogni volta non regge
--   (personal trainer, ripetizioni) — entrambi però possono lavorare online.
-- - nazionale: il lavoro si sposta con chi lo fa, ed è normale prenotarlo da
--   lontano (fotografo, musica e intrattenimento, traslochi).
-- - nazionale + a distanza: non serve nessuno spostamento (grafica, sviluppo
--   web, supporto informatico).
--
-- Sono valori di partenza, non verità: si cambiano con un update quando
-- l'esperienza dirà altro. Fino a che non esiste una schermata in admin,
-- questo file è l'unico posto dove stanno.
--
-- Idempotente: update per slug.

update public.services set max_coverage_scope = 'province', remote_possible = false
 where slug in ('idraulico', 'elettricista', 'imbianchino', 'serramentista',
                'giardiniere', 'pulizie', 'tuttofare');

update public.services set max_coverage_scope = 'city', remote_possible = true
 where slug in ('personal-trainer', 'ripetizioni');

update public.services set max_coverage_scope = 'national', remote_possible = false
 where slug in ('fotografo', 'musica-intrattenimento', 'traslochi');

update public.services set max_coverage_scope = 'national', remote_possible = true
 where slug in ('grafica-logo', 'sviluppo-web', 'supporto-informatico');
