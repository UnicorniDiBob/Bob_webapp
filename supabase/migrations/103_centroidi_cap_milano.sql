-- 103: centroidi dei CAP di Milano, corretti — GeoNames non bastava.
--
-- PERCHÉ
-- La 101 ha seminato cap_centroids da GeoNames per tutta Italia, verificata
-- riga per riga (checksum sul file: 4735 righe, somma di lat e di lng
-- coincidenti). Quel checksum prova che il file è arrivato intatto nel
-- database — non prova che le coordinate del file fossero abbastanza fini.
-- A Milano non lo erano: verificato in produzione, i 38 CAP civici reali
-- (20121–20162, esclusi i quattro generici sotto) collassavano su **12
-- soli punti distinti** — GeoNames porta un punto per zona amministrativa,
-- non uno per CAP, e diversi CAP di Milano condividono lo stesso punto.
-- 20121 e 20162, per dire, avevano lat/lng identiche pur stando a diversi
-- chilometri di distanza vera. Con le bande della 102 (≤5 km → 4, ≤10 km
-- → 3) ogni coppia di CAP milanesi finiva nella stessa banda o quasi:
-- punti_distanza valeva, nei fatti, un solo punto di scarto su 100 — nella
-- sola città del pilota. Il difetto che la 102 doveva chiudere restava
-- aperto lì dove conta di più.
--
-- FONTE, LICENZA, E PERCHÉ QUESTA E NON GEONAMES PER MILANO
-- I confini dei CAP non sono dato aperto in Italia (sono di Poste Italiane);
-- nessun portale ufficiale — né il Comune di Milano né la Città
-- Metropolitana — pubblica poligoni di CAP. Il Comune pubblica i confini
-- NIL (84), ma NIL e CAP sono disegnati da due enti diversi per due scopi
-- diversi e non si sovrappongono in modo pulito: un CAP attraversa più NIL
-- e viceversa, quindi far derivare un centro CAP da un NIL sarebbe
-- un'approssimazione di un'approssimazione, senza nessuna mappa ufficiale
-- CAP↔NIL che la renda difendibile — peggio del punto grezzo che
-- sostituisce.
-- Zornade (https://zornade.com/mappa-cap/milano/, CC BY 4.0) ricostruisce i
-- confini dei CAP italiani da 3,4 milioni di particelle catastali,
-- incrociate con OpenStreetMap, OpenAddresses, dati.gov.it, ISTAT e
-- Nominatim — «97,1% accuratezza validata» dichiarata dall'editore. File
-- scaricato il 2026-09-29 (milano.geojson, 38 poligoni). Il centroide non
-- è quello eventualmente fornito dal file: è stato ricalcolato qui da zero
-- dai poligoni grezzi (area-weighted centroid via shapely), per non
-- fidarsi di un numero che non si può rifare.
--
-- VERIFICATO PRIMA DI SCRIVERE QUESTA MIGRAZIONE
-- 38 CAP nel file, e sono esattamente i 38 CAP civici di Milano — nessuno
-- in più, nessuno in meno. 38 punti distinti su 38 (zero collisioni, contro
-- i 12 su 38 di GeoNames). Scarto massimo fra due CAP qualunque: 13,96 km
-- (20132–20152), vicino ai ~15 km di diagonale reale della città. 20121↔
-- 20162: 5,11 km da centroide a centroide — non gli ~8 km stimati
-- inizialmente; confermato con un metodo indipendente (Nominatim sugli
-- stessi due CAP, 4,87 km) e con il centro del bounding box (5,02 km):
-- tre metodi, stesso ordine di grandezza. Decisione di André, 2026-09-29:
-- procedere con questo dato, la stima a 8 km era imprecisa.
--
-- COSA NON CAMBIA
-- 20130, 20140, 20150, 20160 restano assenti apposta: sono CAP generici per
-- caselle postali e grandi utenti, senza indirizzo civico (spiegato nella
-- 101). Nessuna riga qui per loro: il ricadere sul centroide del comune
-- resta il comportamento corretto. Fuori da Milano non cambia niente — i
-- ~110 CAP civici reali ancora senza centroide restano il gap documentato
-- nella 101, fuori scopo qui.
--
-- Idempotente: stesso upsert della 101, sulla stessa chiave primaria — una
-- riga che esiste già viene corretta, non duplicata; su un database
-- ricostruito da zero (101 poi 103, nello stesso ordine del repo) arriva
-- allo stesso risultato finale.

insert into public.cap_centroids (cap, lat, lng, source, updated_at)
select v.cap, v.lat, v.lng,
       'Zornade (CC BY 4.0), https://zornade.com/mappa-cap/milano/ — poligoni scaricati 2026-09-29, centroide ricalcolato da qui (non un campo del file)', now()
  from (values
    ('20121', 45.472552, 9.188638),
    ('20122', 45.459586, 9.196505),
    ('20123', 45.462479, 9.176034),
    ('20124', 45.484373, 9.199666),
    ('20125', 45.500076, 9.206359),
    ('20126', 45.514788, 9.216737),
    ('20127', 45.497229, 9.223310),
    ('20128', 45.513177, 9.237945),
    ('20129', 45.470236, 9.214228),
    ('20131', 45.485527, 9.225553),
    ('20132', 45.504531, 9.252300),
    ('20133', 45.472524, 9.231230),
    ('20134', 45.478928, 9.252873),
    ('20135', 45.454217, 9.209332),
    ('20136', 45.448296, 9.186226),
    ('20137', 45.453660, 9.225747),
    ('20138', 45.444832, 9.250742),
    ('20139', 45.430277, 9.226835),
    ('20141', 45.420966, 9.203607),
    ('20142', 45.418564, 9.165179),
    ('20143', 45.443793, 9.158175),
    ('20144', 45.454254, 9.159356),
    ('20145', 45.474069, 9.161874),
    ('20146', 45.456696, 9.144137),
    ('20147', 45.456520, 9.125993),
    ('20148', 45.478377, 9.135038),
    ('20149', 45.479367, 9.150651),
    ('20151', 45.493040, 9.112291),
    ('20152', 45.452364, 9.089483),
    ('20153', 45.476170, 9.079245),
    ('20154', 45.484122, 9.173784),
    ('20155', 45.493142, 9.158366),
    ('20156', 45.505139, 9.129216),
    ('20157', 45.515673, 9.129002),
    ('20158', 45.500437, 9.171186),
    ('20159', 45.496700, 9.186928),
    ('20161', 45.521812, 9.170421),
    ('20162', 45.518203, 9.195794)
  ) as v (cap, lat, lng)
on conflict (cap) do update
   set lat = excluded.lat,
       lng = excluded.lng,
       source = excluded.source,
       updated_at = now();
