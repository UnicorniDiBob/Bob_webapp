-- 041: ragione sociale dichiarata dal professionista.
--
-- Perché serve: il confronto sull'intestazione oggi usa profiles.full_name, che
-- spesso è il nome con cui il professionista si è registrato — a volte il suo
-- nome e cognome, a volte un nome commerciale, a volte un soprannome. Se lavora
-- come società, il registro restituirà la ragione sociale e nessuna delle due
-- cose combacerà, e il caso finisce a mano anche quando è tutto regolare.
-- Chiedendoglielo direttamente togliamo di mezzo una fetta di lavoro inutile.
--
-- Limite da tenere a mente, ed è il motivo per cui questo campo NON basta a
-- concedere il livello in automatico: è un testo che scrive lui. Uno potrebbe
-- copiarci dentro la denominazione dell'azienda di cui ha rubato la partita
-- IVA. Serve a far decidere in fretta una persona, non a sostituirla.
--
-- Idempotente.

alter table public.professional_verification
  add column if not exists declared_business_name text;

comment on column public.professional_verification.declared_business_name is
  'Ragione sociale dichiarata dal professionista, usata come secondo termine di confronto con l''intestazione del registro. Dato autodichiarato: non concede il livello da solo.';
