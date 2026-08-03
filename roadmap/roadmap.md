# BOB — Roadmap

_Generato automaticamente da `roadmap.csv` — non modificare a mano. Aggiorna il CSV e rilancia `build_roadmap.py` (o lascia fare alla GitHub Action)._

**Stato:** ✅ 76 Done · 🔵 2 In progress · ⬜ 76 Planned · 🔶 4 Milestone

**Track:** Client/Pro → André · Internal → Lucio · Shared


## WEBSITE — CORE BUILD (DEMO)  ·  Jun–Jul 2026

| # | Task | Track | Owner | Stato | Periodo | Done on |
|---|------|-------|-------|-------|---------|---------|
| **1** | **Webapp MVP — Next.js 14 + Supabase marketplace** | Client/Pro | André | ✅ Done | 2026-06-01 → 2026-06-15 | 2026-06-03 |
| 1.1 | Project setup, Vercel deploy pipeline, Supabase schema + RLS | Client/Pro | André | ✅ Done | 2026-06-01 → 2026-06-05 | 2026-06-03 |
| 1.2 | Real auth + separate client / pro personal areas | Client/Pro | André | ✅ Done | 2026-06-01 → 2026-06-10 | 2026-06-03 |
| 1.3 | City pages (Milano live; Roma, Torino prepared) + 15 service categories | Client/Pro | André | ✅ Done | 2026-06-05 → 2026-06-15 | 2026-06-03 |
| **2** | **AI concierge chat (Claude Haiku + rules fallback)** | Client/Pro | André | ✅ Done | 2026-06-01 → 2026-06-15 | 2026-06-03 |
| 2.1 | Problem understanding via LLM with rules fallback | Client/Pro | André | ✅ Done | 2026-06-01 → 2026-06-10 | 2026-06-03 |
| 2.2 | Optional budget + multi-pro quote requests from chat | Client/Pro | André | ✅ Done | 2026-06-05 → 2026-06-15 | 2026-06-03 |
| **3** | **Messaging + pro dashboard** | Client/Pro | André | ✅ Done | 2026-06-01 → 2026-06-15 | 2026-06-03 |
| 3.1 | Bidirectional client-pro messaging | Client/Pro | André | ✅ Done | 2026-06-01 → 2026-06-10 | 2026-06-03 |
| 3.2 | Pro dashboard: calendar, hours, earnings | Client/Pro | André | ✅ Done | 2026-06-05 → 2026-06-15 | 2026-06-03 |
| 3.3 | Unread message badges in header (desktop + mobile) | Client/Pro | André | ✅ Done | 2026-06-10 → 2026-06-15 | 2026-06-03 |
| 3.4 | Pro calendar v2: hour-axis week/day view, blocks sized by duration, overlap columns, appointment detail panel | Client/Pro | André | ✅ Done | 2026-07-28 → 2026-07-28 | 2026-07-28 |
| 3.5 | Appointment location (mig 031 snapshot) + Giro del giorno itinerary with Maps links; address captured in direct booking | Client/Pro | André | ✅ Done | 2026-07-28 → 2026-07-28 | 2026-07-28 |
| **4** | **Chat v2 + client memory + job brief** | Client/Pro | André | ✅ Done | 2026-06-05 → 2026-07-08 | 2026-07-08 |
| 4.1 | F1 agentic chat, F2 customer memory, F3 pro request summary | Client/Pro | André | ✅ Done | 2026-06-05 → 2026-06-30 | 2026-06-09 |
| 4.2 | Job brief v1: tool-use extraction, photo vision, recap card, subtask taxonomy | Client/Pro | André | ✅ Done | 2026-07-01 → 2026-07-08 | 2026-07-08 |
| **5** | **Admin panel** | Internal | André | ✅ Done | 2026-06-28 → 2026-07-05 | 2026-07-04 |
| 5.1 | Pro verification, users management, CS accounts + roles | Internal | André | ✅ Done | 2026-06-28 → 2026-06-30 | 2026-06-28 |
| 5.2 | Delete users (cascade) + team invitations via email | Internal | André | ✅ Done | 2026-07-01 → 2026-07-05 | 2026-07-04 |
| **6** | **Technical SEO foundation** | Client/Pro | André | ✅ Done | 2026-07-01 → 2026-07-05 | 2026-07-04 |
| 6.1 | Sitemap, robots.txt, JSON-LD structured data, optimized metadata | Client/Pro | André | ✅ Done | 2026-07-01 → 2026-07-05 | 2026-07-04 |
| **7** | **Pro portfolio with tier gating + reviews + self-service profile** | Client/Pro | André | ✅ Done | 2026-07-01 → 2026-07-11 | 2026-07-11 |
| 7.1 | Portfolio items + storage bucket + tier limits (Free/Pro/Business) | Client/Pro | André | ✅ Done | 2026-07-01 → 2026-07-04 | 2026-07-04 |
| 7.2 | Reviews: request close + ReviewDialog with RLS constraints (mig 015) | Client/Pro | André | ✅ Done | 2026-07-08 → 2026-07-11 | 2026-07-11 |
| 7.3 | Pro self-service profile /dashboard/profilo (mig 016) | Client/Pro | André | ✅ Done | 2026-07-09 → 2026-07-11 | 2026-07-11 |
| **7b** | **Migrations backfill 001-017, CI (build+lint), RLS performance cleanup (018)** | Shared | Claude | ✅ Done | 2026-07-16 → 2026-07-16 | 2026-07-16 |

