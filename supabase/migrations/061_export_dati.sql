-- 061: l'export dei propri dati (artt. 15 e 20 GDPR) — una colonna sola.
--
-- COSA MANCAVA. Da /impostazioni/accesso una persona puo' gia' CANCELLARSI, ma
-- non puo' ottenere una COPIA di cio' che teniamo su di lei. Sono due diritti
-- distinti e nessuno dei due sostituisce l'altro: l'art. 15 da' diritto a una
-- copia dei dati, l'art. 20 alla stessa copia in un formato leggibile da una
-- macchina e portabile altrove. Finora l'unica strada era scrivere all'indirizzo
-- privacy — che e' ancora un [PLACEHOLDER] fino a gennaio 2027. Un diritto che
-- si esercita scrivendo a una casella inesistente non e' esercitabile.
--
-- PERCHE' UNA COLONNA E NON UNA TABELLA DI LOG
-- L'art. 12(5) permette di rifiutare le richieste "manifestamente infondate o
-- eccessive, in particolare per il loro carattere ripetitivo". Un export ogni
-- 24 ore e' il limite scelto: generoso per una persona, sufficiente a impedire
-- che la rotta diventi un modo comodo per scaricare in massa. Per farlo
-- rispettare serve UN dato: quando e' stato l'ultimo. Una tabella dedicata
-- avrebbe voluto dire una nuova superficie RLS, una nuova regola di
-- conservazione e un nuovo percorso di cancellazione, per conservare uno
-- storico di quando qualcuno ha esercitato un proprio diritto — cioe' un dato
-- personale in piu' su di lui, tenuto per nostra comodita'. La colonna vive
-- dentro profile_private, che ha gia' la sua RLS e muore con l'account.
--
-- NON E' UN REGISTRO DI ACCOUNTABILITY. Si sovrascrive a ogni export e non
-- tiene storico, di proposito: serve al limite di frequenza, non a dimostrare
-- niente a nessuno. Se in M6 l'avvocato chiedera' una prova di riscontro alle
-- richieste, quella sara' una decisione separata e consapevole, non un effetto
-- collaterale di questa riga.
--
-- SCRITTURA: solo service role. profile_private non ha policy di UPDATE per
-- l'utente e non gliene serve una — il valore lo fissa la rotta dopo un export
-- riuscito. In lettura la persona la vede, tramite la policy che ha gia'
-- ("User reads own private profile"), ed e' giusto: e' un dato su di lei.
--
-- Fonti: artt. 12(3), 12(5), 15, 20 del Regolamento (UE) 2016/679; WP242 rev.01
-- (linee guida sulla portabilita', JSON come formato "strutturato e leggibile
-- da dispositivo automatico"). Ricognizione, non parere legale: da confermare
-- con l'avvocato in M6.
--
-- Idempotente: if not exists.

alter table public.profile_private
  add column if not exists last_export_at timestamptz;

comment on column public.profile_private.last_export_at is
  'Ultimo export dei propri dati (artt. 15/20 GDPR). Serve solo a far rispettare il limite di uno ogni 24 ore (art. 12(5)): si sovrascrive, non tiene storico. Muore con l''account insieme al resto della riga. Vedi migrazione 061.';
