-- 067: il vocabolario della ricerca — dalle parole che si scrivono al catalogo.
--
-- COSA MANCAVA. Per trovare un servizio oggi ci sono due strade: chiedere a Bob,
-- oppure scorrere l'elenco con due tendine (città e servizio). Non esiste una
-- casella di ricerca. Chi sa già cosa gli serve — "rubinetto che perde" — deve
-- indovinare in quale delle quindici categorie sta il suo problema, che è
-- esattamente il lavoro che un motore di ricerca dovrebbe fare al posto suo.
--
-- Le parole il catalogo ce le ha già: 15 servizi e 120 interventi, da
-- "Idraulico" giù fino a "Perdita rubinetto o sifone". Il pezzo mancante non
-- sono le voci, è il ponte fra come parla il cliente e come si chiama la voce.
--
-- COSA FA QUESTA TABELLA. Una riga per ogni modo di scrivere una cosa, e il
-- punto del catalogo dove quella scrittura porta. "rubinetto che perde",
-- "rubinetto gocciola" e "perdita rubinetto" sono tre righe che finiscono tutte
-- sullo stesso intervento. Nessun dato personale: è catalogo, e si legge in
-- pubblico esattamente come services e subservices.
--
-- PERCHÉ IN DATABASE E NON IN CODICE. Un dizionario esiste già, in
-- src/lib/matching.ts (SERVICE_KEYWORDS), e serve alla chat di Bob quando l'AI
-- è spenta. Vive in un file .ts: aggiungere un sinonimo è un deploy, e nessuno
-- in admin può farlo. Soprattutto quel dizionario si ferma al SERVIZIO — sa
-- portarti su "idraulico", non su "scarico otturato". Qui le due cose si
-- uniscono: i suoi termini entrano come sinonimi di servizio (source
-- 'dictionary') e sopra ci vanno gli interventi.
--
-- IL TERMINE È SEMPRE NORMALIZZATO. Un trigger passa ogni termine da
-- search_normalize prima di scriverlo: minuscolo, senza accenti, senza
-- punteggiatura, spazi singoli. Così "Perdita Rubinetto" e "perdita rubinetto"
-- non diventano due righe diverse, e chi interroga normalizza la domanda con la
-- stessa funzione e confronta mele con mele. È anche il motivo per cui il
-- termine normalizzato è una COLONNA e non un indice calcolato: unaccent
-- dipende da un dizionario, quindi non è immutable, e Postgres non la accetta
-- in un'espressione indicizzata.
--
-- Idempotente: create ... if not exists, funzioni e trigger drop-then-create,
-- semi con on conflict do nothing.
--
-- NOTA PER LA RICOSTRUZIONE (scripts/schema_check.sh): unaccent e pg_trgm
-- stanno in postgresql-contrib. Su una macchina dove il rebuild fallisce qui,
-- manca quel pacchetto, non questo file.

-- ---------------------------------------------------------------------------
-- 1. Estensioni. In `extensions`, mai in public: un'estensione in public è un
--    rilievo fisso degli advisor di Supabase.
-- ---------------------------------------------------------------------------

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- 2. La normalizzazione, un posto solo.
--    STABLE e non IMMUTABLE perché unaccent consulta un dizionario. search_path
--    fissato: un search_path mutabile su una funzione è un rilievo advisor.
-- ---------------------------------------------------------------------------

create or replace function public.search_normalize(p_text text)
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select nullif(
           trim(
             regexp_replace(
               regexp_replace(
                 extensions.unaccent('extensions.unaccent'::regdictionary, lower(coalesce(p_text, ''))),
                 '[^a-z0-9 ]', ' ', 'g'),
               ' +', ' ', 'g')
           ),
         '');
$$;

comment on function public.search_normalize(text) is
  'Forma canonica di una parola cercata: minuscolo, senza accenti, senza punteggiatura, spazi singoli. La stessa funzione normalizza i termini in tabella e la domanda del cliente.';

-- ---------------------------------------------------------------------------
-- 3. Il vocabolario.
-- ---------------------------------------------------------------------------