## CLIENT & PRO EXPERIENCE OVERHAUL  ·  Jul 2026  (journey-map audit → build)

| # | Task | Track | Owner | Stato | Periodo | Done on |
|---|------|-------|-------|-------|---------|---------|
| **8** | **Client & pro journey audit + UX gap analysis** | Client/Pro | Claude | ✅ Done | 2026-07-17 → 2026-07-17 | 2026-07-17 |
| 8.0 | Full code+live audit, journey maps, prioritized gap list (Word doc) | Client/Pro | Claude | ✅ Done | 2026-07-17 → 2026-07-17 | 2026-07-17 |
| **8.1** | **Bob chat: draft persistence + returnTo login + inline city waitlist** | Client/Pro | André | ✅ Done | 2026-07-17 → 2026-07-17 | 2026-07-17 |
| **8.2** | **Client journey st.1/3/5/6/7** | Client/Pro | André | ✅ Done | 2026-07-17 → 2026-07-17 | 2026-07-17 |
| 8.2a | Header Bob CTA for clients, clickable coming-soon cities | Client/Pro | André | ✅ Done | 2026-07-17 → 2026-07-17 | 2026-07-17 |
| 8.2b | Why-this-pro line, realtime messages (mig 019), URL sync, quote_request label | Client/Pro | André | ✅ Done | 2026-07-17 → 2026-07-17 | 2026-07-17 |
| 8.2c | Close-request dialog, customer memory wired, client account page | Client/Pro | André | ✅ Done | 2026-07-17 → 2026-07-17 | 2026-07-17 |
| **8.3** | **Account v2 + saved addresses** | Client/Pro | André | ✅ Done | 2026-07-17 → 2026-07-17 | 2026-07-17 |
| 8.3a | Saved addresses (mig 020) + Bob address chips at city step | Client/Pro | André | ✅ Done | 2026-07-17 → 2026-07-17 | 2026-07-17 |
| 8.3b | Old-password check, self-service email change, floating messages bubble | Client/Pro | André | ✅ Done | 2026-07-17 → 2026-07-17 | 2026-07-17 |
| **8.4** | **Role-aware navigation + pro acquisition banner** | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 8.4a | Header nav client-only; unified Account button | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 8.4b | Pre-footer pro banner (guests, public pages) | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| **8.5** | **Client dashboard v2 + shared appointments** | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 8.5a | Attention strip, job timelines, trusted pros, collapsed history | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 8.5b | Shared appointments (mig 021): pro proposes from chat, client confirms | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| **8.6** | **Per-pro message threads + quote comparison (stage 4)** | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 8.6a | Thread per request-pro pair (mig 022), tightened RLS (no cross-pro leak) | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 8.6b | Quote comparison in client dashboard; Bob brief + photos attached to request | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| **8.7** | **Appointment negotiation v2** | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-19 | 2026-07-19 |
| 8.7a | Free-slot engine; pro quick-pick slots + double-booking guard | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 8.7b | Client counter-proposal within pro free slots (mig 023); Europe/Rome tz fix | Client/Pro | André | ✅ Done | 2026-07-18 → 2026-07-19 | 2026-07-19 |
| **8.8** | **Mobile overflow fix (base grid-cols-1 on responsive grids)** | Client/Pro | André | ✅ Done | 2026-07-19 → 2026-07-19 | 2026-07-19 |

