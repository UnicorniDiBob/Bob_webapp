-- 073: IL FERMO PER MANUTENZIONE — quando Bob non deve essere raggiungibile.
--
-- PERCHE' NON BASTAVA LA 071.
-- La 071 ha dato allo staff un modo per DIRE una cosa a tutti. Un avviso pero'
-- e' solo un testo: se alle 3 di notte il sito deve stare fermo, l'avviso lo
-- annuncia e poi il sito resta su. Chi non l'ha letto continua a mandare
-- richieste, a prenotare, a scrivere in chat — e quelle richieste arrivano
-- dentro una finestra in cui nessuno le sta guardando. Il danno non e' il
-- disservizio: e' la comunicazione mancata, la persona che ha scritto e non ha
-- capito perche' non risponde nessuno.
--
-- Quindi la finestra di manutenzione e' una RIGA, non una frase: la stessa
-- riga che l'interfaccia mostra come preavviso e che il middleware usa per
-- chiudere la porta. Una sola verita', dichiarata una volta sola.
--
-- QUATTRO DECISIONI CHE STANNO QUI DENTRO.
--
-- 1. OGNI FERMO HA UNA FINE, E LA FINE STA NEL DATABASE. `fine_il` e'
--    obbligatoria e la durata massima e' 24 ore. Un interruttore «spegni» che
--    non si riaccende da solo e' il modo in cui un sito resta chiuso un giorno
--    in piu' perche' nessuno si e' ricordato di riaprirlo. Si puo' sempre
--    riaprire prima (si sposta `fine_il` a ora, come «spegni adesso» degli
--    avvisi) e si puo' sempre prolungare: quello che non si puo' fare e'
--    dimenticarselo acceso.
--
-- 2. IL TESTO E' PUBBLICO, E VA SAPUTO SCRIVENDOLO. `motivo` e `dettaglio`
--    finiscono sulla pagina che vede CHIUNQUE, anche chi non e' registrato e
--    anche i motori di ricerca: e' il senso della cosa — una porta chiusa
--    senza un cartello sopra e' un guasto, non una manutenzione. Per questo la
--    policy di lettura arriva fino ad `anon`, al contrario della 071 che si
--    ferma ad `authenticated`. Non ci si scrive niente di interno.
--
-- 3. UNA FINESTRA ALLA VOLTA. Il vincolo di esclusione rifiuta due finestre
--    sovrapposte. Due manutenzioni contemporanee vorrebbero dire due cartelli
--    diversi sulla stessa porta, e il middleware ne mostrerebbe uno a caso.
--    Le finestre annullate non contano (`where annullata_il is null`).
--
-- 4. IL PREAVVISO E' UN AVVISO DELLA 071, NON UNA COPIA. `avviso_id` punta
--    alla riga che il pannello crea insieme alla finestra: cosi' il preavviso
--    usa la finestra-popup che gia' esiste, si spegne da solo quando il fermo
--    comincia, e non c'e' un secondo posto dove scrivere la stessa frase.
--    `on delete set null`: cancellato l'avviso, la manutenzione resta.
--
-- DATI PERSONALI: nessuno degli utenti. L'unico e' `creato_da`, personale
-- dello staff, per sapere chi ha chiuso il sito e quando — `on delete set
-- null` come per gli avvisi. Conservazione: 24 mesi dopo `fine_il`, stessa
-- ragione della 071 (e' la prova di cosa e' successo e quando l'abbiamo
-- detto). Nessun job automatico: sono pochi e si cancellano a mano.
--
-- Idempotente: if not exists ovunque, drop-then-create per vincoli e policy.

begin;

