-- 079 — Ricontrollo: la coda di chi era verificato e va riguardato
--
-- PERCHE' UNA CODA A PARTE. La coda di oggi (`vat_review_state = 'pending'`)
-- e' fatta di prime richieste: gente che aspetta il badge e nel frattempo non
-- ce l'ha. Chi finisce qui e' l'opposto: il badge ce l'ha, ed e' il badge che
-- va rimesso in discussione — perche' l'anno e' scaduto (078) o perche' un
-- controllo ha trovato qualcosa. Mescolarli significa due cose diverse nella
-- stessa lista, con urgenze opposte: chi aspetta viene dopo chi e' gia'
-- dentro. Quindi uno stato suo, `recheck`, e una sezione sua in admin.
--
-- IL MOTIVO E' UN DATO, NON UNA FRASE. `recheck_reason` dice PERCHE' la riga
-- e' li': scadenza annuale, cessazione rilevata, procedura concorsuale nella
-- denominazione, intestazione che non torna. Serve a tre cose: ordinare la
-- coda (una cessazione non aspetta una scadenza), scrivere al professionista
-- la frase giusta, e — Regolamento P2B art. 4 — poter motivare per iscritto
-- una eventuale restrizione, che con un booleano non si motiva.
--
-- QUI NON SI DECLASSA NESSUNO. La riga entra in ricontrollo con il livello
-- INTATTO: toglierlo e' una decisione umana (art. 22 GDPR), e la macchina che
-- apre il caso non e' quella che lo chiude. L'unica caduta automatica prevista
-- e' quella della scadenza, che e' una regola dichiarata e preavvisata (078),
-- non un giudizio su una persona.
--
-- Idempotente: add column if not exists, drop-then-create del vincolo.

begin;

alter table public.professional_verification
  add column if not exists recheck_reason text,
  add column if not exists recheck_opened_at timestamptz;

comment on column public.professional_verification.recheck_reason is
  'Perche'' questa verifica e'' in ricontrollo: scadenza | cessazione | procedura | intestazione. Null quando non e'' in ricontrollo.';

comment on column public.professional_verification.recheck_opened_at is
  'Quando la riga e'' entrata in ricontrollo. E'' anche il tempo di attesa della coda: senza, l''SLA del ricontrollo non lo misura nessuno.';

-- Lo stato nuovo accanto ai tre che c'erano (038).
alter table public.professional_verification
  drop constraint if exists professional_verification_review_state_check;

alter table public.professional_verification
  add constraint professional_verification_review_state_check
  check (vat_review_state is null
         or vat_review_state in ('pending', 'docs_requested', 'rejected', 'recheck'));

comment on column public.professional_verification.vat_review_state is
  'null = niente in sospeso. pending = in coda per l''esame umano (prima richiesta). docs_requested = chiesti documenti al pro. rejected = respinto con motivazione (sempre umano, mai automatico). recheck = era verificato e va riguardato: il motivo sta in recheck_reason e il livello resta invariato finche'' non decide una persona.';

-- La coda del ricontrollo si apre per motivo e per anzianita'.
create index if not exists professional_verification_recheck_idx
  on public.professional_verification (recheck_opened_at)
  where vat_review_state = 'recheck';

commit;