## ANALYTICS, ADMIN & PRIVACY  ·  Jul 2026

| # | Task | Track | Owner | Stato | Periodo | Done on |
|---|------|-------|-------|-------|---------|---------|
| **9** | **Admin overview / Analisi dashboard** | Internal | Lucio | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 9.1 | KPI dashboard + signup age/terms + city geo hierarchy (mig 024) | Internal | Lucio | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 9.2 | Analisi: unified filters, subscription-tier events (mig 025), 2 new indicators | Internal | Lucio | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 9.3 | Analisi UI redesign, Excel export, cancellations view | Internal | Lucio | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| 9.4 | 'Ricerche per categoria' anonymous search events (mig 026); staff redirect | Internal | Lucio | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| **25b** | **Privacy: birth date + terms consent moved to private table (mig 027)** | Internal | Lucio | ✅ Done | 2026-07-18 → 2026-07-18 | 2026-07-18 |
| **T1** | **Roadmap tracker automation: CSV source + generator + Markdown + GitHub Action** | Shared | André | ✅ Done | 2026-07-19 → 2026-07-19 | 2026-07-19 |

## DIRECT BOOKING & PAYMENTS GROUNDWORK  ·  Jul 2026

| # | Task | Track | Owner | Stato | Periodo | Done on |
|---|------|-------|-------|-------|---------|---------|
| **IB** | **Direct (instant) booking Phase 0 — instant vs preventivo; customer flow gated on Stripe (2027)** | Client/Pro | Claude | ✅ Done | 2026-07-19 → 2026-07-19 | 2026-07-19 |
| IB.1 | Schema + enablement trigger + RLS (mig 028); 20 eligible subservices seeded (mig 029) | Client/Pro | Claude | ✅ Done | 2026-07-19 → 2026-07-19 | 2026-07-19 |
| IB.2 | Pro config UI: per-service rate/unit/min/slot/cancellation + enable toggle (tier-gated) | Client/Pro | Claude | ✅ Done | 2026-07-19 → 2026-07-19 | 2026-07-19 |
| IB.3 | Admin catalog curation (/admin/catalogo) + pro weekly availability editor | Client/Pro | Claude | ✅ Done | 2026-07-19 → 2026-07-19 | 2026-07-19 |
| **PG** | **Payments/subscriptions groundwork — BUILT, DORMANT (activates with Stripe, 2027) [mig 030]** | Shared | Claude | ✅ Done | 2026-07-19 → 2026-07-19 | 2026-07-19 |

## WEBSITE — REMAINING TO GO-LIVE  ·  Aug–Dec 2026

