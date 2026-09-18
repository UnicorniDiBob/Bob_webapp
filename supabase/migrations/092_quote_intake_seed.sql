-- 092_quote_intake_seed.sql
--
-- Popola quote_level e quote_fields (091, stesso PR) per i sotto-servizi
-- canonici dei cinque servizi core, spec §4, piu' il fallback generico a tre
-- campi per gli altri dieci servizi, spec §4 fine sezione. Idraulico ed
-- elettricista portano ciascuno un sotto-servizio "pre-check" (emergenza):
-- resta a quote_level='survey' con quote_fields vuoto, il default della 091
-- — un'emergenza non e' un livello del catalogo da dichiarare, e' un bypass
-- che il risolutore applica per conto suo (Fase 2) leggendo red_flags e
-- urgency, non un fatto che sta scritto qui.
--
-- SOSTITUZIONE-RUBINETTERIA NON ERA IN SPEC §4: la spec la trattava come
-- doppione di perdita-rubinetto-sifone quando e' stata scritta. La 090 l'ha
-- corretto — resta un sotto-servizio canonico a se' — e da qui in avanti
-- gli serve un proprio set di campi, non il default vuoto che lascerebbe un
-- lavoro preventivabile per sempre a "survey". Il set sotto e' costruito
-- per analogia con wc-sanitari (stesso livello, stessa forma di domanda:
-- cosa, quanti pezzi, pezzo gia' comprato, smontaggio del vecchio) — non
-- viene dalla spec, va confermato editorialmente come gli altri.
--
-- NESSUN DATO ART. 9 IN QUESTA SEMINA. Il fallback generico per gli altri
-- dieci servizi (what_exactly, quantity, deadline) non porta un campo
-- "goal" ne' nessun campo di salute: l'avvertimento della spec §10 su
-- personal-trainer riguarda un campo che non esiste ancora in questa
-- migrazione, non uno che c'e'.
--
-- Idempotente: ogni update e' per slug, valori statici, nessuno stato da
-- rileggere — rieseguirla scrive di nuovo lo stesso risultato, mai un
-- risultato diverso.

begin;

-- ---------------------------------------------------------------------------
-- idraulico
-- ---------------------------------------------------------------------------
update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"fixture","type":"select","label":"Cosa perde?","required":true,
   "options":["rubinetto","sifone sotto il lavello","doccia","wc","non lo so"],
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto di dove esce l''acqua."},
  {"key":"leak_active","type":"bool","label":"L''acqua esce adesso?","required":true,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"water_shutoff_done","type":"bool","label":"Hai chiuso il rubinetto generale?",
   "required":false,"ask_if":{"leak_active":true},"is_billable_unit":false,
   "pro_visible":true,"unknown_ok":true},
  {"key":"part_purchased","type":"bool","label":"Hai gia'' comprato il pezzo di ricambio?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"floor","type":"number","label":"A che piano?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "proxy":{"label":"Piano","type":"select","options":["terra","1-3","4 o piu''"],
            "derive":{"terra":0,"1-3":2,"4 o piu''":5}}}
]'::jsonb where slug = 'perdita-rubinetto-sifone';

update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"drain_location","type":"select","label":"Quale scarico e'' otturato?",
   "options":["lavandino cucina","lavandino bagno","doccia o vasca","wc","non lo so"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto dello scarico che non scende."},
  {"key":"standing_water","type":"bool","label":"C''e'' acqua ferma che non scende?",
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"tried_products","type":"bool","label":"Hai gia'' provato prodotti sturatubi?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"floor","type":"number","label":"A che piano?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "proxy":{"label":"Piano","type":"select","options":["terra","1-3","4 o piu''"],
            "derive":{"terra":0,"1-3":2,"4 o piu''":5}}}
]'::jsonb where slug = 'scarico-otturato';

