-- 085: dove ha la base il professionista — comune, provincia, regione, CAP.
--
-- PERCHÉ
-- Oggi di un professionista sappiamo solo la città di Bob (Milano) e una
-- «zona» che scriveva a mano nel questionario di iscrizione: testo libero,
-- quindi «zona 9», «Niguarda», «nord Milano» e «vicino a Bicocca» sono quattro
-- risposte che non si confrontano con niente. Non si può né inquadrare la
-- mappa dell'area di lavoro sul posto giusto, né sapere se un professionista
-- sta a Sesto o a Baggio.
-- Da qui in poi il comune si sceglie da un elenco (ISTAT) e il CAP è
-- obbligatorio nel modulo: due dati confrontabili al posto di una frase.
--
-- IL CAP È SUGGERITO, NON IMPOSTO
-- L'elenco completo e ufficiale dei CAP è di Poste Italiane e non è aperto.
-- Quello che usiamo per proporli (ISTAT + CAP da raccolta di terzi, vedi
-- docs/NOTE_E_DECISIONI.md, voce 17/09/2026) non è garantito completo: il
-- vincolo qui controlla le cinque cifre, non l'appartenenza al comune. Un CAP
-- vero che non sta nel nostro elenco si salva lo stesso — rifiutarlo sarebbe
-- dare per buono un elenco che non lo è.
--
-- NESSUN BLOCCO PER CHI C'È GIÀ
-- Le colonne accettano il vuoto. I sei professionisti iscritti non hanno il
-- CAP e non devono trovarsi una barriera che non avevano accettato: il modulo
-- di iscrizione lo pretende, a loro arriva il promemoria nel profilo, come per
-- gli orari.
--
-- CONFORMITÀ (DATA_COMPLIANCE §2, §5)
-- Base giuridica: art. 6(1)(b) — per una ditta individuale il comune e il CAP
--   della base sono dati personali, e sono ciò che rende possibile proporlo
--   per un lavoro vicino a casa del cliente. Senza, il servizio non può fare
--   quello che promette.
-- Minimizzazione: comune e CAP, non via e civico. La grana è quella che serve
--   a inquadrare una mappa e a valutare una trasferta, la stessa scelta già
--   fatta per il cliente con le migrazioni 044-046.
-- Riga RoPA: «Base del professionista» — da aggiungere in docs/legal/ROPA.md
--   nello stesso giro (attività 41.3 tiene già aperta la riga gemella lato
--   cliente).
-- Informativa: nessuna finalità nuova rispetto a «area di lavoro del
--   professionista»; la voce va allineata quando si tocca l'informativa.
-- Conservazione: vita del profilo, cancellati a cascata con l'account come il
--   resto della riga professionals.
-- Pubblicazione: queste colonne NON sono pubbliche di per sé. Quello che esce
--   resta professional_coverage_public, cioè i gettoni delle zone.
-- DPIA: nessun trigger di §7.3.
--
-- Idempotente: add column if not exists, drop-then-create dei vincoli.

alter table public.professionals
  add column if not exists comune_istat text,
  add column if not exists comune_name text,
  add column if not exists province text,
  add column if not exists region text,
  add column if not exists postal_code text;

alter table public.professionals
  drop constraint if exists professionals_postal_code_format;
alter table public.professionals
  add constraint professionals_postal_code_format check (
    postal_code is null or postal_code ~ '^[0-9]{5}$'
  );

alter table public.professionals
  drop constraint if exists professionals_comune_istat_format;
alter table public.professionals
  add constraint professionals_comune_istat_format check (
    comune_istat is null or comune_istat ~ '^[0-9]{6}$'
  );

comment on column public.professionals.comune_istat is
  'Codice ISTAT del comune scelto dall''elenco (sei cifre, zeri davanti compresi). È la chiave stabile: il nome cambia con le fusioni, il codice no.';
comment on column public.professionals.comune_name is
  'Il nome del comune al momento della scelta. Copia di comodo per non dover leggere l''elenco a ogni riga mostrata.';
comment on column public.professionals.province is
  'Nome della provincia, scritto come in public.cities.province: i due elenchi devono restare confrontabili.';
comment on column public.professionals.region is
  'Nome della regione, scritto come in public.cities.region.';
comment on column public.professionals.postal_code is
  'CAP della base del professionista, cinque cifre. Obbligatorio nel modulo di iscrizione, facoltativo qui perché chi era già iscritto non deve essere bloccato. Non è verificato contro il comune: l''elenco ufficiale dei CAP non è aperto.';

-- Serve a una domanda sola, ma ricorrente: «chi abbiamo in questo CAP?»
create index if not exists professionals_postal_code_idx
  on public.professionals (postal_code)
  where postal_code is not null;
