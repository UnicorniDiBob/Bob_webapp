-- 040: firma della decisione e leggibilità del registro delle verifiche.
--
-- Il problema che risolve: oggi sappiamo CHE una decisione è stata presa e da
-- quale user_id, ma non CHI fosse quella persona nel momento in cui l'ha presa.
-- actor_user_id ha "on delete set null": il giorno in cui un collaboratore
-- lascia il team e il suo account viene cancellato, il registro perde il nome
-- proprio delle decisioni che quella persona ha firmato — cioè perde il valore
-- che lo rende una prova.
--
-- Da qui la scelta di conservare il NOME e il RUOLO come istantanea al momento
-- del fatto, accanto al riferimento all'account. È una denormalizzazione
-- voluta: un registro deve restare leggibile anche quando il mondo intorno
-- cambia, e deve dire cosa era vero allora, non cosa è vero adesso.
--
-- Nota sull'immutabilità: verification_events non ha policy di update o delete
-- per nessun ruolo applicativo. Si scrive solo in aggiunta, dal server. È la
-- proprietà che rende il registro utile come prova; non toglierla.
--
-- Idempotente.

alter table public.verification_events
  add column if not exists actor_name text,
  add column if not exists actor_role text;

comment on column public.verification_events.actor_name is
  'Nome di chi ha compiuto l''azione, fotografato al momento del fatto. Resta leggibile anche se l''account viene cancellato.';
comment on column public.verification_events.actor_role is
  'Ruolo al momento del fatto: admin, cs oppure professional (quando è il professionista stesso a chiedere la verifica).';

-- Stato corrente: chi ha firmato l'ultima decisione su questo professionista.
-- Serve a mostrarlo nella scheda senza andare a cercare nel registro.
alter table public.professional_verification
  add column if not exists vat_reviewed_by_name text;

comment on column public.professional_verification.vat_reviewed_by_name is
  'Nome di chi ha preso l''ultima decisione manuale. Istantanea, come sopra: il registro degli eventi resta la fonte completa.';

-- Il registro si consulta per professionista e in ordine di tempo: l'indice
-- della 029 copre già (professional_id, created_at desc). Qui aggiungiamo solo
-- la vista d'insieme "ultime decisioni prese", che è come lo guarda un admin.
create index if not exists verification_events_recent_idx
  on public.verification_events (created_at desc);
