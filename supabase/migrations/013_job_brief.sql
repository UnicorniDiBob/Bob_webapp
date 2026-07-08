-- 013: Job Brief v1 (vedi Bob_Job_Brief_Spec.md)
-- 1) Rinomina categorie troppo specifiche (dj, supporto-excel)
-- 2) Seed tassonomia sotto-servizi (unità di ranking + futura keyword ads)
-- 3) Sotto-specialità dichiarate dai professionisti
-- 4) Tabella job_briefs (log dei brief strutturati prodotti dalla chat)
-- 5) Bucket privato per le foto del problema

-- 1) Rinomina servizi (le FK usano gli id: il rename dello slug è sicuro)
update public.services
set slug = 'musica-intrattenimento',
    name = 'Musica e intrattenimento',
    description = coalesce(description, 'DJ, musica dal vivo, animazione e spettacolo per eventi')
where slug = 'dj';

update public.services
set slug = 'supporto-informatico',
    name = 'Supporto informatico',
    description = coalesce(description, 'Excel, Office, assistenza PC/Mac, reti e formazione digitale')
where slug = 'supporto-excel';

-- 2) Seed tassonomia sotto-servizi (idempotente: salta quelli già presenti)
-- NB: subservices.slug ha un vincolo UNIQUE globale, quindi i fallback "Altro"
-- usano slug prefissati per servizio (es. idraulico-altro).
insert into public.subservices (service_id, name, slug)
select s.id, v.name, v.subtask_slug
from (values
  -- idraulico
  ('idraulico', 'perdita-rubinetto-sifone', 'Perdita rubinetto o sifone'),
  ('idraulico', 'scarico-otturato', 'Scarico otturato'),
  ('idraulico', 'perdita-tubatura-infiltrazione', 'Perdita tubatura o infiltrazione'),
  ('idraulico', 'wc-sanitari', 'WC e sanitari'),
  ('idraulico', 'caldaia-scaldabagno', 'Caldaia e scaldabagno'),
  ('idraulico', 'allaccio-elettrodomestici', 'Allaccio elettrodomestici'),
  ('idraulico', 'emergenza-allagamento', 'Emergenza allagamento'),
  ('idraulico', 'rifacimento-impianto-bagno', 'Rifacimento impianto bagno'),
  ('idraulico', 'idraulico-altro', 'Altro (idraulico)'),
  -- elettricista
  ('elettricista', 'presa-interruttore', 'Presa o interruttore'),
  ('elettricista', 'corto-salvavita-scatta', 'Corto circuito o salvavita che scatta'),
  ('elettricista', 'punto-luce-lampadario', 'Punto luce o lampadario'),
  ('elettricista', 'quadro-elettrico', 'Quadro elettrico'),
  ('elettricista', 'impianto-nuovo-rifacimento', 'Impianto nuovo o rifacimento'),
  ('elettricista', 'messa-a-norma-certificazione', 'Messa a norma e certificazione'),
  ('elettricista', 'citofono-videocitofono', 'Citofono o videocitofono'),
  ('elettricista', 'emergenza-senza-corrente', 'Emergenza: senza corrente'),
  ('elettricista', 'elettricista-altro', 'Altro (elettricista)'),
  -- pulizie
  ('pulizie', 'ordinarie-ricorrenti', 'Pulizie ordinarie ricorrenti'),
  ('pulizie', 'profonda-una-tantum', 'Pulizia profonda una tantum'),
  ('pulizie', 'post-ristrutturazione', 'Post ristrutturazione'),
  ('pulizie', 'fine-locazione-trasloco', 'Fine locazione o trasloco'),
  ('pulizie', 'uffici-negozi', 'Uffici e negozi'),
  ('pulizie', 'sanificazione', 'Sanificazione'),
  ('pulizie', 'vetri-vetrate', 'Vetri e vetrate'),
  ('pulizie', 'pulizie-altro', 'Altro (pulizie)'),
  -- imbianchino
  ('imbianchino', 'tinteggiatura-interni', 'Tinteggiatura interni'),
  ('imbianchino', 'tinteggiatura-esterni-facciata', 'Tinteggiatura esterni o facciata'),
  ('imbianchino', 'trattamento-muffa', 'Trattamento muffa'),
  ('imbianchino', 'cartongesso', 'Cartongesso'),
  ('imbianchino', 'effetti-decorativi-stucchi', 'Effetti decorativi e stucchi'),
  ('imbianchino', 'verniciatura-infissi-ringhiere', 'Verniciatura infissi e ringhiere'),
  ('imbianchino', 'imbianchino-altro', 'Altro (imbianchino)'),
  -- traslochi
  ('traslochi', 'trasloco-completo', 'Trasloco completo'),
  ('traslochi', 'trasporto-singolo', 'Trasporto singolo (mobile o elettrodomestico)'),
  ('traslochi', 'sgombero-cantine-locali', 'Sgombero cantine e locali'),
  ('traslochi', 'smontaggio-rimontaggio-mobili', 'Smontaggio e rimontaggio mobili'),
  ('traslochi', 'deposito-temporaneo', 'Deposito temporaneo'),
  ('traslochi', 'traslochi-altro', 'Altro (traslochi)'),
  -- tuttofare
  ('tuttofare', 'montaggio-mobili', 'Montaggio mobili'),
  ('tuttofare', 'mensole-quadri-tende', 'Mensole, quadri e tende'),
  ('tuttofare', 'piccole-riparazioni', 'Piccole riparazioni'),
  ('tuttofare', 'serrature-semplici', 'Serrature semplici'),
  ('tuttofare', 'silicone-guarnizioni', 'Silicone e guarnizioni'),
  ('tuttofare', 'zanzariere-tende-da-sole', 'Zanzariere e tende da sole'),
  ('tuttofare', 'tuttofare-altro', 'Altro (tuttofare)'),
  -- personal-trainer
  ('personal-trainer', 'dimagrimento', 'Dimagrimento'),
  ('personal-trainer', 'massa-forza', 'Massa e forza'),
  ('personal-trainer', 'preparazione-sportiva', 'Preparazione sportiva'),
  ('personal-trainer', 'posturale-ripresa-infortunio', 'Posturale e ripresa infortunio'),
  ('personal-trainer', 'coaching-online', 'Coaching online'),
  ('personal-trainer', 'allenamento-gruppo', 'Allenamento di gruppo'),
  ('personal-trainer', 'personal-trainer-altro', 'Altro (personal trainer)'),
  -- musica-intrattenimento
  ('musica-intrattenimento', 'dj-set', 'DJ set'),
  ('musica-intrattenimento', 'musica-dal-vivo', 'Musica dal vivo (band, solista, cantante)'),
  ('musica-intrattenimento', 'animazione-bambini', 'Animazione bambini'),
  ('musica-intrattenimento', 'animazione-eventi', 'Animazione eventi'),
  ('musica-intrattenimento', 'karaoke-serate-a-tema', 'Karaoke e serate a tema'),
  ('musica-intrattenimento', 'spettacolo', 'Spettacolo (maghi, artisti, performer)'),
  ('musica-intrattenimento', 'service-audio-luci', 'Service audio e luci'),
  ('musica-intrattenimento', 'musica-intrattenimento-altro', 'Altro (musica intrattenimento)'),
  -- fotografo
  ('fotografo', 'matrimonio-cerimonie', 'Matrimonio e cerimonie'),
  ('fotografo', 'eventi', 'Eventi'),
  ('fotografo', 'ritratto-book', 'Ritratto e book'),
  ('fotografo', 'food-prodotti-ecommerce', 'Food, prodotti ed e-commerce'),
  ('fotografo', 'immobiliare', 'Immobiliare'),
  ('fotografo', 'famiglia-neonati', 'Famiglia e neonati'),
  ('fotografo', 'video', 'Video'),
  ('fotografo', 'fotografo-altro', 'Altro (fotografo)'),
  -- ripetizioni
  ('ripetizioni', 'matematica-fisica', 'Matematica e fisica'),
  ('ripetizioni', 'lingue-straniere', 'Lingue straniere'),
  ('ripetizioni', 'materie-umanistiche', 'Materie umanistiche'),
  ('ripetizioni', 'esami-universitari', 'Esami universitari'),
  ('ripetizioni', 'elementari-medie-doposcuola', 'Elementari, medie e doposcuola'),
  ('ripetizioni', 'informatica-programmazione', 'Informatica e programmazione'),
  ('ripetizioni', 'ripetizioni-altro', 'Altro (ripetizioni)'),
  -- supporto-informatico
  ('supporto-informatico', 'excel-fogli-di-calcolo', 'Excel e fogli di calcolo'),
  ('supporto-informatico', 'macro-automazioni', 'Macro e automazioni'),
  ('supporto-informatico', 'documenti-presentazioni', 'Documenti e presentazioni'),
  ('supporto-informatico', 'assistenza-pc-mac', 'Assistenza PC e Mac'),
  ('supporto-informatico', 'reti-stampanti-dispositivi', 'Reti, stampanti e dispositivi'),
  ('supporto-informatico', 'recupero-dati-backup', 'Recupero dati e backup'),
  ('supporto-informatico', 'formazione-digitale', 'Formazione digitale'),
  ('supporto-informatico', 'supporto-informatico-altro', 'Altro (supporto informatico)'),
  -- giardiniere
  ('giardiniere', 'manutenzione-ricorrente', 'Manutenzione ricorrente'),
  ('giardiniere', 'potatura-siepi', 'Potatura siepi'),
  ('giardiniere', 'potatura-alberi', 'Potatura alberi'),
  ('giardiniere', 'prato-semina-posa', 'Prato: semina o posa'),
  ('giardiniere', 'impianto-irrigazione', 'Impianto di irrigazione'),
  ('giardiniere', 'progettazione-giardino', 'Progettazione giardino'),
  ('giardiniere', 'giardiniere-altro', 'Altro (giardiniere)'),
  -- serramentista
  ('serramentista', 'sostituzione-infissi', 'Sostituzione infissi'),
  ('serramentista', 'riparazione-infissi', 'Riparazione infissi'),
  ('serramentista', 'zanzariere', 'Zanzariere'),
  ('serramentista', 'tapparelle-avvolgibili', 'Tapparelle e avvolgibili'),
  ('serramentista', 'porta-blindata', 'Porta blindata'),
  ('serramentista', 'porte-interne', 'Porte interne'),
  ('serramentista', 'sostituzione-vetri', 'Sostituzione vetri'),
  ('serramentista', 'serramentista-altro', 'Altro (serramentista)'),
  -- grafica-logo
  ('grafica-logo', 'logo-brand-identity', 'Logo e brand identity'),
  ('grafica-logo', 'volantini-locandine', 'Volantini e locandine'),
  ('grafica-logo', 'biglietti-da-visita', 'Biglietti da visita'),
  ('grafica-logo', 'menu-cataloghi', 'Menu e cataloghi'),
  ('grafica-logo', 'grafiche-social', 'Grafiche social'),
  ('grafica-logo', 'packaging-etichette', 'Packaging ed etichette'),
  ('grafica-logo', 'grafica-logo-altro', 'Altro (grafica logo)'),
  -- sviluppo-web
  ('sviluppo-web', 'sito-vetrina', 'Sito vetrina'),
  ('sviluppo-web', 'ecommerce', 'E-commerce'),
  ('sviluppo-web', 'landing-page', 'Landing page'),
  ('sviluppo-web', 'web-app-custom', 'Web app custom'),
  ('sviluppo-web', 'modifiche-manutenzione-sito', 'Modifiche e manutenzione sito'),
  ('sviluppo-web', 'seo-tecnico', 'SEO tecnico'),
  ('sviluppo-web', 'sviluppo-web-altro', 'Altro (sviluppo web)')
) as v(service_slug, subtask_slug, name)
join public.services s on s.slug = v.service_slug
where not exists (
  select 1 from public.subservices ss
  where ss.service_id = s.id and ss.slug = v.subtask_slug
);

