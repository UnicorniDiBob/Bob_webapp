# DATA_COMPLIANCE.md — Bob (meetonda.com)

**Engineering guideline for using user data in Bob features. Italy + EU rules (GDPR, Codice Privacy, ePrivacy, AI Act).**
Compiled 2026-07-18 from primary sources (Garante, EDPB, EUR-Lex, vendor DPAs). Practical-first: each section gives DO/DON'T rules with the legal citation behind them.

> ⚠️ This is engineering guidance, not legal advice. Before public launch of marketing at scale, AI matching, or paid features, have an Italian privacy lawyer review the privacy notice, ToS, and the DPIA.

---

## 0. Ground rules (apply to every feature)

- **Bob (the company) is the data controller** for accounts, matching, chat hosting, reviews, analytics, marketing. **A professional who receives a customer's data becomes an independent controller** for their own use of it (EDPB Guidelines 07/2020).
- **Every new feature that touches personal data needs, before shipping:** (1) a legal basis picked from the table below, (2) a line in the Records of Processing (ROPA), (3) a privacy-notice update if the purpose is new, (4) a retention rule, (5) a check against the DPIA triggers in §7.3.
- **Legal basis cheat sheet:**

| Basis | Use for | Never for |
|---|---|---|
| Contract — Art 6(1)(b) | Accounts, delivering matches the user asked for, chat, payments, transactional email | Engagement-driven personalization, marketing (EDPB Guidelines 2/2019) |
| Legitimate interest — Art 6(1)(f) | Fraud/abuse prevention, anti-disintermediation scanning, publishing reviews, first-party consent-exempt analytics, legal-claim retention | Anything a documented balancing test (LIA) can't justify; email marketing (Art 130 overrides) |
| Consent — Art 6(1)(a) | Marketing emails, non-exempt analytics/tracking cookies, profiling for ads | Anything bundled or pre-ticked — consent must be granular, free, logged |
| Legal obligation — Art 6(1)(c) | Invoice/tax retention (10 years), responding to authorities | — |

- **Consent rules (Garante, everywhere they apply):** never pre-ticked; never a condition of using the service; separate consents for marketing vs profiling vs sharing with third parties; log who/when/what-text (burden of proof is on Bob); withdrawal as easy as granting.
- **Data minimization (Art 5(1)(c)):** collect and expose the minimum. Ask "does this feature need this column?" at schema-design time.

---

## 1. Analytics & product metrics

**Governing:** Garante Cookie Guidelines 10 June 2021 (docweb 9677876); Garante GA decision 9 June 2022 (Caffeina, docweb 9782890); EDPB Guidelines 2/2023 on ePrivacy Art 5(3).