create table if not exists public.search_terms (
  id            uuid primary key default gen_random_uuid(),
  -- Come si scrive, in forma canonica. Lo impone il trigger, non chi inserisce.
  term          text not null,
  -- Come si legge nel menu a tendina: il nome ufficiale del catalogo, non il
  -- sinonimo. Chi scrive "rubinetto gocciola" deve vedersi proporre
  -- "Perdita rubinetto o sifone", cioè imparare come si chiama.
  display       text not null,
  kind          text not null check (kind in ('service', 'subservice')),
  service_id    uuid not null references public.services(id) on delete cascade,
  subservice_id uuid references public.subservices(id) on delete cascade,
  -- Ordina i suggerimenti a parità di bontà del confronto: il nome ufficiale
  -- prima del sinonimo, il servizio prima dell'intervento.
  weight        smallint not null default 100,
  is_primary    boolean not null default false,
  -- Da dove viene la riga: 'catalog' generata dai nomi ufficiali, 'dictionary'
  -- travasata da matching.ts, 'admin' aggiunta a mano. Serve a sapere che cosa
  -- si può rigenerare e che cosa invece si perderebbe.
  source        text not null default 'admin' check (source in ('catalog', 'dictionary', 'admin')),
  created_at    timestamptz not null default now(),
  constraint search_terms_kind_coerente
    check ((kind = 'subservice') = (subservice_id is not null))
);

comment on table public.search_terms is
  'Vocabolario della ricerca: come si scrive una cosa e a quale voce di catalogo porta. Dato di catalogo, nessun dato personale, lettura pubblica.';