-- 3) Sotto-specialità dichiarate dal professionista (slug della tassonomia)
alter table public.professionals
  add column if not exists subservice_slugs text[] not null default '{}';

-- 4) Log dei job brief prodotti dalla chat (fondamento dati per il ranking)
create table if not exists public.job_briefs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  service_slug text,
  subtask_slug text,
  severity text check (severity in ('alta', 'media', 'bassa')),
  urgency text check (urgency in ('emergenza', 'questa_settimana', 'questo_mese', 'esplorando')),
  summary text,
  property_type text check (property_type in ('appartamento', 'casa_indipendente', 'ufficio_commerciale', 'esterno', 'altro')),
  access_notes text,
  timing_availability text,
  budget_min numeric,
  budget_max numeric,
  budget_flexible boolean default false,
  city_slug text,
  zone text,
  scope jsonb not null default '{}'::jsonb,
  red_flags text[] not null default '{}',
  photos jsonb not null default '[]'::jsonb,
  field_meta jsonb not null default '{}'::jsonb,
  source text not null default 'ai' check (source in ('ai', 'rules')),
  created_at timestamptz default now()
);

create index if not exists job_briefs_service_idx
  on public.job_briefs (service_slug, subtask_slug, created_at desc);

alter table public.job_briefs enable row level security;

-- Scrittura solo via service role (nessuna policy insert per anon/authenticated).
-- Lettura: l'utente autenticato vede solo i propri brief.
create policy "job_briefs_own_read" on public.job_briefs
  for select using (auth.uid() = user_id);

-- 5) Bucket PRIVATO per le foto del problema (niente policy pubbliche:
-- upload e lettura passano dal server con service role; URL firmati in futuro)
insert into storage.buckets (id, name, public)
values ('brief-photos', 'brief-photos', false)
on conflict (id) do nothing;