### Allowed WITHOUT consent (no banner needed for this alone)
Analytics count as "technical" only if ALL of these hold (Guidelines §7.2):
- IP masked (at least last octet for IPv4) before storage.
- Used only for aggregate statistics, single site only — no cross-site/cross-app tracking, no combining with other data, no passing to third parties (a third-party tool is OK only if it acts strictly as Bob's processor for Bob alone).
- No user-level identification: no User ID, no personal data in URLs or event payloads, no session replay.

**Practical picks:** Plausible (EU-hosted, cookieless) or Matomo configured per its consent-free checklist (cookies off, IP anonymized ≥2 bytes, no User ID). Vercel Analytics in its cookieless aggregate mode is in the same family — verify its current data handling before relying on it.

### Requires prior opt-in consent (Garante-compliant banner)
- GA4, Meta/Google ads pixels, PostHog with user identification, session replay, A/B tools with persistent identifiers, any cross-site tracker.
- The 2022 Garante GA decision was about US transfers (now patched by the DPF adequacy decision, in force as of July 2026 after the General Court dismissed *Latombe*, T-553/23, 3 Sept 2025) — **but GA4 still needs consent** because it can't meet the exemption conditions above. Transfer legality ≠ consent exemption.

### Banner rules if/when Bob adds consent-based trackers (Guidelines §7.1)
- DO: equal-prominence "Accept" and close-X (close = refuse, keeps default no-tracking); granular preferences link; full notice link; default = nothing non-technical runs until positive action.
- DON'T: cookie walls (no access without consent) — unlawful without an equivalent no-consent alternative; scroll-as-consent — never valid alone; re-prompting after refusal more than once per 6 months (unless processing changed or prior choice is unknowable).
- DO log consent choices server-side (proof duty).

### Server-side events
ePrivacy Art 5(3) covers any script that makes the browser send data, including fingerprinting — moving collection server-side doesn't escape it (EDPB 2/2023). Plain nginx/Vercel request logs are fine; enriched behavioral event streams keyed to a user need a legal basis and minimization like anything else.

**Bob's current safe default:** keep analytics on a consent-exempt EU tool, no marketing pixels → no cookie banner needed at all; disclose the tool in the privacy policy.

---

## 2. AI matching, recommendations, LLM analysis

**Governing:** GDPR Arts 6, 13(2)(f), 22, 35; EDPB Guidelines 2/2019; WP29 WP251 (automated decisions); CJEU C-634/21 *SCHUFA*; EU AI Act (Reg. 2024/1689); EDPB Opinion 28/2024; Garante DPIA blacklist (provv. 467/2018, docweb 9058979).

### Legal basis
- **Core matching** (customer posts request → relevant pros shown/notified) = the service itself → contract, Art 6(1)(b). Defensible.
- **Beyond-core personalization** ("Consigliati da Bob" style engagement recommendations, propensity scoring, behavioral profiles) is NOT "necessary for contract" (EDPB 2/2019 §57) → use legitimate interest with a written LIA, or consent. DO write and file the LIA before shipping.
- DON'T ship any user-level profiling on a bare 6(1)(b) claim.

### Article 22 — automated decisions
- Ranking pros shown to a customer: generally fine (no significant effect on the customer).
- **Automatically excluding, suspending, or systematically deprioritizing a professional** (loss of work opportunities) IS potentially an Art 22 decision (WP251; *SCHUFA* says even a score can be, if it effectively determines the outcome).
- DO: keep a human in the loop for pro suspensions/exclusions; give the pro a contest/appeal channel; document it.
- DON'T: build fully automated pro-punishment (auto-hide on low rating, auto-ban) without human review.

### Transparency
- Privacy notice must state that matching/recommendations exist, the logic in meaningful terms (main input factors: category, location, response time, reviews…), and the consequences (Art 13(2)(f)).
- **AI Act Art 50 (applies from 2 Aug 2026 — weeks away):** any chatbot/AI assistant in Bob must tell users they're talking to AI, unless obvious. Label AI-generated summaries/suggestions. Ship the label now.

### AI Act risk class
- Consumer-facing matching/recommendation in a services marketplace = **minimal/limited risk** (not Annex III), as long as **customers freely choose** among presented pros.
- ⚠️ If Bob ever *allocates* jobs to pros automatically (assigns, sets price, dispatches), it edges toward Annex III 4(b) (task allocation / platform work, recital 57) and the Platform Work Directive 2024/2831 (transposition due Dec 2026). Keep the model "customer chooses" and both stay out of scope. Re-assess if that changes.

### Sending user content to LLM APIs (chat/request analysis)
- DO before any LLM feature: sign the provider's DPA (provider = processor); prefer EU-region processing (OpenAI EU residency for API; Anthropic via Bedrock/Vertex EU regions) or zero-data-retention terms; confirm inputs are not used for training.
- DO minimize: strip names, emails, phones, addresses from prompts where the task allows (pseudonymize before send, re-attach after).
- DO disclose in the privacy notice that request/chat content may be processed by AI providers acting as processors.
- DON'T send raw chat logs wholesale to an LLM for exploratory analysis; send task-scoped, minimized excerpts.
- DON'T let the provider use Bob data for model training.
- Transfers: DPF adequacy is in force (July 2026) and both major providers offer SCCs in their DPAs as fallback. Fine to build on, but keep the EU-residency option preferred so a future DPF invalidation is a config change, not a re-architecture.
- Context on enforcement: the Garante is active on AI (OpenAI €15M fine 2024 — annulled by Trib. Roma no. 4153/2026, possibly under appeal; Replika €5M, 2025; Character.AI €158k, July 2026, partly for a **late DPIA**). The lesson that survives the annulment: paperwork timing matters.

### DPIA — required BEFORE launch
AI matching + profiling + LLM processing of chats hits the Garante blacklist (provv. 467/2018: evaluation/scoring, innovative tech, data combination — two criteria suffice). **DO write the DPIA before the feature goes live**, not after. A lean 6-10 page DPIA (processing description, necessity, risks, mitigations) is acceptable at Bob's scale.

---

## 3. Marketing emails, newsletter, waitlist

**Governing:** Art 130 Codice Privacy (D.Lgs. 196/2003); Garante spam guidelines 4 July 2013 (docweb 2542348); GDPR Art 7. Enforcement: Verisure €400k (Nov 2025) for exactly the mistakes below.

### The rule
Email marketing (promo, offers, market research, "commercial communication") = **prior opt-in consent. Always.** Includes re-engagement ("ci manchi"), waitlist "we've launched" announcements, and promo content inside transactional emails.

### Soft opt-in (Art 130(4)) — narrow, mostly NOT available to Bob
Only works when the address was collected **in the context of an actual sale**, for **similar** services, by Bob itself, with opt-out offered at collection and in every message. Account registration, quote requests, and waitlist signups are NOT sales → no soft opt-in. (Verisure was fined for treating a quote-request phone number as marketing consent.) It may become usable for customers who complete a paid job through Bob — decide then, and implement the collection-time opt-out first.

### DO
- Separate, unticked checkbox for marketing at signup — never bundled with ToS acceptance, never required to register.
- Separate consents: marketing / profiling / third-party sharing (one consent can cover all *channels* of Bob's own marketing if the notice says so).
- Store proof: `marketing_consents(user_id, purpose, granted_at, revoked_at, consent_text_version, source)`.
- Working unsubscribe link in every marketing email, honored immediately; opt-out must be free and easy (Art 7 GDPR: withdrawing as easy as giving).
- Waitlist form: add the explicit line "I agree to be contacted when Bob launches in my city" — that consented launch email is then fine; anything beyond it (newsletter) needs its own consent.

### DON'T
- No pre-ticked boxes, no consent-as-condition-of-service (invalid per Garante 2013 guidelines).
- No cold emails to addresses scraped from the web, directories, or PEC registers — unlawful even "just to ask for consent".
- No incentivized refer-a-friend emails to non-consenting contacts.
- No hidden sender / missing contact address (Art 130(5) — prohibited even with consent).
- No promo blocks inside password-reset/booking-confirmation emails to non-consented users.

**Transactional emails** (booking confirmations, new-message notifications, receipts, security) need no consent — Art 6(1)(b). Keep them strictly non-promotional.

Double opt-in: not legally required in Italy, but cheap and makes the consent proof solid — recommended when real email sending ships (post-SMTP).

---

## 4. Sharing data with pros, chat, reviews

**Governing:** EDPB Guidelines 07/2020; GDPR Arts 5(1)(c), 6(1)(f), 17(3); CJEU C-621/22 (commercial legitimate interest OK); Codice del Consumo as amended by D.Lgs. 26/2023 (review verification, AGCM-enforced); Cass. 14381/2021 (rating-algorithm transparency).

### Sharing customer data with professionals
- The pro is an **independent controller** once they receive customer data. Bob is accountable for what it discloses (Art 24), so:
- DO — **progressive disclosure**: pros first see the request pseudonymized (need, zone, budget, first name). Full contact details (surname, phone, email, exact address) only after the customer accepts/starts a conversation with that pro. Broadcasting contacts to all matching pros violates minimization and is the most sanctionable pattern.
- DO — put in the pro ToS: customer data may be used **only** to respond to that request and perform that job; reuse for the pro's own marketing is forbidden (the pro would need their own Art 130 consent) and is ground for suspension.
- DO — privacy notice tells customers which data pros receive and when.
- DON'T — no pro-facing exports/lists of customer contacts; no "download my leads" CSV with contacts of customers who never accepted.

### In-app chat
- Basis: contract (6(1)(b)) while accounts live.
- Retention: keep chats while both accounts are active; after account deletion or N years of inactivity, delete or restrict. **Don't blanket-keep everything for 10 years** — the 10-year civil prescription (Art 2946 c.c.) justifies keeping chats **linked to an actual transaction or dispute** in a restricted-access archive, not all chats. Suggested tiering: active accounts → keep; deleted accounts → chats tied to completed jobs archived (restricted) up to limitation period, the rest erased within ~90 days.
- **Anti-disintermediation scanning** (detecting phone/email exchange to bypass Bob) is defensible on legitimate interest (commercial interests qualify — CJEU C-621/22) IF: disclosed clearly in ToS + privacy notice; automated pattern-matching only; humans review only flagged snippets; flags used only for that purpose. Write the LIA. No bulk human reading of chats, ever.
- Marketplace chat is an ancillary feature, so full ePrivacy interpersonal-communications duties likely don't attach — but treat chat content as sensitive-by-default anyway (RLS: only the two participants + narrowly-scoped admin role).

### Reviews
- Publishing customer reviews of named pros: legitimate interest + freedom of expression (Arts 6(1)(f), 17(3)(a)). The pro's consent is NOT required for genuine reviews; erasure demands for genuine negative reviews can be refused.
- DO: reviews only from customers with a real interaction/completed job through Bob (this is also what lets you say "verified"); pro right-of-reply and a flag/report channel; rectify or remove factually false statements on request (opinions are protected, false facts are not); keep the aggregate-score logic simple and explainable (Cass. 14381/2021: opaque rating algorithms are invalid).
- DON'T: label reviews "verificate" unless verification against a transaction actually happens — D.Lgs. 26/2023 (Omnibus) makes fake/unverified "verified" claims an unfair commercial practice (AGCM fines, separate from privacy).
- On account deletion: keep the review, de-identify the author ("Utente eliminato").

---

## 5. Retention schedule (default rules)

| Data | Keep | Basis | Then |
|---|---|---|---|
| Account/profile | Account life | Contract | Erase/anonymize ≤30 days after deletion request |
| Chats (no transaction) | Account life | Contract | Erase ≤90 days after account deletion |
| Chats/job records (completed transaction or dispute) | Up to 10 y post-transaction, restricted archive | 6(1)(f) + 17(3)(e) | Erase |
| Invoices/payment records | 10 years | Legal obligation (Art 2220 c.c., tax) | Erase |
| Marketing consent + email logs | Consent life + proof period | Consent/6(1)(f) | Keep the consent record itself as proof after revocation |
| Analytics | Aggregate only | Exempt/6(1)(f) | Aggregates are fine indefinitely if truly anonymous |
| Prospect/waitlist data | Until launch contact + short tail (~12 months max) | Consent | Erase (Verisure: 12-month prospect retention already contested) |
| Reviews | Platform life | 6(1)(f) | De-identify author on account deletion |
| Breach log (internal) | Indefinite | Legal obligation | — |
| Data-export archive | Not stored | Legal obligation (Art 6(1)(c), answering Arts 15/20) | Built in memory, streamed to the user, never written to a bucket |
| Data-export timestamp (`profile_private.last_export_at`) | Account life, overwritten each time | 6(1)(f) — rate limit only | Dies with the account row |

---

## 6. User rights — implementation targets

- **Deadline: 1 month** from request (extendable +2 for complex cases, must tell user within month 1). Verify identity via logged-in session; don't demand ID documents for logged-in users.
- **Access/portability (Arts 15, 20): SHIPPED for customer accounts** (migration 061, `GET /api/account/esporta`, button in Impostazioni → I tuoi dati). Synchronous ZIP: `dati.json` + `LEGGIMI.txt` + the brief photos as real files. JSON satisfies "structured, machine-readable" (WP242).
  - **Covered:** the auth record (email, confirmation, last sign-in — `public.users` holds only id/role/created_at, the email is in `auth.users`), profiles, profile_private, profile_phone, customer_addresses, communication_consents, customer_memory, requests, request_addresses, job_briefs, request_messages (both sides, pro named, internal `sender_id` stripped), appointments, ratings, support_tickets, promo_redemptions, account_deletion_requests, city_waitlist (matched **by email** — it has no `user_id`, so a `user_id`-only sweep silently misses it).
  - **Deliberately excluded:** `search_events` — no user column by design (mig 026), so searches are genuinely anonymous. The export says so in writing rather than staying silent.
  - **Still open:** the professional block (~20 tables: verification, documents, subscriptions, payments, payouts, availability, portfolio, coverage). Owner: Internal track. Until it lands the route returns 409 to non-customers instead of handing over a half-empty archive.
  - **Rate limit:** one per 24 h, enforced by `profile_private.last_export_at` (Art 12(5), repetitive requests). No history kept — the column is overwritten, not appended.
  - **Maintenance rule:** every new table with a `user_id` (or an email key) must be added to `raccogliDatiCliente` in the same PR that creates it. An export that misses a table is a wrong answer to an access request, not a partial one.
- **Erasure (Art 17):** hard-delete or irreversibly anonymize personal fields; KEEP what §5 requires (invoices, dispute archives, consent proofs) — Art 17(3) covers this, tell the user what's retained and why. Pseudonymization ≠ anonymization: if a key can re-link it, it's still personal data.
- **Backups:** erase from production immediately; documented policy that backups expire on rotation (Supabase PITR window) and any restore re-applies deletions. Keep a `deleted_users(user_id_hash, deleted_at)` tombstone to re-delete on restore.
- **Schema practice (Supabase):** design deletes now, not later — FK `ON DELETE CASCADE` where full removal is right; `ON DELETE SET NULL` + de-identified placeholder where content must survive (reviews, job records); RLS on every table; service-role key server-side only; MFA on Supabase/Vercel dashboards (Art 32 — missing MFA is a recurring factor in Garante breach fines).
- **Objection (Art 21):** opt-out toggle from profiling/personalization if built on legitimate interest; unsubscribe = marketing objection, absolute.

---

## 7. Company-level obligations (once, then maintain)

1. **Privacy notice (Arts 13/14):** in Italian; identity/contacts, every purpose with its basis, recipients (pros! + processor categories), transfers (US: DPF/SCCs), retention per purpose, all rights + Garante complaint right, profiling/AI logic description. Layered (short banner → full policy). Update whenever a feature adds a purpose. *(Ties into the [PLACEHOLDER] company fields — the notice needs a real controller identity by the time real users' data is processed at scale; the Jan 2027 deferral is a real risk item here, worth a conscious decision.)*
2. **ROPA (Art 30):** mandatory in practice — the <250-employee exemption fails because processing is "not occasional". One spreadsheet: purpose, categories, recipients, transfers, retention, security. ~1 day of work.
3. **DPIA:** required before AI matching/profiling launch (§2). Also re-check when adding: chat scanning, large-scale marketing, any new "innovative tech".
4. **DPO (Art 37):** not mandatory at current scale (profiling exists but not "large scale" per WP243 yet). DO write a one-page memo documenting that assessment; revisit at, say, >100k active users.
5. **Breach (Arts 33/34):** 72h to the Garante via https://servizi.gpdp.it/databreach/ when there's risk; notify users when high risk; log ALL breaches internally regardless. Note: Stripe's DPA promises breach notice to Bob within 48h — wire vendor alerts into the same playbook.
6. **Vendors:** signed DPAs + subprocessor lists on file for Supabase (EU region ≠ zero US transfer — subprocessors include US entities), Vercel (**primary processing facilities are in the US** — assume transfer, covered by DPA SCCs/DPF), Stripe (processor for payments, independent controller for fraud/AML), LLM providers, email provider (prefer EU: Brevo/Mailjet/Scaleway to skip the transfer analysis entirely). List them all in the privacy notice.
7. **NIS2:** not applicable below 50 employees / €10M turnover — ignore for now.
8. **Fine calibration:** Garante actively fines small entities (€5k–€160k typical range at Bob's size; Character.AI got €158k for notice/DPIA/rep timing failures). The cheap paper obligations (notice, ROPA, DPIA, LIA memos) are exactly what they check first.

---

## 8. Feature-launch checklist (copy into PRs that touch personal data)

```
[ ] Legal basis identified (and LIA written, if legitimate interest)
[ ] Privacy notice covers this purpose (update if not)
[ ] ROPA row added/updated
[ ] Consent flow (if basis = consent): granular, unticked, logged, revocable
[ ] Minimization: only needed columns collected/exposed; pro-facing data gated
[ ] Retention rule set + deletion path implemented (cascade/anonymize)
[ ] RLS policies on new tables; no service-key exposure
[ ] DPIA trigger check (profiling? innovative tech? data combination?)
[ ] If AI-facing: AI-disclosure label (AI Act Art 50); human review for pro-impacting decisions
[ ] If new vendor: DPA signed, transfer mechanism checked, added to notice
```

---

## 9. Open items to re-verify before relying (as of 2026-07-18)

- DPF/*Latombe*: General Court upheld the DPF (T-553/23, 3 Sept 2025); Commission page still lists it in force. A CJEU appeal may be pending — re-check before making DPF the *sole* transfer basis anywhere.
- Trib. Roma 4153/2026 (OpenAI fine annulment): grounds and possible Garante appeal unknown.
- Supabase current subprocessor list (JS-rendered page; confirm in browser).
- Exact Codice del Consumo article numbering post-D.Lgs. 26/2023 for review-verification duties (confirm on Normattiva before citing in ToS).
- Edison/Plenitude telemarketing fine references (docweb IDs unverified).

## Key sources

- Garante Cookie Guidelines 10.06.2021 — garanteprivacy.it docweb 9677876
- Garante GA/Caffeina decision 09.06.2022 — docweb 9782890
- Garante spam guidelines 04.07.2013 — docweb 2542348
- Garante DPIA blacklist, provv. 467/2018 — docweb 9058979 (list: 9059358)
- Garante Verisure fine 27.11.2025 — gpdp.it docweb 10202719
- Garante Character.AI fine 03.07.2026 — docweb 10269594
- EDPB Guidelines 2/2019 (Art 6(1)(b)), 07/2020 (controller/processor), 2/2023 (ePrivacy Art 5(3)), 05/2020 (consent), 9/2022 (breach); Opinion 28/2024 (AI models)
- WP29: WP251 (automated decisions), WP243 (DPO), WP242 (portability), WP248 (DPIA)
- GDPR (Reg. 2016/679); Codice Privacy Art 130; EU AI Act (Reg. 2024/1689) Arts 50, 113, Annex III; Platform Work Directive 2024/2831; D.Lgs. 26/2023 (Omnibus)
- CJEU: C-634/21 SCHUFA; C-621/22 KNLTB; C-40/17 Fashion ID; Trib. Roma 4153/2026
- Vendor DPAs: stripe.com/legal/dpa; vercel.com/legal/dpa; supabase.com/legal/dpa; openai.com/policies/data-processing-addendum; anthropic.com/legal/data-processing-addendum
- EU-US DPF adequacy: commission.europa.eu → EU-US data transfers (verified in force 18.07.2026)