| # | Task | Track | Owner | Stato | Periodo | Done on |
|---|------|-------|-------|-------|---------|---------|
| **8.9** | **Empty / error / loading states + server-side validation pass** | Client/Pro | André | ⬜ Planned | 2026-08-15 → 2026-09-30 |  |
| **10** | **Automated pro verification + verified badge (levels Iscritto/Pro/Pro+)** | Client/Pro | Lucio | 🔵 In progress | 2026-07-19 → 2026-10-31 |  |
| 10.0 | Research: VIES insufficiente, AdE senza API; provider commerciale + DAC7 (docs/legal) | Internal | Lucio | ✅ Done | 2026-07-19 → 2026-07-19 | 2026-07-19 |
| 10.1a | Schema verifica (mig 029) + checksum P.IVA lib/vat.ts con test | Internal | Lucio | ✅ Done | 2026-07-30 → 2026-07-30 | 2026-07-30 |
| 10.1b | Gradino 3 via Openapi: stato+denominazione 2-5 centesimi a professionista (listino 01/08), PEC impresa 3 cent. Sandbox gratuita; serve DPA art.28 | Shared | Lucio | ⬜ Planned | 2026-09-01 → 2026-10-15 |  |
| 10.1c | Client VIES + route /api/pro/verifica-piva: tre gradini, limite 3/24h, mai un rifiuto automatico | Internal | Lucio | ✅ Done | 2026-07-31 → 2026-07-31 | 2026-07-31 |
| 10.1d | UI verifica nel profilo pro + badge pubblico Iscritto/Pro/Pro+ con data e tooltip (profilo, card, chat) [mig 038] | Client/Pro | Lucio | ✅ Done | 2026-08-01 → 2026-08-01 | 2026-08-01 |
| 10.1e | Coda verifiche in admin: concedi / chiedi documenti / rifiuta con motivazione obbligatoria + email di esito | Internal | Lucio | ✅ Done | 2026-08-01 → 2026-08-01 | 2026-08-01 |
| 10.1f | Antifrode: livello automatico solo se l'intestazione combacia col nome; una P.IVA per un solo profilo [mig 039] | Internal | Lucio | ✅ Done | 2026-08-01 → 2026-08-01 | 2026-08-01 |
| 10.1g | Firma delle decisioni (chi, ruolo, quando) + registro consultabile dalla coda admin [mig 040] | Internal | Lucio | ✅ Done | 2026-08-01 → 2026-08-01 | 2026-08-01 |
| 10.1h | Scorciatoie operatore: copia P.IVA e apri il servizio dell'Agenzia, scheda copiabile, modelli di motivazione | Internal | Lucio | ✅ Done | 2026-08-01 → 2026-08-01 | 2026-08-01 |
| 10.4a | Riga in piccolo sul profilo pubblico: quando e' stata fatta la verifica e che vale per quella data (provvisorio) | Client/Pro | Lucio | ✅ Done | 2026-08-01 → 2026-08-01 | 2026-08-01 |
| 10.4 | Scadenza della verifica (proposta 6 mesi) + ricontrollo periodico con declassamento assistito, mai automatico | Internal | Lucio | ⬜ Planned | 2026-08-04 → 2026-08-12 |  |
| 10.5 | Ritentativo notturno (cron Vercel, 22:00 UTC = mezzanotte italiana) dei casi senza risposta dal VIES; concede solo col riscontro pieno | Internal | Lucio | ✅ Done | 2026-08-01 → 2026-08-01 | 2026-08-01 |
| 10.6a | Campo 'nome completo dell''azienda' nella card di verifica, usato come secondo termine di confronto (mig 041) | Client/Pro | Lucio | ✅ Done | 2026-08-02 → 2026-08-02 | 2026-08-02 |
| 10.6 | Confronto nomi stretto (2 parole + 60% di copertura, o una parola specifica) provato su 12 casi; un solo passaggio contro tutti i nomi noti, con traccia di quale ha deciso [mig 042] | Internal | Lucio | ✅ Done | 2026-08-03 → 2026-08-03 | 2026-08-03 |
| 10.7 | Telemetria in /admin/analisi: quanti tentano, quanti conferma il VIES, quanti finiscono a mano, tempi di lavorazione | Internal | Lucio | ⬜ Planned | 2026-08-08 → 2026-08-22 |  |
| 10.8a | Avviso discreto nella dashboard pro con i vantaggi + badge del livello al posto del vecchio stato staff; prezzo pronto in una costante | Client/Pro | Lucio | ✅ Done | 2026-08-01 → 2026-08-01 | 2026-08-01 |
| 10.8 | Richiesta della P.IVA come ultimo passo dell'onboarding professionista | Client/Pro | Lucio | ⬜ Planned | 2026-08-11 → 2026-08-25 |  |
| 10.9 | Casi limite: P.IVA sospesa per affitto d'azienda, Gruppo IVA, cessata + raccolta codice fiscale (base per DAC7) | Internal | Lucio | ⬜ Planned | 2026-09-01 → 2026-09-20 |  |
| 10.13 | Registro verifiche: pagina dedicata con filtri (professionista, tipo evento, periodo, operatore), paginazione ed export CSV. Oggi in coda si vedono solo gli ultimi 100 movimenti | Internal | Lucio | ⬜ Planned | 2026-09-08 → 2026-09-25 |  |
| 10.14 | PRIMA DI TUTTO: push dei commit di ieri, CRON_SECRET tra le variabili Vercel e controllo che il ritentativo notturno sia partito (senza il segreto la route resta spenta) | Shared | Lucio | ⬜ Planned | 2026-08-03 → 2026-08-03 |  |
| 10.12 | URGENTE: societa' in liquidazione/A.S./LCA hanno P.IVA ATTIVA e il VIES le conferma (provato su Alitalia, BPVi, Veneto Banca). Intercettare la dicitura nella denominazione e mandare in coda invece di concedere | Internal | Lucio | ⬜ Planned | 2026-08-03 → 2026-08-04 |  |
| 10.10 | Adempimenti: riga nel registro trattamenti, informativa privacy, retention di vat_check_payload, ToS (una P.IVA per profilo, durata) | Shared | Lucio | ⬜ Planned | 2026-08-04 → 2026-08-29 |  |
| 10.11 | DECISIONE: cosa sblocca il livello — categorie con gate al contatto, durata, peso nel ranking, cosa puo' fare un Iscritto (doc §6) | Shared | Lucio | 🔶 Milestone | 2026-08-08 → 2026-08-08 |  |
| 10.2 | Caricamento documenti per il livello Pro+ (upload, storage, retention, RLS). Priorita' salita: 'chiedi documenti' ora e' un'azione vera ma il pro non ha dove caricarli | Internal | Lucio | ⬜ Planned | 2026-08-24 → 2026-09-30 |  |
| 10.3 | Il livello pesa nel ranking (parametri dichiarati, Reg. P2B) + SLA 48h sulla coda | Client/Pro | Lucio | ⬜ Planned | 2026-10-01 → 2026-10-31 |  |
| **11** | **Transparent ranking + Visibility Boost** | Client/Pro | André | ⬜ Planned | 2026-10-01 → 2026-11-30 |  |
| 11.1 | Ranking algorithm v1: response rate, closure rate, reviews (data logic) | Internal | Lucio | ⬜ Planned | 2026-10-01 → 2026-10-31 |  |
| 11.2 | Ranking explanation UI (seeded by 'why this pro' line) | Client/Pro | André | ⬜ Planned | 2026-10-15 → 2026-11-15 |  |
| 11.3 | Boost purchase + placement logic; quality floor | Client/Pro | André | ⬜ Planned | 2026-11-01 → 2026-11-30 |  |
| **12** | **Stripe billing — Pro EUR24/19, Business EUR59/49** | Client/Pro | André | ⬜ Planned | 2026-10-01 → 2026-12-31 |  |
| 12.1 | Stripe products & prices; checkout + customer portal | Client/Pro | André | ⬜ Planned | 2026-10-01 → 2026-11-30 |  |
| 12.2 | Webhooks -> subscription_tier sync (replaces manual switch) | Shared | André | ⬜ Planned | 2026-11-01 → 2026-11-30 |  |
| 12.3 | Founding-pro coupon; failed payments, invoices, receipts | Client/Pro | André | ⬜ Planned | 2026-11-15 → 2026-12-31 |  |
| **13** | **SEO content engine (ongoing)** | Client/Pro | André | 🔵 In progress | 2026-08-01 → 2027-12-31 |  |
| 13.1 | Keyword plan from Semrush data | Client/Pro | André | ✅ Done | 2026-07-01 → 2026-07-05 | 2026-07-05 |
| 13.2 | City x service page template + Milano core categories | Client/Pro | André | ⬜ Planned | 2026-08-01 → 2026-10-31 |  |
| 13.3 | 'Quanto costa' price guides; Roma+Torino pages before activation | Client/Pro | André | ⬜ Planned | 2026-10-01 → 2027-03-31 |  |
| **14** | **Google Business Profile + local presence** | Shared |  | ⬜ Planned | 2026-11-01 → 2026-12-31 |  |
| **15** | **Launch hardening** | Shared |  | ⬜ Planned | 2026-12-01 → 2026-12-31 |  |
| 15.1 | End-to-end QA of all flows (client, pro, admin) | Shared |  | ⬜ Planned | 2026-12-01 → 2026-12-15 |  |
| 15.2 | Performance / Core Web Vitals pass | Client/Pro | André | ⬜ Planned | 2026-12-01 → 2026-12-20 |  |
| 15.3 | Freelance security review (pre-launch) | Shared |  | ⬜ Planned | 2026-12-01 → 2026-12-20 |  |
| 15.4 | Activate email notifications (Resend): account, DNS/DKIM, env vars, deliverability test | Client/Pro | André | ⬜ Planned | 2026-12-01 → 2026-12-20 |  |
| 15.5 | Error monitoring, uptime alerts, backups; go-live checklist + rollback | Internal | Lucio | ⬜ Planned | 2026-12-10 → 2026-12-31 |  |
| **Bx** | **Email notifications pipeline — BUILT, DORMANT (activates with RESEND_API_KEY)** | Client/Pro | André | ✅ Done | 2026-07-19 → 2026-07-19 | 2026-07-19 |