create table if not exists public.manutenzioni (
  id uuid primary key default gen_random_uuid(),
  motivo text not null,
  dettaglio text,
  inizio_il timestamptz not null,
  fine_il timestamptz not null,
  immediata boolean not null default false,
  annullata_il timestamptz,
  avviso_id uuid references public.avvisi_servizio(id) on delete set null,
  creato_da uuid references public.users(id) on delete set null,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Un cartello vuoto e' peggio di nessun cartello: chi trova la porta chiusa
-- senza sapere perche' pensa che sia rotto.
alter table public.manutenzioni
  drop constraint if exists manutenzioni_motivo_check;
alter table public.manutenzioni
  add constraint manutenzioni_motivo_check
  check (char_length(btrim(motivo)) between 10 and 300);

alter table public.manutenzioni
  drop constraint if exists manutenzioni_dettaglio_check;
alter table public.manutenzioni
  add constraint manutenzioni_dettaglio_check
  check (dettaglio is null or char_length(btrim(dettaglio)) between 3 and 2000);

-- La finestra: mai al contrario, mai di durata zero, mai piu' di 24 ore.
-- Il tetto non e' un capriccio: e' il punto 1 qui sopra reso impossibile da
-- aggirare per distrazione. Una manutenzione piu' lunga di un giorno si
-- prolunga a mano, e prolungarla e' un gesto che qualcuno compie.
alter table public.manutenzioni
  drop constraint if exists manutenzioni_finestra_check;
alter table public.manutenzioni
  add constraint manutenzioni_finestra_check
  check (fine_il > inizio_il and fine_il <= inizio_il + interval '24 hours');

-- Una porta, un cartello. Il range e' semiaperto: una finestra riaperta in
-- anticipo (fine_il spostata a ora) diventa vuota e non ostacola la prossima.
alter table public.manutenzioni
  drop constraint if exists manutenzioni_niente_sovrapposte;
alter table public.manutenzioni
  add constraint manutenzioni_niente_sovrapposte
  exclude using gist (tstzrange(inizio_il, fine_il, '[)') with &&)
  where (annullata_il is null);

create index if not exists idx_manutenzioni_finestra
  on public.manutenzioni (inizio_il, fine_il);

alter table public.manutenzioni enable row level security;

-- LETTURA FINO AD ANON, e con un filtro solo sul passato. Il middleware
-- interroga questa tabella con la chiave pubblica su ogni richiesta: deve
-- vedere il fermo in corso senza sessione, altrimenti la porta non si chiude
-- per nessuno. Vede anche le finestre future, che e' quello che serve alla
-- fascia di preavviso. Le finestre finite e quelle annullate no: non sono
-- nascoste, sono irraggiungibili — stessa regola della 071.
drop policy if exists "Legge le manutenzioni in corso o previste" on public.manutenzioni;
create policy "Legge le manutenzioni in corso o previste" on public.manutenzioni
  for select to anon, authenticated
  using (
    (select private.is_admin_or_cs())
    or (annullata_il is null and fine_il > now())
  );

-- Scrive solo l'admin. Il cs legge — deve sapere perche' il sito e' fermo
-- mentre risponde a chi chiede — ma chiudere Bob a tutti e' un gesto con un
-- nome sopra, come pubblicare un avviso.
drop policy if exists "Admin crea manutenzioni" on public.manutenzioni;
create policy "Admin crea manutenzioni" on public.manutenzioni
  for insert to authenticated
  with check ((select private.is_admin()));

drop policy if exists "Admin modifica manutenzioni" on public.manutenzioni;
create policy "Admin modifica manutenzioni" on public.manutenzioni
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Admin cancella manutenzioni" on public.manutenzioni;
create policy "Admin cancella manutenzioni" on public.manutenzioni
  for delete to authenticated
  using ((select private.is_admin()));

comment on table public.manutenzioni is
  'Finestre in cui Bob non e'' raggiungibile. Il middleware legge questa tabella con la chiave pubblica e risponde 503 a chi non e'' staff. Nessun dato personale degli utenti; motivo e dettaglio sono PUBBLICI. Conservazione: 24 mesi dopo fine_il.';

comment on column public.manutenzioni.motivo is
  'Il cartello sulla porta: lo legge chiunque, anche chi non e'' registrato. Niente di interno.';

comment on column public.manutenzioni.immediata is
  'Vero se e'' stata accesa con il fermo rapido invece che programmata. Serve solo a distinguere le due cose a posteriori.';

comment on column public.manutenzioni.avviso_id is
  'Il preavviso della 071 creato insieme a questa finestra, se ne e'' stato chiesto uno.';

commit;
