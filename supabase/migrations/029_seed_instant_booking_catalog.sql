-- 029_seed_instant_booking_catalog.sql
-- Instant Booking — Phase 0 catalog seed. See docs/Bob_Instant_Booking_Spec.md §4, §8.
-- Idempotent: UPDATE-by-slug, safe to re-run.

begin;

update public.subservices set
  instant_book_eligible = true, default_rate_unit = 'hour',
  booking_fields = '[
    {"key":"ore","label":"Ore stimate","type":"number","unit":"ore","required":true,"is_billable_unit":true,"help":"Puoi stimarle in base alla dimensione della casa"},
    {"key":"mq_approx","label":"Metri quadri","type":"number","unit":"m2","required":true,"is_billable_unit":false},
    {"key":"rooms","label":"Numero di stanze","type":"number","required":false,"is_billable_unit":false},
    {"key":"frequency","label":"Frequenza","type":"select","required":false,"is_billable_unit":false,"options":["settimanale","bisettimanale","mensile"]},
    {"key":"has_pets","label":"Animali in casa","type":"bool","required":false,"is_billable_unit":false}
  ]'::jsonb
where slug = 'ordinarie-ricorrenti';

update public.subservices set
  instant_book_eligible = true, default_rate_unit = 'hour',
  booking_fields = '[
    {"key":"ore","label":"Ore stimate","type":"number","unit":"ore","required":true,"is_billable_unit":true},
    {"key":"mq_approx","label":"Metri quadri","type":"number","unit":"m2","required":true,"is_billable_unit":false},
    {"key":"rooms","label":"Numero di stanze","type":"number","required":false,"is_billable_unit":false},
    {"key":"has_pets","label":"Animali in casa","type":"bool","required":false,"is_billable_unit":false}
  ]'::jsonb
where slug in ('profonda-una-tantum','pulizie-appartamenti','fine-locazione-trasloco');

update public.subservices set
  instant_book_eligible = true, default_rate_unit = 'hour',
  booking_fields = '[
    {"key":"ore","label":"Ore stimate","type":"number","unit":"ore","required":true,"is_billable_unit":true},
    {"key":"mq_approx","label":"Metri quadri","type":"number","unit":"m2","required":true,"is_billable_unit":false}
  ]'::jsonb
where slug in ('uffici-negozi','pulizie-uffici-piccoli');

update public.subservices set
  instant_book_eligible = true, default_rate_unit = 'hour',
  booking_fields = '[
    {"key":"ore","label":"Ore stimate","type":"number","unit":"ore","required":true,"is_billable_unit":true},
    {"key":"windows_count","label":"Numero di finestre/vetrate","type":"number","required":false,"is_billable_unit":false}
  ]'::jsonb
where slug = 'vetri-vetrate';

update public.subservices set
  instant_book_eligible = true, default_rate_unit = 'hour',
  booking_fields = '[
    {"key":"ore","label":"Ore stimate","type":"number","unit":"ore","required":true,"is_billable_unit":true},
    {"key":"items_count","label":"Numero di pezzi/elementi","type":"number","required":false,"is_billable_unit":false},
    {"key":"materials_provided","label":"Materiali forniti dal cliente","type":"bool","required":false,"is_billable_unit":false}
  ]'::jsonb
where slug in ('montaggio-mobili','mensole-quadri-tende');

update public.subservices set
  instant_book_eligible = true, default_rate_unit = 'hour',
  booking_fields = '[
    {"key":"ore","label":"Ore stimate","type":"number","unit":"ore","required":true,"is_billable_unit":true},
    {"key":"note","label":"Descrizione dell''intervento","type":"text","required":false,"is_billable_unit":false}
  ]'::jsonb
where slug in ('piccole-riparazioni','silicone-guarnizioni','serrature-semplici');

update public.subservices set
  instant_book_eligible = true, default_rate_unit = 'hour',
  booking_fields = '[
    {"key":"ore","label":"Ore di lezione","type":"number","unit":"ore","required":true,"is_billable_unit":true},
    {"key":"mode","label":"Modalità","type":"select","required":true,"is_billable_unit":false,"options":["presenza","online"]},
    {"key":"student_level","label":"Livello dello studente","type":"select","required":false,"is_billable_unit":false,"options":["elementari","medie","superiori","universita","adulti"]}
  ]'::jsonb
where slug in ('matematica-fisica','lingue-straniere','materie-umanistiche','esami-universitari','informatica-programmazione','elementari-medie-doposcuola');

update public.subservices set
  instant_book_eligible = true, default_rate_unit = 'session',
  booking_fields = '[
    {"key":"sessions","label":"Numero di sessioni","type":"number","unit":"sessioni","required":true,"is_billable_unit":true},
    {"key":"mode","label":"Modalità","type":"select","required":false,"is_billable_unit":false,"options":["presenza","online"]},
    {"key":"goal","label":"Obiettivo","type":"select","required":false,"is_billable_unit":false,"options":["dimagrimento","massa-forza","preparazione","posturale","benessere"]}
  ]'::jsonb
where slug in ('coaching-online','allenamento-gruppo');

commit;