## LAUNCH & YEAR-1 PRODUCT  ·  2027

| # | Task | Track | Owner | Stato | Periodo | Done on |
|---|------|-------|-------|-------|---------|---------|
| **16** | **GO-LIVE — Milano pilot** | Shared |  | 🔶 Milestone | 2027-01-01 → 2027-01-31 |  |
| 16.1 | Production cutover; activate founding pros (60-80) in 5 core categories | Shared |  | ⬜ Planned | 2027-01-01 → 2027-01-31 |  |
| 16.2 | Bob Pro subscriptions live (Stripe) + Boost on; launch PR wave | Shared |  | ⬜ Planned | 2027-01-01 → 2027-01-31 |  |
| **17** | **Unlimited requests (subscribers) + digital quotes** | Client/Pro | André | ⬜ Planned | 2027-03-01 → 2027-06-30 |  |
| 17.1 | Free-tier request limits + upgrade paywall | Client/Pro | André | ⬜ Planned | 2027-03-01 → 2027-04-15 |  |
| 17.2 | Quote builder for pros + client quote comparison + accept flow | Client/Pro | André | ⬜ Planned | 2027-04-01 → 2027-06-30 |  |
| **18** | **Security audit (gate before payments)** | Shared |  | ⬜ Planned | 2027-06-01 → 2027-07-31 |  |
| **19** | **Protected flow — payments + Garanzia Bob** | Client/Pro | André | ⬜ Planned | 2027-07-01 → 2027-12-31 |  |
| 19.1 | Stripe Connect: deposit/escrow, payouts; dispute + mediation tooling | Client/Pro | André | ⬜ Planned | 2027-07-01 → 2027-10-31 |  |
| 19.2 | Verified reviews tied to protected jobs; 8% success fee billing | Client/Pro | André | ⬜ Planned | 2027-09-15 → 2027-11-15 |  |
| **20** | **Roma + Torino activation** | Shared |  | ⬜ Planned | 2027-04-01 → 2027-06-30 |  |
| **21** | **Bologna, Firenze, Napoli activation** | Shared |  | ⬜ Planned | 2027-07-01 → 2027-12-31 |  |
| **22** | **National infrastructural opening (organic only)** | Shared |  | ⬜ Planned | 2027-10-01 → 2027-12-31 |  |