update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"intervento","type":"select","label":"Cosa devo fare?",
   "options":["sostituzione","installazione nuova","riparazione"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"item_count","type":"number","label":"Quanti sanitari?","required":false,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"part_purchased","type":"bool","label":"Hai gia'' comprato il sanitario nuovo?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"removal_needed","type":"bool","label":"Serve smontare e smaltire il vecchio?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'wc-sanitari';

update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"intervento","type":"select","label":"Cosa devo fare?",
   "options":["manutenzione","riparazione guasto","sostituzione"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"boiler_model","type":"text","label":"Marca e modello della caldaia","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Apri lo sportello della caldaia e fotografa la targhetta: c''e'' marca e modello, e a me basta quella."},
  {"key":"boiler_age","type":"number","label":"Quanti anni ha la caldaia, circa?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"last_service","type":"text","label":"Quando ha fatto l''ultima manutenzione?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"fuel","type":"select","label":"Alimentazione","options":["gas","elettrica","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'caldaia-scaldabagno';

update public.subservices set quote_level = 'range', quote_fields = '[
  {"key":"appliance","type":"select","label":"Quale elettrodomestico?",
   "options":["lavatrice","lavastoviglie","forno","piano cottura","altro"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"connection_exists","type":"bool","label":"L''attacco esiste gia''?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"item_count","type":"number","label":"Quanti apparecchi?","required":false,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'allaccio-elettrodomestici';

update public.subservices set quote_level = 'survey', quote_fields = '[
  {"key":"where_visible","type":"select","label":"Dove si vede il problema?",
   "options":["soffitto","parete","pavimento","non si vede, solo umidita''"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto della macchia o dell''infiltrazione."},
  {"key":"neighbour_involved","type":"bool","label":"Potrebbe venire dal vicino o da un piano sopra?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"damage_extent","type":"select","label":"Quanto e'' estesa?",
   "options":["piccola macchia","una parete intera","piu'' stanze"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'perdita-tubatura-infiltrazione';

update public.subservices set quote_level = 'survey', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri e'' il bagno?",
   "required":false,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true,
   "proxy":{"label":"Non li so — che tipo di bagno e''?","type":"select",
            "options":["piccolo (doccia)","medio (vasca o doccia + bidet)","grande (vasca e doccia)"],
            "derive":{"piccolo (doccia)":4,"medio (vasca o doccia + bidet)":6,"grande (vasca e doccia)":9}}},
  {"key":"demolition_needed","type":"bool","label":"Serve demolire piastrelle o muri esistenti?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"sanitari_included","type":"bool","label":"Vuoi cambiare anche i sanitari?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'rifacimento-impianto-bagno';

-- Non in spec §4 (090 l'ha tolto dai doppioni dopo che la spec era scritta,
-- vedi header). Set costruito per analogia con wc-sanitari.
update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"fixture_type","type":"select","label":"Cosa vuoi sostituire?",
   "options":["rubinetto cucina","rubinetto bagno","miscelatore doccia","non lo so"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto del rubinetto o miscelatore da cambiare."},
  {"key":"item_count","type":"number","label":"Quanti pezzi?","required":false,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"part_purchased","type":"bool","label":"Hai gia'' comprato il pezzo nuovo?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"removal_needed","type":"bool","label":"Serve smontare e smaltire il vecchio?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'sostituzione-rubinetteria';

-- emergenza-allagamento: pre-check, resta al default 'survey' / '[]'::jsonb.

-- ---------------------------------------------------------------------------
-- elettricista
-- ---------------------------------------------------------------------------
update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"item_count","type":"number","label":"Quante prese o interruttori?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":false},
  {"key":"installation_type","type":"select","label":"L''impianto e'' sotto traccia o esterno?",
   "options":["sotto traccia (incassato)","esterno (a vista, canalina)","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto della presa o dell''interruttore e della parete intorno."},
  {"key":"power_available","type":"bool","label":"C''e'' gia'' corrente in quel punto?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"wall_type","type":"select","label":"Che tipo di parete?",
   "options":["cartongesso","muratura","cemento","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'presa-interruttore';

update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"item_count","type":"number","label":"Quanti punti luce?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":false},
  {"key":"point_exists","type":"bool","label":"C''e'' gia'' un punto luce li'', o va creato da zero?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"ceiling_height","type":"select","label":"Soffitto normale o molto alto?",
   "options":["normale","alto (serve trabattello)","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"fixture_purchased","type":"bool","label":"Hai gia'' comprato la plafoniera o il lampadario?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'punto-luce-lampadario';

update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"intervento","type":"select","label":"Cosa devo fare?",
   "options":["riparazione","sostituzione","installazione nuova"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"existing_brand","type":"text","label":"Marca del citofono attuale, se lo sai",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto della pulsantiera esterna e del citofono interno."},
  {"key":"units_count","type":"number","label":"Quante postazioni interne?","required":false,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'citofono-videocitofono';

update public.subservices set quote_level = 'survey', quote_fields = '[
  {"key":"frequency","type":"select","label":"Con che frequenza scatta?",
   "options":["una volta sola","qualche volta a settimana","tutti i giorni"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"power_available","type":"bool","label":"Adesso c''e'' corrente in casa?",
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"when_started","type":"text","label":"Da quando succede?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'corto-salvavita-scatta';

update public.subservices set quote_level = 'survey', quote_fields = '[
  {"key":"intervento","type":"select","label":"Cosa devo fare?",
   "options":["sostituzione quadro","aggiunta linee","adeguamento"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"panel_age","type":"number","label":"Quanti anni ha il quadro, circa?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto del quadro elettrico aperto."},
  {"key":"certification_needed","type":"bool","label":"Ti serve la dichiarazione di conformita''?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'quadro-elettrico';

update public.subservices set quote_level = 'survey', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri?","required":false,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true,
   "proxy":{"label":"Non li so — quante stanze?","type":"select",
            "options":["monolocale","bilocale","trilocale","quattro locali o piu''"],
            "derive":{"monolocale":40,"bilocale":60,"trilocale":85,"quattro locali o piu''":115}}},
  {"key":"rooms","type":"number","label":"Numero di stanze","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"certification_needed","type":"bool","label":"Ti serve la dichiarazione di conformita''?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'impianto-nuovo-rifacimento';

update public.subservices set quote_level = 'survey', quote_fields = '[
  {"key":"purpose","type":"select","label":"A cosa ti serve?",
   "options":["vendita o affitto immobile","controllo di sicurezza","obbligo per attivita'' commerciale","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri?","required":false,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true,
   "proxy":{"label":"Non li so — quante stanze?","type":"select",
            "options":["monolocale","bilocale","trilocale","quattro locali o piu''"],
            "derive":{"monolocale":40,"bilocale":60,"trilocale":85,"quattro locali o piu''":115}}},
  {"key":"has_old_docs","type":"bool","label":"Hai documenti di un impianto precedente?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'messa-a-norma-certificazione';

-- emergenza-senza-corrente: pre-check, resta al default 'survey' / '[]'::jsonb.

-- ---------------------------------------------------------------------------
-- imbianchino
-- ---------------------------------------------------------------------------
update public.subservices set quote_level = 'range', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri da tinteggiare?",
   "required":true,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true,
   "proxy":{"label":"Non li so — quante stanze?","type":"select",
            "options":["monolocale","bilocale","trilocale","quattro locali o piu''"],
            "derive":{"monolocale":40,"bilocale":60,"trilocale":85,"quattro locali o piu''":115}}},
  {"key":"ceiling_included","type":"bool","label":"Anche il soffitto?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"mold_present","type":"bool","label":"Ci sono macchie di muffa?","required":true,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":false,
   "photo_prompt":"Fammi una foto delle macchie, se ci sono."},
  {"key":"furniture_to_move","type":"bool","label":"C''e'' mobilio da spostare o coprire?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"dark_to_light","type":"bool","label":"Passi da un colore scuro a uno chiaro?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"ceiling_height","type":"select","label":"Soffitti normali o molto alti?",
   "options":["normali","alti (serve trabattello)","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'tinteggiatura-interni';

update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"item_count","type":"number","label":"Quanti infissi o ringhiere?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":false},
  {"key":"material","type":"select","label":"Che materiale?",
   "options":["legno","ferro","alluminio","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto di quello che devo verniciare."},
  {"key":"current_state","type":"select","label":"Come sono messi adesso?",
   "options":["solo da rinfrescare","ruggine o vernice che si stacca","da carteggiare a fondo"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'verniciatura-infissi-ringhiere';

update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"intervento","type":"select","label":"Cosa devo fare?",
   "options":["contropareti","controsoffitto","nicchie o velette","riparazione"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri, circa?",
   "required":false,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"insulation_needed","type":"bool","label":"Serve isolamento termico o acustico?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'cartongesso';

update public.subservices set quote_level = 'survey', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri, circa?",
   "required":false,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"technique","type":"text","label":"Che effetto vuoi (se lo sai gia'')?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"reference_photo","type":"bool","label":"Hai una foto di riferimento dell''effetto che vuoi?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Mandami una foto di un effetto simile a quello che immagini."}
]'::jsonb where slug = 'effetti-decorativi-stucchi';

update public.subservices set quote_level = 'survey', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanto e'' estesa la muffa, circa?",
   "required":false,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto della muffa."},
  {"key":"cause_known","type":"select","label":"Sai da cosa dipende?",
   "options":["condensa / poco ricambio d''aria","infiltrazione","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"recurring","type":"bool","label":"E'' gia'' tornata dopo un trattamento precedente?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'trattamento-muffa';

update public.subservices set quote_level = 'survey', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri di facciata, circa?",
   "required":false,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"floors","type":"number","label":"Quanti piani e'' il palazzo?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"scaffolding_access","type":"bool","label":"Ci sono vincoli condominiali per un ponteggio?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'tinteggiatura-esterni-facciata';

-- ---------------------------------------------------------------------------
-- pulizie
-- ---------------------------------------------------------------------------
update public.subservices set quote_level = 'bookable', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri?","required":true,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "proxy":{"label":"Non li so — quante stanze?","type":"select",
            "options":["monolocale","bilocale","trilocale","quattro locali o piu''"],
            "derive":{"monolocale":40,"bilocale":60,"trilocale":85,"quattro locali o piu''":115}}},
  {"key":"frequency","type":"select","label":"Con che frequenza?",
   "options":["settimanale","bisettimanale","mensile"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"hours_estimate","type":"number","unit":"ore","label":"Quante ore stimi ti servano?",
   "required":false,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"materials_provided","type":"bool","label":"Fornisci tu i prodotti per la pulizia?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"has_pets","type":"bool","label":"Ci sono animali in casa?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'ordinarie-ricorrenti';

update public.subservices set quote_level = 'range', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true,
   "proxy":{"label":"Non li so — quante stanze?","type":"select",
            "options":["monolocale","bilocale","trilocale","quattro locali o piu''"],
            "derive":{"monolocale":40,"bilocale":60,"trilocale":85,"quattro locali o piu''":115}}},
  {"key":"last_deep_clean","type":"text","label":"Quando e'' stata fatta l''ultima pulizia a fondo?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"materials_provided","type":"bool","label":"Fornisci tu i prodotti per la pulizia?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"has_pets","type":"bool","label":"Ci sono animali in casa?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'profonda-una-tantum';

update public.subservices set quote_level = 'range', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true,
   "proxy":{"label":"Non li so — quante stanze?","type":"select",
            "options":["monolocale","bilocale","trilocale","quattro locali o piu''"],
            "derive":{"monolocale":40,"bilocale":60,"trilocale":85,"quattro locali o piu''":115}}},
  {"key":"empty_property","type":"bool","label":"La casa e'' gia'' vuota di mobili?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"oven_included","type":"bool","label":"Serve pulire anche forno e frigo a fondo?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"deadline","type":"text","label":"Entro quando ti serve?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'fine-locazione-trasloco';

update public.subservices set quote_level = 'range', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"frequency","type":"select","label":"Con che frequenza?",
   "options":["giornaliera","settimanale","bisettimanale","una tantum"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"after_hours","type":"bool","label":"Deve essere fuori orario di apertura?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"wc_count","type":"number","label":"Quanti bagni ci sono?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'uffici-negozi';

update public.subservices set quote_level = 'range', quote_fields = '[
  {"key":"window_count","type":"number","label":"Quante finestre o vetrate?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":false},
  {"key":"both_sides","type":"bool","label":"Anche il lato esterno?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"height_access","type":"bool","label":"Servono attrezzature per l''altezza (piani alti)?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'vetri-vetrate';

update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"debris_present","type":"bool","label":"Ci sono ancora macerie o detriti grossi?",
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false,
   "photo_prompt":"Fammi una foto di com''e'' adesso la stanza."},
  {"key":"paint_residue","type":"bool","label":"Ci sono residui di vernice o silicone sui pavimenti?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"disposal_needed","type":"bool","label":"Serve anche smaltire i rifiuti?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'post-ristrutturazione';

update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"mq_approx","type":"number","unit":"m2","label":"Quanti metri quadri?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"purpose","type":"select","label":"Perche'' ti serve?",
   "options":["dopo una malattia in casa","obbligo per attivita'' commerciale","precauzione","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"certificate_needed","type":"bool","label":"Ti serve un certificato di sanificazione?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'sanificazione';

-- ---------------------------------------------------------------------------
-- tuttofare
-- ---------------------------------------------------------------------------
update public.subservices set quote_level = 'bookable', quote_fields = '[
  {"key":"item_count","type":"number","label":"Quanti mobili?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":false},
  {"key":"furniture_type","type":"text","label":"Che tipo di mobili (armadio, letto, cucina...)?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto della scatola o del foglio istruzioni."},
  {"key":"has_instructions","type":"bool","label":"Hai le istruzioni di montaggio?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"packaging_disposal","type":"bool","label":"Serve smaltire anche gli imballaggi?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'montaggio-mobili';

update public.subservices set quote_level = 'bookable', quote_fields = '[
  {"key":"item_count","type":"number","label":"Quanti pezzi da appendere?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":false},
  {"key":"wall_type","type":"select","label":"Che tipo di parete?",
   "options":["cartongesso","muratura","cemento","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"materials_provided","type":"bool","label":"Hai gia'' viti, tasselli o bastoni?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'mensole-quadri-tende';

update public.subservices set quote_level = 'bookable', quote_fields = '[
  {"key":"item_count","type":"number","label":"Quanti metri o punti da trattare, circa?",
   "required":true,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"removal_needed","type":"bool","label":"Serve rimuovere il silicone vecchio?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto del silicone o della guarnizione da sistemare."}
]'::jsonb where slug = 'silicone-guarnizioni';

update public.subservices set quote_level = 'range', quote_fields = '[
  {"key":"task_list","type":"text","label":"Cosa c''e'' da sistemare?","required":true,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"item_count","type":"number","label":"Quante cose in tutto?","required":false,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"materials_provided","type":"bool","label":"Hai gia'' il materiale necessario?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'piccole-riparazioni';

update public.subservices set quote_level = 'range', quote_fields = '[
  {"key":"lock_type","type":"select","label":"Cosa devo fare alla serratura?",
   "options":["sostituzione","riparazione","duplicazione chiavi"],
   "required":true,"is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"locked_out","type":"bool","label":"Sei chiuso fuori casa adesso?","required":true,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"door_type","type":"select","label":"Che tipo di porta?",
   "options":["blindata","interna","portoncino esterno non blindato","non lo so"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]'::jsonb where slug = 'serrature-semplici';

update public.subservices set quote_level = 'assisted', quote_fields = '[
  {"key":"item_count","type":"number","label":"Quanti pezzi?","required":true,
   "is_billable_unit":true,"pro_visible":true,"unknown_ok":false},
  {"key":"measures_taken","type":"bool","label":"Hai gia'' le misure delle finestre?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"type","type":"select","label":"Zanzariera o tenda da sole?",
   "options":["zanzariera","tenda da sole"],
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"window_type","type":"text","label":"Che tipo di finestra o balcone?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto della finestra o del balcone."}
]'::jsonb where slug = 'zanzariere-tende-da-sole';

-- ---------------------------------------------------------------------------
-- Gli altri dieci servizi: fallback generico a tre campi, spec §4 fine
-- sezione. quote_level resta 'survey', gia' il default della 091 — scritto
-- comunque qui per esplicito, non per necessita'.
-- ---------------------------------------------------------------------------
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
  from public.services sv
 where sv.id = s.service_id
   and sv.slug in (
     'fotografo', 'giardiniere', 'grafica-logo', 'musica-intrattenimento',
     'personal-trainer', 'ripetizioni', 'serramentista', 'supporto-informatico',
     'sviluppo-web', 'traslochi'
   );

commit;
