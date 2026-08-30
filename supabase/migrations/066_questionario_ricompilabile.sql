-- 066: chi ricompila il questionario non resta bloccato per sempre.
--
-- IL BUG. onboarding_answers aveva una policy di INSERT e due di SELECT, e
-- NESSUNA policy di UPDATE. Il questionario di /onboarding/profilo scrive con
-- un upsert — «ricompilare non e' un errore», dice il commento dal 14/08 — ma
-- sulla riga che esiste gia' l'upsert diventa un UPDATE, e senza policy
-- Postgres risponde 42501: «new row violates row-level security policy (USING
-- expression)».
--
-- COSA PRODUCEVA. Le risposte sono il PRIMO passo del salvataggio; la riga
-- professionals nasce dopo. Quindi qualunque interruzione dopo il primo passo
-- — rete, tab chiusa, un errore piu' avanti — lasciava l'account con le
-- risposte scritte e senza profilo professionista, e ogni tentativo successivo
-- moriva sulla stessa riga: iscrizione impossibile, per sempre, su quell'account.
-- Verificato in produzione il 30/08 su sig.mozzato@gmail.com: risposte 1,
-- professionals 0, e la sequenza completa che passa non appena la riga delle
-- risposte non e' piu' li'.
--
-- NON SI VEDEVA perche' gli errori di PostgREST non sono istanze di Error: il
-- `catch` della pagina cadeva nel ramo «Errore imprevisto» e buttava via il
-- messaggio. Corretto nello stesso commit.
--
-- La policy e' la stessa forma delle altre due: ognuno tocca la propria riga.
-- Lo staff continua a leggere e basta — le risposte le scrive l'interessato.
--
-- Idempotente: drop-then-create.

drop policy if exists "User updates own answers" on public.onboarding_answers;
create policy "User updates own answers" on public.onboarding_answers
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