## LEGAL & BUREAUCRACY

| # | Task | Track | Owner | Stato | Periodo | Done on |
|---|------|-------|-------|-------|---------|---------|
| **23** | **Site legal docs (ToS, privacy, cookie + consent banner) + lawyer review** | Shared |  | ⬜ Planned | 2026-09-01 → 2026-11-30 |  |
| **24** | **Trademark 'Bob' (UIBM/EUIPO, classes 35, 42)** | Shared |  | ⬜ Planned | 2026-09-01 → 2026-10-31 |  |
| **25** | **GDPR full compliance** | Shared |  | ⬜ Planned | 2026-11-01 → 2027-01-31 |  |
| 25.1 | Registro trattamenti + retention policy; consent flows audit; breach procedure | Internal | Lucio | ⬜ Planned | 2026-11-01 → 2027-01-31 |  |
| 25.2 | DPAs with processors (Supabase, Vercel, Anthropic, Stripe, Resend) | Shared |  | ⬜ Planned | 2026-11-15 → 2026-12-31 |  |
| **26** | **SRL incorporation (Q1 Year 1)** | Shared |  | ⬜ Planned | 2026-12-01 → 2027-02-28 |  |
| **27** | **Finanza agevolata application (Q2 Year 1)** | Shared |  | ⬜ Planned | 2027-04-01 → 2027-06-30 |  |
| **28** | **Garanzia Bob legal framework + payments compliance (Stripe Connect KYC)** | Shared |  | ⬜ Planned | 2027-05-01 → 2027-09-30 |  |

