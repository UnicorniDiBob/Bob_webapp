-- 078 — La verifica scade dopo un anno (decisione di Lucio, 12/09/2026)
--
-- PERCHE'. Un badge che attesta un controllo fatto una volta e valido per
-- sempre smette di attestare qualcosa: la partita IVA di un anno fa puo'
-- essere chiusa da mesi. Fino a oggi professional_verification non aveva
-- nessuna scadenza — una verifica valeva per sempre — e 10.4 era aperta dal 4
-- agosto con una proposta a 6 mesi mai decisa. Deciso: UN ANNO.
--
-- PERCHE' UN ANNO E NON SEI MESI. Perche' il costo non e' il controllo, e'
-- l'esame umano. Il VIES risponde solo per chi e' iscritto agli scambi
-- intra-UE (una minoranza degli artigiani): per tutti gli altri un esito
-- negativo non e' un segnale, e' la normalita', e non puo' far partire niente.
-- Ripassarlo piu' spesso non produce controlli, produce rumore. Vedi
-- docs/NOTE_E_DECISIONI.md, voce del 12/09.
--
-- LA SCADENZA NON DECLASSA DA SOLA. Qui si scrive solo la DATA. Alla scadenza
-- la riga va nella coda «Ricontrollo» e la decisione resta di una persona
-- (art. 22 GDPR, regola gia' scritta dal blocco 10). Il preavviso a 30 giorni e
-- la finestra dell'ultima settimana esistono anche per questo: il Regolamento
-- P2B (art. 4) vuole motivazione e preavviso per ogni restrizione del servizio,
-- e la perdita dell'etichetta lo e'.
--
-- L'OROLOGIO PARTE ORA PER CHI E' GIA' VERIFICATO, UNA VOLTA SOLA. Il backfill
-- qui sotto ha la guardia `vat_expires_at is null`: rigirare la migrazione non
-- rimette avanti nessuna scadenza.
--
-- Idempotente: add column if not exists, create or replace, drop-then-create
-- del trigger.

begin;

alter table public.professional_verification
  add column if not exists vat_expires_at timestamptz;

comment on column public.professional_verification.vat_expires_at is
  'Quando scade la verifica: un anno dal riscontro (decisione 12/09/2026). NULL = nessun livello attivo. Alla scadenza il livello NON cade da solo: la riga va in Ricontrollo e il declassamento resta umano.';

create index if not exists professional_verification_expires_idx
  on public.professional_verification (vat_expires_at)
  where vat_expires_at is not null;

-- Dove il professionista ha gia' chiuso la finestra dell'ultima settimana.
-- Sta su profiles e non su professional_verification per una ragione di
-- permessi: il pro puo' aggiornare la propria riga di profiles (policy «User
-- updates own profile», mig 018) e NON deve poter scrivere sulla tabella che
-- contiene il suo livello di verifica. Contiene la data di scadenza per cui la
-- finestra e' stata chiusa: se la verifica si rinnova il valore non coincide
-- piu' e la finestra torna disponibile, senza nessun campo da azzerare.
alter table public.profiles
  add column if not exists scadenza_verifica_vista_al timestamptz;

comment on column public.profiles.scadenza_verifica_vista_al is
  'Per quale scadenza della verifica questa persona ha gia'' chiuso la finestra di preavviso. Contiene il valore di professional_verification.vat_expires_at mostrato in quel momento.';

-- ---------------------------------------------------------------------------
-- La data si scrive da sola quando si concede un livello
-- ---------------------------------------------------------------------------
-- Un trigger e non una riga nelle route: i livelli si concedono da due posti
-- diversi (il controllo automatico in /api/pro/verifica-piva e l'esame umano in
-- /api/admin/verifiche/[id]) e un terzo posto arrivera'. Una scadenza
-- dimenticata in uno dei tre e' una verifica eterna che nessuno nota.
create or replace function public.set_verification_expiry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.level in ('vat_verified', 'documents_verified') then
    -- Livello appena concesso, cambiato, o riga vecchia senza scadenza:
    -- l'anno riparte adesso. Se la scadenza c'e' gia' e il livello non e'
    -- cambiato, non si tocca (altrimenti ogni salvataggio la sposterebbe in
    -- avanti e non scadrebbe mai).
    if tg_op = 'INSERT'
       or old.level is distinct from new.level
       or new.vat_expires_at is null then
      new.vat_expires_at := now() + interval '1 year';
    end if;
  else
    new.vat_expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_verification_expiry on public.professional_verification;
create trigger trg_set_verification_expiry
  before insert or update of level, vat_expires_at
  on public.professional_verification
  for each row
  execute function public.set_verification_expiry();

-- ---------------------------------------------------------------------------
-- L'orologio parte adesso per chi e' gia' verificato
-- ---------------------------------------------------------------------------
update public.professional_verification
   set vat_expires_at = now() + interval '1 year'
 where level in ('vat_verified', 'documents_verified')
   and vat_expires_at is null;

commit;
