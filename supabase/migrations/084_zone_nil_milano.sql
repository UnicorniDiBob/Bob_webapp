-- 084: Milano passa da 28 nomi corti a 88 nuclei ufficiali.
--
-- PERCHÉ
-- Le 28 zone erano un elenco scritto a mano per il cliente in chat: nomi che
-- una persona riconosce («Isola», «Navigli»). Al professionista servono per
-- dire dove lavora, e lì non bastano: 55 nuclei su 88 non avevano nessuna
-- casella. La mappa li disegnava — il perimetro c'è, è nel geojson dei NIL — e
-- non si potevano scegliere. Chi lavora a Trenno, a Dergano, a Comasina non
-- aveva modo di dirlo.
--
-- COSA CAMBIA
-- city_zones per Milano diventa la griglia dei NIL (Nuclei di Identità Locale,
-- dataset ds964 del Comune di Milano, CC-BY). Il centro di ogni zona è il
-- centroide del suo poligono, calcolato dall'area: sta dentro la forma che si
-- vede sulla mappa. Lo genera scripts/build_milano_nil_zones.py dal file che è
-- già nel repo, senza rete.
--
-- I 28 NOMI DI PRIMA NON SPARISCONO
-- Restano in src/lib/zones.ts — il percorso del cliente, area di André, non
-- toccato da qui — e ogni nucleo porta `group_slug`, il nome corto a cui
-- appartiene. `private.coverage_keys_for` emette anche il gettone del gruppo,
-- quindi una richiesta che dice «Navigli» continua a incontrare il
-- professionista che copre Ronchetto sul Naviglio. Le zone scelte a mano con i
-- vecchi nomi vengono spostate sui nuclei corrispondenti, non azzerate.
--
-- LA SCELTA DA RIVEDERE, SCRITTA QUI PERCHÉ NON SI PERDA
-- Il gettone del gruppo si emette se il professionista copre ALMENO UNO dei
-- nuclei del gruppo, non tutti. Con quattro gruppi su 28 composti da più
-- nuclei, pretendere l'insieme completo farebbe perdere incontri veri; così
-- invece un professionista che copre un pezzo di «Navigli» risulta su
-- «Navigli». Per stringere basta cambiare il ciclo dei gruppi in questa
-- funzione: `having count(*) = (numero dei nuclei del gruppo)`.
--
-- CONFORMITÀ
-- Base giuridica: art. 6(1)(b) — la zona di lavoro è ciò che il professionista
--   pubblica per essere raggiunto. Nessuna finalità nuova rispetto alla 057.
-- Dati personali: nessuno qui dentro. city_zones è geografia pubblica del
--   Comune; la geometria del professionista resta in professional_coverage,
--   privata, e continua a non uscire (pubblici solo i gettoni).
-- Nuovo fornitore: nessuno. Il file è nostro, servito dal nostro dominio.
-- Conservazione: invariata. DPIA: nessun trigger di §7.3.
-- Attribuzione CC-BY: «Comune di Milano — dataset NIL ds964», già nella
--   colonna `source` di ogni riga.
--
-- Idempotente: colonne con if not exists, upsert sulla chiave (city_id, slug),
-- funzione in create or replace, pulizia legata alla colonna source.

-- ---------------------------------------------------------------------------
-- 1. Due colonne: il gruppo di prima, e il nome ufficiale per intero
-- ---------------------------------------------------------------------------

alter table public.city_zones
  add column if not exists group_slug text,
  add column if not exists nome_ufficiale text;

comment on column public.city_zones.group_slug is
  'Il nome corto di src/lib/zones.ts a cui questo nucleo appartiene (Milano: 28 gruppi su 88 nuclei). Serve a far incontrare una richiesta scritta col nome colloquiale e una copertura disegnata sui nuclei. Null dove il nucleo non sta in nessun gruppo.';

comment on column public.city_zones.nome_ufficiale is
  'Il nome del nucleo come lo pubblica il Comune, per esteso. L''etichetta breve sta in label.';

create index if not exists city_zones_group_idx
  on public.city_zones (city_id, group_slug);

-- ---------------------------------------------------------------------------
-- 2. I 88 nuclei
-- ---------------------------------------------------------------------------

