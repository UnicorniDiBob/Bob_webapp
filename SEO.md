# SEO & monitoraggio ranking di BOB

Guida pratica per misurare come il sito sta performando organicamente.

## 1. Setup base (da fare subito, costo zero)

### Google Search Console (la cosa più importante)
È lo strumento ufficiale di Google: ti dice **quali query portano traffico**, **in che posizione media** sei, **quante impression e click** generi e **quali pagine sono indicizzate**.

1. Vai su [search.google.com/search-console](https://search.google.com/search-console).
2. Aggiungi una property di tipo "Dominio": inserisci `meetonda.com` (copre anche `bob.meetonda.com`).
3. Verifica via record DNS TXT (consigliato) o HTML tag nel head del sito.
4. Una volta verificato, in **Sitemaps** aggiungi: `https://bob.meetonda.com/sitemap.xml`.
5. Aspetta 3–7 giorni perché Google scopra e indicizzi le pagine.

Cosa guardare ogni settimana:
- **Prestazioni → Query**: parole con cui ti trovano, click, impression, CTR, posizione media.
- **Indicizzazione → Pagine**: quante pagine sono indicizzate vs escluse e perché.
- **Esperienza → Core Web Vitals**: velocità su mobile (dovremmo essere già ottimi essendo statici).

### Bing Webmaster Tools (gratis, spesso ignorato)
Bing pesa il 5–10% delle ricerche in Italia ma è facile da posizionare.
1. [bing.com/webmasters](https://www.bing.com/webmasters).
2. Importa direttamente i dati da Google Search Console (un click).

### Google Analytics 4 o alternativa privacy-friendly
Per vedere **cosa fanno gli utenti** sul sito.

| Strumento | Costo | Pro | Contro |
|---|---|---|---|
| **Google Analytics 4** | Gratis | Standard di settore, integrato con Search Console | Pesante, serve cookie banner GDPR |
| **Plausible** | ~9€/mese | Privacy-friendly, no cookie, leggero, dashboard semplice | A pagamento |
| **Umami** | Gratis (self-hosted) | Privacy-friendly, open source | Serve un server o Vercel |
| **Cloudflare Web Analytics** | Gratis | No cookie, no script lento | Meno dettagliato |

**Raccomandazione per BOB:** parti con **Plausible** se vuoi privacy-by-design da subito (BOB ha utenti italiani, GDPR conta), oppure **Cloudflare Web Analytics** se vuoi proprio zero costi e zero cookie banner.

## 2. Cosa misurare (le 5 metriche che contano)

1. **Impression organiche** (Search Console) — quante volte BOB appare nei risultati.
2. **Click organici** — quante persone cliccano su BOB.
3. **CTR organico** — click ÷ impression. Sotto al 2% c'è un problema di title/description.
4. **Posizione media per query** — vuoi posizione < 10 (prima pagina) per le keyword strategiche.
5. **Pagine indicizzate / inviate** — su 19 URL nel sitemap, vuoi vederne 18-19 indicizzate.

## 3. Keyword da monitorare (priorità per BOB)

Ho impostato le pagine per coprire intent **categoria + città**. Le query da tenere d'occhio in Search Console:

**Top priority (alta concorrenza, ma traffico enorme):**
- "idraulico Milano", "idraulico Roma", "idraulico Torino"
- "elettricista Milano" + Roma + Torino
- "imprese di pulizie Milano" + Roma + Torino
- "imbianchino Milano" + Roma + Torino
- "trasloco Milano" + Roma + Torino

**Long-tail (concorrenza minore, intent altissimo):**
- "idraulico pronto intervento Milano"
- "elettricista urgente Roma"
- "pulizie post-trasloco Milano"
- "DJ matrimonio Torino"
- "personal trainer a casa Milano"
- "ripetizioni matematica Roma"

**Brand:**
- "BOB marketplace", "BOB professionisti", "meetonda" — assicurati che si arrivi sempre alla home.

## 4. Strumenti gratuiti per il ranking tracking

### Tool "fai tutto in uno" (free tier)

| Tool | Free tier | Cosa usa |
|---|---|---|
| **Ubersuggest** (Neil Patel) | 3 ricerche/giorno | Volume keyword + difficoltà + ranking |
| **Google Keyword Planner** | Gratis con account Google Ads | Volumi di ricerca italiani |
| **AnswerThePublic** | 3 ricerche/giorno | Trova domande reali degli utenti |
| **Google Trends** | Gratis | Stagionalità per categoria (es. condizionatori in estate) |
| **SEOmator / SE Ranking** | Trial 14gg | Ranking tracker quotidiano |

### Tracking manuale (gratis, ma serve disciplina)
Crea un foglio Google Sheets con:
| Keyword | Pagina target | Posizione settimana 1 | Posizione settimana 2 | … |
|---|---|---|---|---|
| idraulico Milano | /servizi/idraulico.html | — | — | … |

Controlla manualmente in incognito ogni settimana (oppure usa **SerpRobot** o **Whatsmyserp**, free tier).

## 5. Quick wins SEO per i prossimi 30 giorni

Cose che muovono davvero l'ago, in ordine di impatto:

1. **Verifica Search Console + invia sitemap** (oggi).
2. **Configura Google Business Profile** per ciascuna città in cui sei attivo. È il segnale #1 per il "local pack" su query tipo "idraulico Milano".
3. **Aggiungi schema.org `LocalBusiness`** alle pagine città (oggi hai solo `WebSite` e `FAQPage`).
4. **Backlink iniziali**: iscriviti a 5-10 directory italiane di qualità (PagineGialle, Yelp Italia, ProntoPro come listing, ecc.).
5. **Crea contenuto blog** su intent informazionale: "quanto costa un idraulico a Milano nel 2026", "5 cose da chiedere a un imbianchino prima di firmare". Sono pagine che catturano traffico in alto nel funnel.
6. **Recensioni**: appena hai i primi pro, raccogli recensioni su Google Business Profile. Ranking locale è guidato dalle recensioni.

## 6. Tempistica realistica

- **Settimana 1–2**: Google indicizza 70–90% delle pagine.
- **Mese 1–2**: prime impression su long-tail (es. "idraulico pronto intervento NoLo").
- **Mese 3–6**: posizionamento per keyword brand + qualche long-tail in top 10.
- **Mese 6–12**: posizioni decenti su keyword categoria+città medio-competitive (richiede backlink + GBP).

I marketplace di servizi sono **mercati ad alta competizione SEO** (ProntoPro, Cronoshare, Fiverr Pro, Helpling spendono milioni). La strategia vincente per BOB è:
- **Iperlocale e long-tail** (quartieri, zone, urgenze).
- **Velocità + struttura tecnica perfetta** (siamo a posto, sito statico).
- **Brand + community + recensioni** (più lento ma più difensivo).

## 7. Dashboard consigliata

Dopo 30 giorni dovresti avere:
- Search Console: dashboard "Prestazioni" salvata come bookmark.
- Plausible / GA4: dashboard "Pagine più viste" + "Sorgenti di traffico".
- Google Sheet con ranking settimanale per 15-20 keyword chiave.
- Alert Google Search Console attivi per errori di indicizzazione.

Con 30 minuti a settimana di review sei coperto.