## GO-TO-MARKET & MARKETING

| # | Task | Track | Owner | Stato | Periodo | Done on |
|---|------|-------|-------|-------|---------|---------|
| **30** | **Founder outreach — first 100 Milano pros** | Shared |  | ⬜ Planned | 2026-10-01 → 2027-03-31 |  |
| **31** | **Launch incentives (3 months free Bob Pro for founding pros)** | Shared |  | ⬜ Planned | 2027-01-01 → 2027-03-31 |  |
| **32** | **Paid ads ignition — Milano only (CAC < EUR25 Q1)** | Shared |  | ⬜ Planned | 2027-01-01 → 2027-06-30 |  |
| **33** | **PR launch ('AI concierge che trova il professionista giusto con prezzi chiari')** | Shared |  | ⬜ Planned | 2027-01-01 → 2027-03-31 |  |
| **34** | **Pro referral program + territorial partnerships** | Shared |  | ⬜ Planned | 2027-03-01 → 2027-12-31 |  |

## KPI GATES  (decision checkpoints)

| # | Task | Track | Owner | Stato | Periodo | Done on |
|---|------|-------|-------|-------|---------|---------|
| **36** | **End-Q1 2027: 60-80 active pros, 150+ req/mo, match >60%** | Internal | Lucio | 🔶 Milestone | 2027-03-01 → 2027-03-31 |  |
| **37** | **End-2027: 600 pros, 1,500 req/mo, 25% protected-flow, CAC < EUR15** | Internal | Lucio | 🔶 Milestone | 2027-12-01 → 2027-12-31 |  |

## ROADMAP CANDIDATES — POST-LAUNCH EXPANSION  ·  2027  (added 2026-07-26 · to validate)