insert into public.city_zones (city_id, slug, label, lat, lng, group_slug, nome_ufficiale, source, updated_at)
select c.id, v.slug, v.label, v.lat, v.lng, v.group_slug, v.nome_ufficiale,
       'Comune di Milano — NIL ds964 (CC-BY)', now()
  from public.cities c
  cross join (values
    ('adriano', 'Adriano', 45.51412, 9.24804, null, 'Adriano'),
    ('affori', 'Affori', 45.51392, 9.17121, 'affori', 'Affori'),
    ('assiano', 'Assiano', 45.44935, 9.06151, null, 'Assiano'),
    ('baggio', 'Baggio', 45.45959, 9.08732, 'baggio', 'Baggio - Quartiere degli Olmi - Quartiere Valsesia'),
    ('bande-nere', 'Bande Nere', 45.45991, 9.13909, 'bande-nere', 'Bande Nere'),
    ('barona', 'Barona', 45.43221, 9.15576, 'barona', 'Barona'),
    ('bicocca', 'Bicocca', 45.51898, 9.21288, 'bicocca', 'Bicocca'),
    ('bovisa', 'Bovisa', 45.50386, 9.15997, 'bovisa', 'Bovisa'),
    ('bovisasca', 'Bovisasca', 45.51754, 9.15677, 'bovisa', 'Bovisasca'),
    ('brera', 'Brera', 45.47423, 9.18805, 'brera', 'Brera'),
    ('bruzzano', 'Bruzzano', 45.52922, 9.17208, null, 'Bruzzano'),
    ('buenos-aires', 'Buenos Aires - Porta Venezia', 45.47708, 9.21454, 'porta-venezia', 'Buenos Aires - Porta Venezia - Porta Monforte'),
    ('cantalupa', 'Cantalupa', 45.42192, 9.15671, null, 'Cantalupa'),
    ('cascina-merlata', 'Cascina Merlata', 45.52028, 9.10267, null, 'Cascina Merlata'),
    ('chiaravalle', 'Chiaravalle', 45.41715, 9.23999, null, 'Chiaravalle'),
    ('cimiano', 'Cimiano - Rottole', 45.49826, 9.25204, null, 'Cimiano - Rottole - Quartiere Feltre'),
    ('citta-studi', 'Città Studi', 45.47718, 9.23082, 'citta-studi', 'Città Studi'),
    ('comasina', 'Comasina', 45.52641, 9.15984, null, 'Comasina'),
    ('corsica', 'Corsica', 45.46406, 9.23135, null, 'Corsica'),
    ('de-angeli', 'De Angeli - Monte Rosa', 45.47503, 9.14836, 'washington', 'De Angeli - Monte Rosa'),
    ('dergano', 'Dergano', 45.50206, 9.17791, null, 'Dergano'),
    ('duomo', 'Duomo', 45.46369, 9.18698, 'centro', 'Duomo'),
    ('farini', 'Farini', 45.49402, 9.17472, null, 'Farini'),
    ('figino', 'Figino', 45.49122, 9.0746, null, 'Figino'),
    ('forze-armate', 'Forze Armate', 45.46245, 9.11396, null, 'Forze Armate'),
    ('gallaratese', 'Gallaratese - San Leonardo', 45.49657, 9.11175, null, 'Quartiere Gallaratese - Quartiere San Leonardo - Lampugnano'),
    ('ghisolfa', 'Ghisolfa', 45.49103, 9.16284, null, 'Ghisolfa'),
    ('giambellino', 'Giambellino', 45.44712, 9.1371, null, 'Giambellino'),
    ('giardini-porta-venezia', 'Giardini Porta Venezia', 45.47459, 9.19995, 'porta-venezia', 'Giardini Porta Venezia'),
    ('gorla', 'Gorla - Precotto', 45.51266, 9.22569, null, 'Gorla - Precotto'),
    ('gratosoglio', 'Gratosoglio', 45.41147, 9.17107, 'gratosoglio', 'Gratosoglio - Quartiere Missaglia - Quartiere Terrazze'),
    ('greco', 'Greco - Segnano', 45.50336, 9.20942, 'greco', 'Greco - Segnano'),
    ('guastalla', 'Guastalla', 45.46315, 9.20194, 'porta-romana', 'Guastalla'),
    ('isola', 'Isola', 45.49078, 9.18957, 'isola', 'Isola'),
    ('lambrate', 'Lambrate - Ortica', 45.47927, 9.24964, 'lambrate', 'Lambrate - Ortica'),
    ('lodi', 'Lodi - Corvetto', 45.43694, 9.22818, 'corvetto', 'Lodi - Corvetto'),
    ('lorenteggio', 'Lorenteggio', 45.45129, 9.11936, 'bande-nere', 'Lorenteggio'),
    ('loreto', 'Loreto - Casoretto', 45.49094, 9.22226, 'loreto', 'Loreto - Casoretto - Nolo'),
    ('maciachini', 'Maciachini - Maggiolina', 45.49834, 9.19663, null, 'Maciachini - Maggiolina'),
    ('magenta', 'Magenta - S. Vittore', 45.46451, 9.17043, null, 'Magenta - S. Vittore'),
    ('maggiore', 'Maggiore - Musocco', 45.50709, 9.11465, null, 'Maggiore - Musocco - Certosa'),
    ('moncucco', 'Moncucco - San Cristoforo', 45.44201, 9.15848, null, 'Moncucco - San Cristoforo'),
    ('monlue', 'Monluè - Ponte Lambro', 45.44937, 9.2612, null, 'Monluè - Ponte Lambro'),
    ('morivione', 'Morivione', 45.44078, 9.19389, null, 'Morivione'),
    ('muggiano', 'Muggiano', 45.45157, 9.07188, null, 'Muggiano'),
    ('niguarda', 'Niguarda - Ca'' Granda', 45.51673, 9.1962, 'niguarda', 'Niguarda - Ca'' Granda - Prato Centenaro - Quartiere Fulvio Testi'),
    ('ortomercato', 'Ortomercato', 45.45338, 9.23027, null, 'Ortomercato'),
    ('padova', 'Padova - Turro', 45.50162, 9.23426, null, 'Padova - Turro - Crescenzago'),
    ('pagano', 'Pagano', 45.47362, 9.16286, null, 'Pagano'),
    ('parco-bosco-in-citta', 'Parco Bosco in Città', 45.48483, 9.08522, null, 'Parco Bosco in Città'),
    ('parco-dei-navigli', 'Parco dei Navigli', 45.42324, 9.14208, 'navigli', 'Parco dei Navigli'),
    ('parco-delle-abbazie', 'Parco delle Abbazie', 45.41142, 9.20537, null, 'Parco delle Abbazie'),
    ('parco-forlanini', 'Parco Forlanini - Cavriano', 45.46703, 9.25596, 'forlanini', 'Parco Forlanini - Cavriano'),
    ('parco-nord', 'Parco Nord', 45.52332, 9.18426, null, 'Parco Nord'),
    ('parco-sempione', 'Parco Sempione', 45.47411, 9.17646, 'sempione', 'Parco Sempione'),
    ('porta-garibaldi', 'Porta Garibaldi - Porta Nuova', 45.48358, 9.19041, 'porta-nuova', 'Porta Garibaldi - Porta Nuova'),
    ('porta-genova', 'Porta Genova', 45.45407, 9.16194, null, 'Porta Genova'),
    ('porta-magenta', 'Porta Magenta', 45.46203, 9.15611, null, 'Porta Magenta'),
    ('porta-romana', 'Porta Romana', 45.45064, 9.2054, 'porta-romana', 'Porta Romana'),
    ('porta-ticinese-conca-del-naviglio', 'Porta Ticinese - Conca del Naviglio', 45.45053, 9.18135, 'navigli', 'Porta Ticinese - Conca del Naviglio'),
    ('porta-ticinese-conchetta', 'Porta Ticinese - Conchetta', 45.44858, 9.16924, 'ticinese', 'Porta Ticinese - Conchetta'),
    ('porta-vigentina', 'Porta Vigentina - Porta Lodovica', 45.45113, 9.19234, null, 'Porta Vigentina - Porta Lodovica'),
    ('portello', 'Portello', 45.48451, 9.15408, null, 'Portello'),
    ('qt8', 'QT8', 45.48727, 9.13638, null, 'QT8'),
    ('quarto-cagnino', 'Quarto Cagnino', 45.47365, 9.10857, null, 'Quarto Cagnino'),
    ('quarto-oggiaro', 'Quarto Oggiaro - Vialba', 45.51369, 9.13772, 'quarto-oggiaro', 'Quarto Oggiaro - Vialba - Musocco'),
    ('quinto-romano', 'Quinto Romano', 45.47956, 9.08714, null, 'Quinto Romano'),
    ('quintosole', 'Quintosole', 45.40304, 9.20466, null, 'Quintosole'),
    ('rogoredo', 'Rogoredo - Santa Giulia', 45.43677, 9.24357, 'rogoredo', 'Rogoredo - Santa Giulia'),
    ('ronchetto-delle-rane', 'Ronchetto delle Rane', 45.40086, 9.18239, null, 'Ronchetto delle Rane'),
    ('ronchetto-sul-naviglio', 'Ronchetto sul Naviglio', 45.43839, 9.13706, 'navigli', 'Ronchetto sul Naviglio - Quartiere Lodovico il Moro'),
    ('roserio', 'Roserio', 45.52025, 9.1228, null, 'Roserio'),
    ('san-siro', 'San Siro', 45.47128, 9.13837, 'san-siro', 'San Siro'),
    ('sarpi', 'Sarpi', 45.4833, 9.17251, null, 'Sarpi'),
    ('scalo-romana', 'Scalo Romana', 45.43877, 9.20899, null, 'Scalo Romana'),
    ('stadera', 'Stadera - Chiesa Rossa', 45.4299, 9.17844, 'famagosta', 'Stadera - Chiesa Rossa - Quartiere Torretta - Conca Fallata'),
    ('stadio', 'Stadio - Ippodromi', 45.4797, 9.12397, null, 'Stadio - Ippodromi'),
    ('stazione-centrale', 'Stazione Centrale - Ponte Seveso', 45.48754, 9.20573, null, 'Stazione Centrale - Ponte Seveso'),
    ('stephenson', 'Stephenson', 45.51209, 9.12189, null, 'Stephenson'),
    ('taliedo', 'Taliedo - Morsenchio', 45.44931, 9.24729, 'forlanini', 'Taliedo - Morsenchio - Quartiere Forlanini'),
    ('tibaldi', 'Tibaldi', 45.44037, 9.18069, null, 'Tibaldi'),
    ('tre-torri', 'Tre Torri', 45.477, 9.15569, null, 'Tre Torri'),
    ('trenno', 'Trenno', 45.49261, 9.10175, null, 'Trenno'),
    ('triulzo-superiore', 'Triulzo Superiore', 45.42787, 9.24933, null, 'Triulzo Superiore'),
    ('umbria', 'Umbria - Molise', 45.45209, 9.21879, null, 'Umbria - Molise - Calvairate'),
    ('vigentino', 'Vigentino', 45.4293, 9.20172, null, 'Vigentino - Quartiere Fatima'),
    ('villapizzone', 'Villapizzone - Cagnola', 45.49743, 9.14361, null, 'Villapizzone - Cagnola - Boldinasco'),
    ('xxii-marzo', 'XXII Marzo', 45.46187, 9.21441, null, 'XXII Marzo')
  ) as v (slug, label, lat, lng, group_slug, nome_ufficiale)
 where c.slug = 'milano'
