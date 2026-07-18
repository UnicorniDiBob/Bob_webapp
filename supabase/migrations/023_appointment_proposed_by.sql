-- 023: chi ha proposto l'appuntamento.
-- Perché: il cliente ora può contro-proporre un orario (tra gli slot liberi
-- del pro): serve distinguere le proposte del pro (conferma il cliente)
-- da quelle del cliente (conferma il pro dal suo calendario).
-- Idempotente: add column if not exists + drop/add constraint.

alter table public.appointments
  add column if not exists proposed_by text not null default 'professional';

alter table public.appointments
  drop constraint if exists appointments_proposed_by_check;
alter table public.appointments
  add constraint appointments_proposed_by_check
  check (proposed_by in ('professional', 'customer'));