-- Unicità sulla coppia (parola, destinazione). Il coalesce dà una destinazione
-- confrontabile anche alle righe di servizio, dove subservice_id è NULL: senza,
-- NULL non è uguale a NULL e la stessa riga entrerebbe due volte.
create unique index if not exists search_terms_unico_idx
  on public.search_terms (term, service_id, coalesce(subservice_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Somiglianza: è l'indice che regge "rubinetti" quando in tabella c'è
-- "rubinetto", e i refusi.
create index if not exists search_terms_trgm_idx
  on public.search_terms using gin (term extensions.gin_trgm_ops);

-- Prefisso: è l'indice del completamento automatico, che interroga a ogni
-- lettera battuta. text_pattern_ops perché serve a LIKE 'idra%'.
create index if not exists search_terms_prefisso_idx
  on public.search_terms (term text_pattern_ops);

create index if not exists search_terms_service_idx on public.search_terms (service_id);
create index if not exists search_terms_subservice_idx on public.search_terms (subservice_id);

-- ---------------------------------------------------------------------------
-- 4. Il trigger che tiene fede alla promessa del punto 3.
-- ---------------------------------------------------------------------------

create or replace function public.search_terms_normalizza()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.term := public.search_normalize(new.term);
  if new.term is null then
    raise exception 'search_terms: il termine è vuoto dopo la normalizzazione';
  end if;
  return new;
end;
$$;

drop trigger if exists search_terms_normalizza_trg on public.search_terms;
create trigger search_terms_normalizza_trg
  before insert or update of term on public.search_terms
  for each row execute function public.search_terms_normalizza();

-- ---------------------------------------------------------------------------
-- 5. RLS. Lettura pubblica come il resto del catalogo, scrittura al solo admin.
--    Il vocabolario decide che cosa si trova e che cosa no: è una leva sul
--    mercato, non un campo di testo.
-- ---------------------------------------------------------------------------

alter table public.search_terms enable row level security;

drop policy if exists "Public read search terms" on public.search_terms;
create policy "Public read search terms"
  on public.search_terms for select
  using (true);

drop policy if exists "Admin writes search terms" on public.search_terms;
create policy "Admin writes search terms"
  on public.search_terms for all
  using (private.is_admin())
  with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- 6. I nomi ufficiali entrano da soli.
--    Non c'è una lista a mano da tenere allineata al catalogo: le righe si
--    generano dal catalogo stesso. Aggiungere un intervento in admin e poi
--    rigiocare queste due insert lo rende cercabile.
--
--    Le voci "Altro (...)" restano fuori di proposito: sono la casella di
--    ripiego di un modulo, non qualcosa che una persona cerca. Chi scrive
--    "altro" non deve trovarsi davanti quindici categorie.
-- ---------------------------------------------------------------------------

insert into public.search_terms (term, display, kind, service_id, subservice_id, weight, is_primary, source)
select s.name, s.name, 'service', s.id, null, 120, true, 'catalog'
from public.services s
on conflict do nothing;

insert into public.search_terms (term, display, kind, service_id, subservice_id, weight, is_primary, source)
select sub.name, sub.name, 'subservice', sub.service_id, sub.id, 110, true, 'catalog'
from public.subservices sub
where sub.slug not like '%-altro'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 7. I sinonimi di SERVIZIO.
--    Il travaso di SERVICE_KEYWORDS da src/lib/matching.ts, con una differenza
--    che conta: là sono radici ("rubinett", "idraulic") perché quel codice fa
--    un confronto per sottostringa dentro una frase intera. Qui il confronto è
--    per parola scritta, dall'inizio, quindi servono parole intere — e il
--    plurale è una parola diversa dal singolare. "idraulici" è ciò che si
--    scrive nella casella; "idraulic" non lo scrive nessuno.
-- ---------------------------------------------------------------------------

with sinonimi(srv_slug, termine) as (values
  ('idraulico', 'idraulici'), ('idraulico', 'idraulica'), ('idraulico', 'tubista'),
  ('idraulico', 'pronto intervento idraulico'), ('idraulico', 'idraulico urgente'),
  ('elettricista', 'elettricisti'), ('elettricista', 'impianto elettrico'),
  ('elettricista', 'elettricista urgente'), ('elettricista', 'pronto intervento elettricista'),
  ('pulizie', 'pulizia'), ('pulizie', 'impresa di pulizie'), ('pulizie', 'ditta di pulizie'),
  ('pulizie', 'colf'), ('pulizie', 'donna delle pulizie'), ('pulizie', 'addetto alle pulizie'),
  ('imbianchino', 'imbianchini'), ('imbianchino', 'tinteggiatura'), ('imbianchino', 'pittore edile'),
  ('imbianchino', 'imbiancare'), ('imbianchino', 'pitturare'),
  ('traslochi', 'trasloco'), ('traslochi', 'ditta di traslochi'), ('traslochi', 'traslocatori'),
  ('traslochi', 'traslocare'),
  ('tuttofare', 'factotum'), ('tuttofare', 'handyman'), ('tuttofare', 'manutentore'),
  ('tuttofare', 'piccoli lavori'), ('tuttofare', 'lavoretti in casa'),
  ('giardiniere', 'giardinieri'), ('giardiniere', 'giardinaggio'), ('giardiniere', 'manutenzione del verde'),
  ('serramentista', 'serramentisti'), ('serramentista', 'infissi'), ('serramentista', 'serramenti'),
  ('serramentista', 'finestre'),
  ('fotografo', 'fotografa'), ('fotografo', 'fotografi'), ('fotografo', 'servizio fotografico'),
  ('fotografo', 'foto'),
  ('personal-trainer', 'allenatore personale'), ('personal-trainer', 'pt'),
  ('personal-trainer', 'preparatore atletico'), ('personal-trainer', 'allenamento'),
  ('ripetizioni', 'lezioni private'), ('ripetizioni', 'tutor'), ('ripetizioni', 'insegnante privato'),
  ('ripetizioni', 'aiuto compiti'),
  ('musica-intrattenimento', 'musica'), ('musica-intrattenimento', 'intrattenimento'),
  ('musica-intrattenimento', 'animazione'), ('musica-intrattenimento', 'musica per eventi'),
  ('grafica-logo', 'grafico'), ('grafica-logo', 'graphic designer'), ('grafica-logo', 'grafica'),
  ('grafica-logo', 'designer'),
  ('sviluppo-web', 'sviluppatore web'), ('sviluppo-web', 'web designer'),
  ('sviluppo-web', 'programmatore'), ('sviluppo-web', 'sito web'),
  ('supporto-informatico', 'assistenza informatica'), ('supporto-informatico', 'informatico'),
  ('supporto-informatico', 'tecnico computer'), ('supporto-informatico', 'assistenza pc')
)
insert into public.search_terms (term, display, kind, service_id, subservice_id, weight, is_primary, source)
select sin.termine, s.name, 'service', s.id, null, 100, false, 'dictionary'
from sinonimi sin
join public.services s on s.slug = sin.srv_slug
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 8. I sinonimi di INTERVENTO — la parte che non esisteva da nessuna parte.
--    Sono scritti come li scrive un cliente, non come li scrive un catalogo:
--    "rubinetto che perde", non "perdita rubinetto o sifone". È il senso di
--    tutta la migrazione. Sono un punto di partenza, non la verità: la lista
--    dei termini cercati e non trovati (una migrazione a venire) dirà quali mancano, e
--    quelli si aggiungono da /admin/catalogo senza un deploy.
--
--    Niente apostrofi nei valori: "d acqua", non "d'acqua". La normalizzazione
--    toglie comunque la punteggiatura, quindi chi lo scrive trova la riga.
-- ---------------------------------------------------------------------------

with sinonimi(sub_slug, termine) as (values
  -- Idraulico
  ('perdita-rubinetto-sifone', 'rubinetto che perde'),
  ('perdita-rubinetto-sifone', 'rubinetto gocciola'),
  ('perdita-rubinetto-sifone', 'perdita rubinetto'),
  ('perdita-rubinetto-sifone', 'sifone che perde'),
  ('perdita-rubinetto-sifone', 'lavandino perde'),
  ('perdita-rubinetto-sifone', 'riparare rubinetto'),
  ('riparazione-perdite', 'perdita acqua'),
  ('riparazione-perdite', 'perdita d acqua'),
  ('riparazione-perdite', 'tubo che perde'),
  ('riparazione-perdite', 'riparare una perdita'),
  ('perdita-tubatura-infiltrazione', 'infiltrazione'),
  ('perdita-tubatura-infiltrazione', 'infiltrazione acqua'),
  ('perdita-tubatura-infiltrazione', 'macchia di umidita sul soffitto'),
  ('perdita-tubatura-infiltrazione', 'tubatura rotta'),
  ('perdita-tubatura-infiltrazione', 'perdita nel muro'),
  ('scarico-otturato', 'scarico otturato'),
  ('scarico-otturato', 'scarico intasato'),
  ('scarico-otturato', 'lavandino otturato'),
  ('scarico-otturato', 'wc intasato'),
  ('scarico-otturato', 'water intasato'),
  ('scarico-otturato', 'sturare lo scarico'),
  ('scarico-otturato', 'doccia che non scarica'),
  ('caldaia-scaldabagno', 'caldaia non funziona'),
  ('caldaia-scaldabagno', 'caldaia in blocco'),
  ('caldaia-scaldabagno', 'riparazione caldaia'),
  ('caldaia-scaldabagno', 'manutenzione caldaia'),
  ('caldaia-scaldabagno', 'scaldabagno'),
  ('caldaia-scaldabagno', 'boiler'),
  ('caldaia-scaldabagno', 'non esce acqua calda'),
  ('emergenza-allagamento', 'allagamento'),
  ('emergenza-allagamento', 'casa allagata'),
  ('emergenza-allagamento', 'bagno allagato'),
  ('sostituzione-rubinetteria', 'sostituzione rubinetto'),
  ('sostituzione-rubinetteria', 'cambiare rubinetto'),
  ('sostituzione-rubinetteria', 'montare miscelatore'),
  ('wc-sanitari', 'sostituire il water'),
  ('wc-sanitari', 'montare il wc'),
  ('wc-sanitari', 'cassetta del wc perde'),
  ('wc-sanitari', 'sanitari bagno'),
  ('wc-sanitari', 'bidet'),
  ('rifacimento-impianto-bagno', 'rifare il bagno'),
  ('rifacimento-impianto-bagno', 'rifacimento bagno'),
  ('rifacimento-impianto-bagno', 'nuovo impianto bagno'),
  ('allaccio-elettrodomestici', 'allacciare la lavatrice'),
  ('allaccio-elettrodomestici', 'collegare la lavastoviglie'),
  ('allaccio-elettrodomestici', 'attacco lavatrice'),
  -- Elettricista
  ('presa-interruttore', 'presa non funziona'),
  ('presa-interruttore', 'cambiare una presa'),
  ('presa-interruttore', 'aggiungere una presa'),
  ('presa-interruttore', 'interruttore rotto'),
  ('prese-e-interruttori', 'prese e interruttori'),
  ('prese-e-interruttori', 'montare interruttore'),
  ('corto-salvavita-scatta', 'salvavita che scatta'),
  ('corto-salvavita-scatta', 'salta la corrente'),
  ('corto-salvavita-scatta', 'corto circuito'),
  ('corto-salvavita-scatta', 'differenziale scatta'),
  ('emergenza-senza-corrente', 'senza corrente'),
  ('emergenza-senza-corrente', 'manca la luce'),
  ('emergenza-senza-corrente', 'blackout in casa'),
  ('punto-luce-lampadario', 'montare un lampadario'),
  ('punto-luce-lampadario', 'installare lampadario'),
  ('punto-luce-lampadario', 'punto luce'),
  ('punto-luce-lampadario', 'faretti'),
  ('punto-luce-lampadario', 'attaccare la plafoniera'),
  ('quadro-elettrico', 'quadro elettrico'),
  ('quadro-elettrico', 'sostituire il quadro elettrico'),
  ('quadro-elettrico', 'centralina elettrica'),
  ('messa-a-norma', 'messa a norma impianto'),
  ('messa-a-norma', 'impianto a norma'),
  ('messa-a-norma-certificazione', 'certificazione impianto elettrico'),
  ('messa-a-norma-certificazione', 'dichiarazione di conformita'),
  ('citofono-videocitofono', 'citofono non funziona'),
  ('citofono-videocitofono', 'videocitofono'),
  ('citofono-videocitofono', 'sostituire il citofono'),
  ('impianto-nuovo-rifacimento', 'rifare impianto elettrico'),
  ('impianto-nuovo-rifacimento', 'impianto elettrico nuovo'),
  ('impianto-nuovo-rifacimento', 'cablaggio casa'),
  -- Pulizie
  ('ordinarie-ricorrenti', 'pulizie settimanali'),
  ('ordinarie-ricorrenti', 'pulizie ricorrenti'),
  ('ordinarie-ricorrenti', 'pulizia casa settimanale'),
  ('profonda-una-tantum', 'pulizia profonda'),
  ('profonda-una-tantum', 'pulizia straordinaria'),
  ('profonda-una-tantum', 'pulizia a fondo'),
  ('profonda-una-tantum', 'deep cleaning'),
  ('pulizie-appartamenti', 'pulizia appartamento'),
  ('pulizie-appartamenti', 'pulire casa'),
  ('pulizie-appartamenti', 'pulizie casa'),
  ('fine-locazione-trasloco', 'pulizia fine locazione'),
  ('fine-locazione-trasloco', 'pulizia dopo il trasloco'),
  ('fine-locazione-trasloco', 'pulizia consegna chiavi'),
  ('fine-locazione-trasloco', 'pulizia airbnb'),
  ('post-ristrutturazione', 'pulizia post cantiere'),
  ('post-ristrutturazione', 'pulizia dopo i lavori'),
  ('post-ristrutturazione', 'pulizia post ristrutturazione'),
  ('sanificazione', 'sanificazione'),
  ('sanificazione', 'igienizzazione'),
  ('sanificazione', 'disinfezione ambienti'),
  ('vetri-vetrate', 'pulizia vetri'),
  ('vetri-vetrate', 'lavare i vetri'),
  ('vetri-vetrate', 'vetrine del negozio'),
  ('uffici-negozi', 'pulizia ufficio'),
  ('uffici-negozi', 'pulizie negozio'),
  ('pulizie-uffici-piccoli', 'pulizie uffici'),
  -- Imbianchino
  ('tinteggiatura-interni', 'imbiancare casa'),
  ('tinteggiatura-interni', 'tinteggiare le pareti'),
  ('tinteggiatura-interni', 'pitturare una stanza'),
  ('tinteggiatura-interni', 'dare il bianco'),
  ('imbiancatura-camere', 'imbiancare una camera'),
  ('imbiancatura-camere', 'pitturare la camera'),
  ('tinteggiatura-esterni-facciata', 'tinteggiare la facciata'),
  ('tinteggiatura-esterni-facciata', 'pitturare esterno'),
  ('tinteggiatura-esterni-facciata', 'facciata condominio'),
  ('trattamento-muffa', 'muffa sul muro'),
  ('trattamento-muffa', 'togliere la muffa'),
  ('trattamento-muffa', 'antimuffa'),
  ('cartongesso', 'cartongesso'),
  ('cartongesso', 'controsoffitto'),
  ('cartongesso', 'parete in cartongesso'),
  ('effetti-decorativi-stucchi', 'stucco veneziano'),
  ('effetti-decorativi-stucchi', 'spatolato'),
  ('effetti-decorativi-stucchi', 'effetto decorativo'),
  ('verniciatura-infissi-ringhiere', 'verniciare la ringhiera'),
  ('verniciatura-infissi-ringhiere', 'verniciare le persiane'),
  ('verniciatura-infissi-ringhiere', 'smaltare gli infissi'),
  -- Serramentista
  ('zanzariere', 'zanzariere'),
  ('zanzariere', 'montaggio zanzariere'),
  ('zanzariere', 'zanzariera rotta'),
  ('zanzariere', 'zanzariere su misura'),
  ('tapparelle-avvolgibili', 'tapparella bloccata'),
  ('tapparelle-avvolgibili', 'riparare la tapparella'),
  ('tapparelle-avvolgibili', 'cinghia della tapparella'),
  ('tapparelle-avvolgibili', 'avvolgibile rotto'),
  ('tapparelle-avvolgibili', 'motore tapparella'),
  ('sostituzione-infissi', 'cambiare le finestre'),
  ('sostituzione-infissi', 'infissi nuovi'),
  ('sostituzione-infissi', 'serramenti in pvc'),
  ('sostituzione-infissi', 'doppi vetri'),
  ('riparazione-infissi', 'la finestra non chiude'),
  ('riparazione-infissi', 'riparare un infisso'),
  ('riparazione-infissi', 'maniglia della finestra rotta'),
  ('sostituzione-vetri', 'vetro rotto'),
  ('sostituzione-vetri', 'sostituire il vetro della finestra'),
  ('porta-blindata', 'porta blindata'),
  ('porta-blindata', 'serratura blindata'),
  ('porte-interne', 'porte interne'),
  ('porte-interne', 'montare una porta'),
  ('porte-interne', 'sostituire una porta'),
  -- Tuttofare
  ('montaggio-mobili', 'montaggio mobili'),
  ('montaggio-mobili', 'montare ikea'),
  ('montaggio-mobili', 'montare un armadio'),
  ('montaggio-mobili', 'assemblare mobili'),
  ('mensole-quadri-tende', 'appendere quadri'),
  ('mensole-quadri-tende', 'montare mensole'),
  ('mensole-quadri-tende', 'montare le tende'),
  ('mensole-quadri-tende', 'bastone per tende'),
  ('piccole-riparazioni', 'riparazioni domestiche'),
  ('piccole-riparazioni', 'piccoli lavori in casa'),
  ('serrature-semplici', 'cambiare la serratura'),
  ('serrature-semplici', 'serratura bloccata'),
  ('serrature-semplici', 'sostituire il cilindro'),
  ('silicone-guarnizioni', 'rifare il silicone della doccia'),
  ('silicone-guarnizioni', 'silicone bagno'),
  ('zanzariere-tende-da-sole', 'tenda da sole'),
  -- Giardiniere
  ('potatura-siepi', 'potare la siepe'),
  ('potatura-siepi', 'tagliare la siepe'),
  ('potatura-alberi', 'potare un albero'),
  ('potatura-alberi', 'abbattimento albero'),
  ('manutenzione-ricorrente', 'manutenzione giardino'),
  ('manutenzione-ricorrente', 'taglio erba'),
  ('manutenzione-ricorrente', 'tagliare il prato'),
  ('manutenzione-ricorrente', 'sfalcio'),
  ('prato-semina-posa', 'prato nuovo'),
  ('prato-semina-posa', 'posa prato a rotoli'),
  ('prato-semina-posa', 'seminare il prato'),
  ('impianto-irrigazione', 'impianto di irrigazione'),
  ('impianto-irrigazione', 'irrigazione giardino'),
  ('impianto-irrigazione', 'irrigatori'),
  ('progettazione-giardino', 'progettare il giardino'),
  ('progettazione-giardino', 'sistemare il terrazzo'),
  -- Traslochi
  ('trasloco-completo', 'trasloco casa'),
  ('trasloco-completo', 'trasloco appartamento'),
  ('trasporto-singolo', 'trasportare un mobile'),
  ('trasporto-singolo', 'trasporto divano'),
  ('trasporto-singolo', 'portare un frigorifero'),
  ('sgombero-cantine-locali', 'sgombero cantina'),
  ('sgombero-cantine-locali', 'svuotare la cantina'),
  ('sgombero-cantine-locali', 'sgombero appartamento'),
  ('smontaggio-rimontaggio-mobili', 'smontare i mobili'),
  ('smontaggio-rimontaggio-mobili', 'smontaggio armadio'),
  ('deposito-temporaneo', 'deposito mobili'),
  ('deposito-temporaneo', 'custodia mobili'),
  -- Fotografo
  ('matrimonio-cerimonie', 'fotografo matrimonio'),
  ('matrimonio-cerimonie', 'servizio fotografico matrimonio'),
  ('matrimonio-cerimonie', 'fotografo cerimonia'),
  ('ritratto-book', 'book fotografico'),
  ('ritratto-book', 'servizio ritratto'),
  ('ritratto-book', 'foto profilo professionale'),
  ('eventi', 'fotografo per evento'),
  ('eventi', 'foto festa'),
  ('eventi', 'fotografo compleanno'),
  ('famiglia-neonati', 'foto di famiglia'),
  ('famiglia-neonati', 'servizio newborn'),
  ('famiglia-neonati', 'foto neonato'),
  ('food-prodotti-ecommerce', 'foto prodotti'),
  ('food-prodotti-ecommerce', 'food photography'),
  ('food-prodotti-ecommerce', 'foto per ecommerce'),
  ('immobiliare', 'foto immobiliare'),
  ('immobiliare', 'foto casa da vendere'),
  ('immobiliare', 'foto appartamento airbnb'),
  ('video', 'videomaker'),
  ('video', 'riprese video'),
  ('video', 'video promozionale'),
  -- Musica e intrattenimento
  ('dj-set', 'dj'),
  ('dj-set', 'dj per festa'),
  ('dj-set', 'dj matrimonio'),
  ('musica-dal-vivo', 'musica dal vivo'),
  ('musica-dal-vivo', 'band per matrimonio'),
  ('musica-dal-vivo', 'cantante per evento'),
  ('musica-dal-vivo', 'musicista'),
  ('animazione-bambini', 'animazione per bambini'),
  ('animazione-bambini', 'animatore festa bambini'),
  ('animazione-bambini', 'festa di compleanno bambini'),
  ('animazione-eventi', 'animatore per eventi'),
  ('animazione-eventi', 'intrattenimento eventi'),
  ('karaoke-serate-a-tema', 'karaoke'),
  ('karaoke-serate-a-tema', 'serata a tema'),
  ('service-audio-luci', 'service audio'),
  ('service-audio-luci', 'impianto audio per evento'),
  ('service-audio-luci', 'luci per evento'),
  ('spettacolo', 'mago'),
  ('spettacolo', 'spettacolo per festa'),
  -- Personal trainer
  ('dimagrimento', 'personal trainer per dimagrire'),
  ('dimagrimento', 'perdere peso allenamento'),
  ('massa-forza', 'aumentare massa muscolare'),
  ('massa-forza', 'allenamento forza'),
  ('posturale-ripresa-infortunio', 'ginnastica posturale'),
  ('posturale-ripresa-infortunio', 'allenamento dopo un infortunio'),
  ('preparazione-sportiva', 'preparazione atletica'),
  ('preparazione-sportiva', 'preparazione maratona'),
  ('allenamento-gruppo', 'allenamento di gruppo'),
  ('allenamento-gruppo', 'small group training'),
  ('coaching-online', 'personal trainer online'),
  ('coaching-online', 'scheda di allenamento online'),
  -- Ripetizioni
  ('matematica-fisica', 'ripetizioni matematica'),
  ('matematica-fisica', 'ripetizioni fisica'),
  ('matematica-fisica', 'analisi matematica'),
  ('lingue-straniere', 'ripetizioni inglese'),
  ('lingue-straniere', 'lezioni di inglese'),
  ('lingue-straniere', 'ripetizioni francese'),
  ('lingue-straniere', 'ripetizioni spagnolo'),
  ('lingue-straniere', 'ripetizioni tedesco'),
  ('elementari-medie-doposcuola', 'doposcuola'),
  ('elementari-medie-doposcuola', 'aiuto con i compiti'),
  ('elementari-medie-doposcuola', 'ripetizioni scuola media'),
  ('esami-universitari', 'ripetizioni universita'),
  ('esami-universitari', 'preparazione esame universitario'),
  ('informatica-programmazione', 'lezioni di programmazione'),
  ('informatica-programmazione', 'ripetizioni informatica'),
  ('informatica-programmazione', 'imparare python'),
  ('materie-umanistiche', 'ripetizioni italiano'),
  ('materie-umanistiche', 'ripetizioni latino'),
  ('materie-umanistiche', 'ripetizioni storia'),
  -- Supporto informatico
  ('assistenza-pc-mac', 'computer lento'),
  ('assistenza-pc-mac', 'il pc non si accende'),
  ('assistenza-pc-mac', 'assistenza computer'),
  ('assistenza-pc-mac', 'riparazione pc'),
  ('assistenza-pc-mac', 'assistenza mac'),
  ('assistenza-pc-mac', 'virus sul computer'),
  ('excel-fogli-di-calcolo', 'aiuto con excel'),
  ('excel-fogli-di-calcolo', 'formule excel'),
  ('excel-fogli-di-calcolo', 'tabella pivot'),
  ('excel-fogli-di-calcolo', 'foglio di calcolo'),
  ('macro-automazioni', 'macro excel'),
  ('macro-automazioni', 'automatizzare un report'),
  ('recupero-dati-backup', 'recuperare file cancellati'),
  ('recupero-dati-backup', 'recupero dati'),
  ('recupero-dati-backup', 'backup'),
  ('reti-stampanti-dispositivi', 'la stampante non stampa'),
  ('reti-stampanti-dispositivi', 'configurare il wifi'),
  ('reti-stampanti-dispositivi', 'collegare la stampante'),
  ('reti-stampanti-dispositivi', 'rete lenta'),
  ('documenti-presentazioni', 'powerpoint'),
  ('documenti-presentazioni', 'presentazione aziendale'),
  ('documenti-presentazioni', 'impaginare un documento word'),
  ('formazione-digitale', 'imparare a usare il computer'),
  ('formazione-digitale', 'corso base computer'),
  ('formazione-digitale', 'aiuto con lo spid'),
  -- Grafica e logo
  ('logo-brand-identity', 'creare un logo'),
  ('logo-brand-identity', 'logo aziendale'),
  ('logo-brand-identity', 'brand identity'),
  ('logo-brand-identity', 'restyling logo'),
  ('volantini-locandine', 'volantino'),
  ('volantini-locandine', 'locandina'),
  ('volantini-locandine', 'flyer'),
  ('biglietti-da-visita', 'biglietti da visita'),
  ('grafiche-social', 'grafiche per instagram'),
  ('grafiche-social', 'post per i social'),
  ('grafiche-social', 'copertina facebook'),
  ('menu-cataloghi', 'menu per ristorante'),
  ('menu-cataloghi', 'catalogo prodotti'),
  ('packaging-etichette', 'etichette prodotto'),
  ('packaging-etichette', 'packaging'),
  -- Sviluppo web
  ('sito-vetrina', 'creare un sito'),
  ('sito-vetrina', 'sito vetrina'),
  ('sito-vetrina', 'sito internet aziendale'),
  ('ecommerce', 'ecommerce'),
  ('ecommerce', 'negozio online'),
  ('ecommerce', 'vendere online'),
  ('ecommerce', 'shopify'),
  ('ecommerce', 'woocommerce'),
  ('landing-page', 'landing page'),
  ('modifiche-manutenzione-sito', 'modifiche al sito'),
  ('modifiche-manutenzione-sito', 'manutenzione sito'),
  ('modifiche-manutenzione-sito', 'aggiornare wordpress'),
  ('modifiche-manutenzione-sito', 'il sito non funziona'),
  ('seo-tecnico', 'seo'),
  ('seo-tecnico', 'posizionamento su google'),
  ('seo-tecnico', 'ottimizzazione sito'),
  ('web-app-custom', 'web app'),
  ('web-app-custom', 'gestionale su misura'),
  ('web-app-custom', 'applicazione web')
)
insert into public.search_terms (term, display, kind, service_id, subservice_id, weight, is_primary, source)
select sin.termine, sub.name, 'subservice', sub.service_id, sub.id, 90, false, 'dictionary'
from sinonimi sin
join public.subservices sub on sub.slug = sin.sub_slug
on conflict do nothing;
