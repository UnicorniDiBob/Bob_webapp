# BOB — sito statico

Sito statico per [BOB](https://bob.meetonda.com), marketplace italiano che mette in contatto privati e professionisti locali.

## Stack

- HTML / CSS / JS statico (nessun build step).
- Hostato su GitHub Pages con dominio custom `bob.meetonda.com`.
- Form contatti via [Formspree](https://formspree.io/).

## Struttura

```
/
├── index.html                  Home (con chat wizard)
├── come-funziona.html
├── professionisti.html         (con form iscrizione professionista)
├── faq.html
├── contatti.html               (con form + chat)
├── 404.html
├── servizi/                    11 pagine categoria, ciascuna con form lead
├── citta/                      3 pagine città, ciascuna con form lead
├── assets/
│   ├── styles.css
│   ├── main.js                 chat + form + menu
│   ├── favicon.svg
│   └── logo.svg
├── robots.txt
├── sitemap.xml
├── CNAME                       bob.meetonda.com
├── .nojekyll
└── .github/workflows/pages.yml
```

## ⚠️ Configurazione Formspree (richiesto)

I form al momento puntano al placeholder `https://formspree.io/f/REPLACE_WITH_YOUR_ID`.
Per attivarli:

1. Vai su [formspree.io](https://formspree.io) e crea un account gratuito (50 invii/mese).
2. Crea un nuovo form e copia il suo endpoint (es. `https://formspree.io/f/xyzabc123`).
3. Sostituisci la stringa `REPLACE_WITH_YOUR_ID` in tutti i file HTML:
   ```bash
   grep -rl "REPLACE_WITH_YOUR_ID" . --include="*.html" \
     | xargs sed -i '' 's|REPLACE_WITH_YOUR_ID|xyzabc123|g'
   ```
4. Commit e push.

Tutti i form inviano a `_subject` un titolo identificativo (es. "Richiesta Idraulico — BOB"),
così riconosci da dove arriva il lead direttamente nell'oggetto email.

## Sviluppo locale

```bash
python3 -m http.server 8000
# poi http://localhost:8000
```

## Deploy

Il deploy è automatico su `main`:

1. Push o merge su `main`.
2. Il workflow `.github/workflows/pages.yml` carica tutta la cartella su GitHub Pages.
3. Il file `CNAME` punta GitHub Pages a `bob.meetonda.com`.

Per il primo deploy, in **Settings → Pages**:

- **Source**: GitHub Actions.
- **Custom domain**: `bob.meetonda.com` (già impostato via `CNAME`).
- **Enforce HTTPS**: attivo.

DNS sul dominio `meetonda.com`:

```
CNAME    bob    andreatonda.github.io.
```

## Aggiungere una nuova categoria di servizio

Le pagine sono generate da `build_pages.py` (nella radice del progetto principale).
Per aggiungere una categoria:

1. Aggiungi una voce al dizionario `services` in `build_pages.py` con `name`, `title`, `desc`, `h1`, `subline`, `intro`, `examples`, `price_hint`, `faq`.
2. Aggiungi le keyword di matching nell'array `services` dentro `assets/main.js` (chat wizard).
3. Riesegui `python3 build_pages.py`.
4. Aggiungi un link nel footer di `build_pages.py`.

## SEO

Vedi [SEO.md](./SEO.md) per la guida completa sul monitoraggio del ranking organico.
