-- 117_disdette_prima_della_113.sql
--
-- LE PRENOTAZIONI DIRETTE DISDETTE PRIMA DELLA 113 SI CHIUDONO (07/10, Lucio).
--
-- IL RILIEVO DEL 3 OTTOBRE. Una prenotazione diretta disdetta restava fra i
-- «Lavori in corso» del cliente, con «Segna come concluso»: la disdetta
-- portava l'appuntamento a 'cancelled' e non toccava la richiesta, che
-- restava 'matched' (CustomerHome la tiene aperta finche' e' in
-- OPEN_STATUSES).
--
-- DALLA 113 NON SUCCEDE PIU'. annulla_appuntamento(), l'unica strada per
-- annullare un appuntamento confermato con un cliente, chiude la richiesta
-- di una prenotazione diretta (quote_mode 'bookable') come «disdetto»:
-- niente lavoro in corso, niente invito a recensire, e la policy delle
-- recensioni lo rifiuta. Lo prova la P4 di prova_113_prenotazione_regole.sql.
--
-- RESTAVANO LE RIGHE DI PRIMA. Al 07/10 in produzione due richieste:
--   302b5e12-… (3/10, la prenotazione di prova del rilievo): ancora
--     'matched', l'appuntamento annullato -> resta in «Lavori in corso»;
--   ade54225-… (29/7): chiusa dal cliente ma senza closed_reason -> la
--     policy delle recensioni la lascerebbe recensire.
-- Nessuna delle due ha una recensione.
--
-- LA REGOLA DEL RECUPERO, la stessa della 113 applicata a posteriori: una
-- richiesta di prenotazione diretta che ha almeno un appuntamento annullato
-- e nessuno attivo o concluso, e che nessuno ha recensito, e' una
-- prenotazione disdetta: si chiude come «disdetto». Una richiesta con una
-- recensione resta com'e': non si toglie a posteriori una recensione
-- lasciata quando era permessa.
--
-- Nessuna funzione e nessuno schema cambiano: e' un aggiornamento di dati.
-- Gira come il proprietario (auth.uid() nullo): proteggi_chiusura_richiesta
-- (113) lo lascia passare, come per il service role.
--
-- Idempotente: la seconda volta non trova piu' righe.

begin;

update public.requests r
   set status = 'closed',
       closed_reason = 'disdetto'
 where r.quote_mode = 'bookable'
   and (r.status <> 'closed' or r.closed_reason is null)
   and exists (
     select 1 from public.appointments a
      where a.request_id = r.id and a.status = 'cancelled'
   )
   and not exists (
     select 1 from public.appointments a
      where a.request_id = r.id and a.status in ('confirmed', 'proposed', 'completed')
   )
   and not exists (
     select 1 from public.ratings x where x.request_id = r.id
   );

commit;