on conflict (city_id, slug) do update
   set label = excluded.label,
       lat = excluded.lat,
       lng = excluded.lng,
       group_slug = excluded.group_slug,
       nome_ufficiale = excluded.nome_ufficiale,
       source = excluded.source,
       updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Le zone scelte a mano si spostano sui nuclei, prima che i nomi vecchi
--    spariscano dalla tabella
-- ---------------------------------------------------------------------------

with mappa (vecchio, nuovo) as (values
    ('affori', 'affori'),
    ('baggio', 'baggio'),
    ('bande-nere', 'bande-nere'),
    ('bande-nere', 'lorenteggio'),
    ('barona', 'barona'),
    ('bicocca', 'bicocca'),
    ('bovisa', 'bovisa'),
    ('bovisa', 'bovisasca'),
    ('brera', 'brera'),
    ('centro', 'duomo'),
    ('citta-studi', 'citta-studi'),
    ('corvetto', 'lodi'),
    ('famagosta', 'stadera'),
    ('forlanini', 'parco-forlanini'),
    ('forlanini', 'taliedo'),
    ('gratosoglio', 'gratosoglio'),
    ('greco', 'greco'),
    ('isola', 'isola'),
    ('lambrate', 'lambrate'),
    ('loreto', 'loreto'),
    ('navigli', 'parco-dei-navigli'),
    ('navigli', 'porta-ticinese-conca-del-naviglio'),
    ('navigli', 'ronchetto-sul-naviglio'),
    ('niguarda', 'niguarda'),
    ('porta-nuova', 'porta-garibaldi'),
    ('porta-romana', 'guastalla'),
    ('porta-romana', 'porta-romana'),
    ('porta-venezia', 'buenos-aires'),
    ('porta-venezia', 'giardini-porta-venezia'),
    ('quarto-oggiaro', 'quarto-oggiaro'),
    ('rogoredo', 'rogoredo'),
    ('san-siro', 'san-siro'),
    ('sempione', 'parco-sempione'),
    ('ticinese', 'porta-ticinese-conchetta'),
    ('washington', 'de-angeli')
),
spostate as (
  select c.id,
         array_agg(distinct coalesce(m.nuovo, s) order by coalesce(m.nuovo, s)) as nuovi
    from public.professional_coverage c
    join public.cities ci on ci.id = c.city_id and ci.slug = 'milano'
    cross join lateral unnest(coalesce(c.zone_slugs, '{}'::text[])) as s
    left join mappa m on m.vecchio = s
   where c.mode <> 'circle'
   group by c.id
)
update public.professional_coverage c
   set zone_slugs = s.nuovi
  from spostate s
 where s.id = c.id
   and c.zone_slugs is distinct from s.nuovi;