| # | Task | Track | Owner | Stato | Periodo | Done on |
|---|------|-------|-------|-------|---------|---------|
| **38** | **Business accounts — multi-employee organizations (manage workers + appointments)** | Client/Pro | André | ⬜ Planned | 2026-09-01 → 2027-04-30 |  |
| 38.0 | Design spike: org data model — DECIDED, see docs/Bob_Business_Accounts_Design_Spike.md (Bundle 2, additive; workers-as-records; company assigns) | Shared | André | ⬜ Planned | 2026-09-01 → 2026-10-15 |  |
| 38.1 | organizations + organization_members + roles (owner/admin/worker); RLS pool model via is_org_member(); retention + deletion path | Client/Pro | André | ⬜ Planned | 2027-02-01 → 2027-02-28 |  |
| 38.2a | Worker-level scheduling: per-worker availability + assignment + DB overlap constraint (btree_gist exclude); company assigns | Client/Pro | André | ⬜ Planned | 2027-03-01 → 2027-03-31 |  |
| 38.2b | Communication step 1 (office-as-hub): company identity + worker attribution (sender_member_id); dispatcher messages/reschedules for worker | Client/Pro | André | ⬜ Planned | 2027-03-15 → 2027-04-15 |  |
| 38.3 | Business onboarding + docs: company VAT/visura verification, seat management (extends #10) | Internal | Lucio | ⬜ Planned | 2027-03-01 → 2027-03-31 |  |
| 38.4 | Multi-seat Business billing — per-seat via Stripe quantity (extends #12) | Client/Pro | André | ⬜ Planned | 2027-04-01 → 2027-04-30 |  |
| 38.5 | Compliance: employer-as-controller DPA + RoPA rows; Platform Work Directive / Annex III scope check | Shared | Lucio | ⬜ Planned | 2027-02-01 → 2027-02-28 |  |
| 38.6 | Step 2 (PILOT-GATED, form TBD): scoped worker access — per-job magic link or limited login; least-privilege RLS | Client/Pro | André | ⬜ Planned | 2027-05-01 → 2027-06-30 |  |
| **39** | **Two-way reviews — business to client reliability signal (PRIVATE, not public consumer scores)** | Client/Pro | André | ⬜ Planned | 2027-06-01 → 2027-08-31 |  |
| 39.0 | DPIA + LIA + policy: private reliability signal; retaliation guard; Art 22 no auto-exclude; transparency + right to object | Shared | Lucio | ⬜ Planned | 2027-06-01 → 2027-06-30 |  |
| 39.1 | Schema: customer reliability ratings tied to completed appointment/request; RLS; de-identify on deletion | Client/Pro | André | ⬜ Planned | 2027-07-01 → 2027-07-31 |  |
| 39.2 | Pro UI to rate reliability; customer transparency + right-to-reply; align with verified reviews #19.2 | Client/Pro | André | ⬜ Planned | 2027-08-01 → 2027-08-31 |  |
| **40** | **Parking & vehicle-access metric (can my car reach the address? parking nearby?)** | Client/Pro | André | ⬜ Planned | 2027-03-01 → 2027-05-31 |  |
| 40.0 | Address geocoding enabler (address to coarse zone; maps vendor DPA/EU) — prerequisite | Client/Pro | André | ⬜ Planned | 2027-03-01 → 2027-03-31 |  |
| 40.1 | ZTL / Area B & C vehicle-access checker (vehicle emission class + Milan zone rules) — deterministic, high value for out-of-town pros | Client/Pro | André | ⬜ Planned | 2027-04-01 → 2027-04-30 |  |
| 40.2 | Parking-difficulty index + nearby paid-garage links (research spike first; real-time free-spot count not feasible) | Client/Pro | André | ⬜ Planned | 2027-05-01 → 2027-05-31 |  |
| 40.3 | Map of the day itinerary in the pro calendar (pins in time order) — depends on 40.0 geocoding + vendor DPA | Client/Pro | André | ⬜ Planned | 2027-04-01 → 2027-04-30 |  |
| **41** | **Customer address: progressive disclosure fix (today the exact address sits in clear text in requests.problem_description, readable by every pro in the quote batch before acceptance)** | Client/Pro | André | ⬜ Planned | 2026-08-01 → 2026-09-30 |  |
| 41.1 | Stop concatenating the address into requests.problem_description / request_messages (QuoteDialog, RequestDialog); structured column gated on acceptance | Client/Pro | André | ⬜ Planned | 2026-08-01 → 2026-08-31 |  |
| 41.2 | Strip addresses from the /api/pro/request-summary LLM prompt (DATA_COMPLIANCE §2 minimization) | Client/Pro | André | ⬜ Planned | 2026-08-01 → 2026-08-31 |  |
| 41.3 | Backfill existing rows + ROPA/notice update; commit DATA_COMPLIANCE.md into the repo (cited in-repo but untracked) | Shared | Lucio | ⬜ Planned | 2026-09-01 → 2026-09-30 |  |