-- ---------------------------------------------------------------------------
-- 4. Via i 28 nomi corti dalla griglia: da qui in poi vivono come gruppo
-- ---------------------------------------------------------------------------

delete from public.city_zones z
 using public.cities c
 where c.id = z.city_id
   and c.slug = 'milano'
   and z.source is distinct from 'Comune di Milano — NIL ds964 (CC-BY)';

-- ---------------------------------------------------------------------------
-- 5. I gettoni: nucleo e, insieme, il gruppo a cui appartiene
-- ---------------------------------------------------------------------------

create or replace function private.coverage_keys_for(p_coverage_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $BODY$
declare
  r record;
  keys text[] := '{}';
  z text;
  g text;
begin
  select c.scope, c.zone_slugs, c.works_remote, c.city_id,
         ci.slug as city_slug, ci.province, ci.region, ci.macro_region
    into r
    from public.professional_coverage c
    left join public.cities ci on ci.id = c.city_id
   where c.id = p_coverage_id;

  if not found then
    return '{}';
  end if;

  if r.works_remote then
    keys := keys || 'remote:*'::text;
  end if;

  if r.scope = 'national' then
    return keys || 'it:*'::text;
  elsif r.scope = 'macro_region' then
    return keys || ('macro:' || private.slugify(r.macro_region));
  elsif r.scope = 'region' then
    return keys || ('reg:' || private.slugify(r.region));
  elsif r.scope = 'province' then
    return keys || ('prov:' || private.slugify(r.province));
  elsif r.scope = 'city' then
    return keys || ('city:' || r.city_slug);
  end if;

  -- scope = 'zones': un gettone per nucleo, con la città nel nome perché
  -- "centro" esiste in ogni città d'Italia.
  foreach z in array coalesce(r.zone_slugs, '{}') loop
    keys := keys || ('zone:' || r.city_slug || '/' || z);
  end loop;

  -- E uno per ogni gruppo toccato: il cliente in chat sceglie ancora i nomi
  -- corti, e senza questo pezzo la sua richiesta non troverebbe nessuno.
  for g in
    select distinct zz.group_slug
      from public.city_zones zz
     where zz.city_id = r.city_id
       and zz.group_slug is not null
       and zz.slug = any(coalesce(r.zone_slugs, '{}'))
  loop
    keys := keys || ('zone:' || r.city_slug || '/' || g);
  end loop;

  return keys;
end;
$BODY$;

-- ---------------------------------------------------------------------------
-- 6. Ricalcolo: i cerchi si ridisegnano sulla griglia nuova, i gettoni
--    pubblici si riscrivono. Lo fanno i trigger della 057, basta toccare le
--    righe.
-- ---------------------------------------------------------------------------

update public.professional_coverage set updated_at = now();
