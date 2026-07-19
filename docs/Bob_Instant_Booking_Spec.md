# Bob — Instant Booking vs Preventivo Spec

Spec for letting a professional expose **direct (instant) booking** on the services that have a fixed, computable price (e.g. pulizie), so a private can book without a prior conversation — while services that need a site visit or a custom estimate keep the existing **preventivo** flow. Each service is independently switchable by the pro; the platform curates which jobs are even allowed to be instant-booked.

Status: draft v1 — 2026-07-19
Codebase anchors: `professional_services`, `subservices`, `appointments`, `professionals` (subscription_tier), `AppointmentDialog`, `matching.ts`. Companion rule doc: `docs/DATA_COMPLIANCE.md`.

---

## 1. Goal & the two modes

Every service a pro offers is in one of two booking modes:

| Mode | When | Customer experience | Contract forms |
|---|---|---|---|
| `instant` | Fixed, computable price (pulizie ordinarie, montaggio mobili, ripetizioni) | Pick job details → see live price → pick a real slot → confirm. No conversation needed. | At confirmation |
| `quote` (preventivo) | Needs assessment, variable scope (ristrutturazione, impianti, traslochi) | Existing request → matched pros → messages → quote → accept. | On quote acceptance |

`quote` is the current default and stays exactly as it is today. This spec only adds the `instant` path and the machinery that gates it.

Design intent: a pro must **switch instant booking on per service**, and can only do so once (a) the platform has marked that job instant-eligible and (b) the pro has supplied the minimum info the job requires. Incomplete info ⇒ the toggle stays off. This is the core mechanic — the required information is what *unlocks* the option.

---

## 2. The two-layer gate

**Layer 1 — platform catalog (admin-curated), on `subservices`.**
The platform decides which of the 120 subservices can ever be instant-booked and defines the fields each one needs. A pro can never enable instant-book for a job the platform hasn't opened.

**Layer 2 — pro's offering, on `professional_services`.**
For an eligible job, the pro fills the required fields (rate, unit, minimum, plus any job-specific inputs) and flips the switch. The switch is only available when the fields validate.

**Plus tier:** per `Bob_Pro_Offers_Strategy`, online booking is a Bob Pro feature. So enabling `instant` also requires `professionals.subscription_tier` in (`pro`, `business`). Free pros see the option locked with an upgrade prompt.

A service is bookable instantly ⇔ `subservice.instant_book_eligible` **AND** `professional_services.instant_book_enabled` **AND** required fields complete **AND** pro tier ≥ pro.

---

## 3. Data model changes

All new/changed tables: RLS on, a retention rule, and a deletion/anonymize path (per `DATA_COMPLIANCE.md`).

### 3.1 `subservices` (catalog — additive)

| Column | Type | Notes |
|---|---|---|
| `instant_book_eligible` | bool, default `false` | Admin-curated Layer-1 gate |
| `booking_fields` | jsonb, default `'[]'` | Ordered field schema for this job (see §4) |
| `default_rate_unit` | text, nullable | Suggested billable unit (`hour` / `m2` / `job` / `session`) — pre-fills the pro form |

### 3.2 `professional_services` (pro offering — additive)

Today this holds `min_price` / `max_price` / `price_note` (a range → the preventivo world). Add the instant config:

| Column | Type | Notes |
|---|---|---|
| `instant_book_enabled` | bool, default `false` | Layer-2 switch |
| `rate_amount` | numeric, nullable | Price per billable unit |
| `rate_unit` | text, nullable | Must match the subservice's billable unit (`hour`/`m2`/`job`/`session`) |
| `min_units` | numeric, nullable | Minimum billed quantity (e.g. min 2 ore) |
| `slot_duration_min` | int, nullable | Slot length the booking occupies in the pro's calendar. **Pro sets this per service** (decided). Required when the billable unit isn't time-based (m²/job); for time-based units it can derive from the booked quantity. |
| `cancellation_window_hours` | int, nullable | Free-cancellation window the **pro** sets per service, subject to a **platform minimum** (e.g. ≥ 24h). Beyond the window, no-show/cancellation is handled by the payments workstream (§7). |

Constraint / trigger: `instant_book_enabled = true` is only allowed when the parent subservice is `instant_book_eligible`, `rate_amount`/`rate_unit`/`min_units`/`slot_duration_min` are non-null, and `cancellation_window_hours >= ` the platform minimum. Enforced in-app **and** backed by a trigger so it can't be bypassed via direct writes.

### 3.3 `professional_availability` (new)

Real slots so "instant" is actually instant.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `professional_id` | uuid fk → professionals | |
| `weekday` | smallint (0–6) | Recurring weekly hours |
| `start_time` / `end_time` | time | |
| `created_at` | timestamptz | |

Plus `professional_availability_blocks` (or a `date`-scoped override row) for holidays / one-off blocks. v1 can start with recurring weekly hours only; booked `appointments` subtract from availability at query time.

### 3.4 `appointments` (additive — reuse for bookings)

Already has `professional_id`, `starts_at`, `duration_minutes`, `price`, `status`, `proposed_by`, nullable `request_id`. A direct booking = a row with `proposed_by='customer'`, `request_id=null`, `status='confirmed'`. Add:

| Column | Type | Notes |
|---|---|---|
| `customer_id` | uuid fk → users, nullable | Today only `customer_name` exists; direct bookings need the real user |
| `professional_service_id` | uuid fk → professional_services, nullable | Which offering was booked |
| `booking_answers` | jsonb, default `'{}'` | Customer's answers to the job's `booking_fields` |
| `source` | text, default `'pro'` | `'direct'` for self-service bookings vs pro-created |

---

## 4. `booking_fields` schema (per-job custom fields)

Each subservice defines an ordered list of fields the customer fills at booking. Reuses the `scope`-key vocabulary already defined in `Bob_Job_Brief_Spec.md` §1.3 so the two systems stay consistent (a `mq_approx` here means the same thing as in a brief).

Field shape:

```json
{
  "key": "mq",                    // stable key; reuse brief scope keys where they exist
  "label": "Metri quadri",        // customer-facing (IT)
  "type": "number",               // number | select | bool | text
  "unit": "m2",                   // display unit, optional
  "required": true,
  "is_billable_unit": false,      // exactly ONE field per job is true (see §5)
  "options": [],                  // for type=select
  "help": ""                      // optional hint
}
```

**Worked example — `pulizie / profonda-una-tantum`:**

```json
[
  { "key": "ore", "label": "Ore stimate", "type": "number", "unit": "ore",
    "required": true, "is_billable_unit": true, "help": "Puoi stimare in base alla dimensione della casa" },
  { "key": "mq_approx", "label": "Metri quadri", "type": "number", "unit": "m2", "required": true },
  { "key": "rooms", "label": "Numero di stanze", "type": "number", "required": false },
  { "key": "has_pets", "label": "Animali in casa", "type": "bool", "required": false }
]
```

The billable field (`ore`) drives price; the rest qualify the job and travel to the pro so they arrive prepared.

---

## 5. Pricing rule (deterministic)

Exactly **one** field per job carries `is_billable_unit: true`, and its `unit` must equal the pro's `rate_unit`. Price at booking:

```
price = max(min_units, answer[billable_field]) * professional_services.rate_amount
```

All other `booking_fields` are qualifying/informational — they never enter the price. This keeps the contract price a single, explainable number at the moment of booking (and keeps the aggregate/pricing logic explainable per `DATA_COMPLIANCE.md`). A formula engine over multiple priced inputs is explicitly a **non-goal for v1**.

---

## 6. Booking flow — instant path

1. Customer opens an instant-enabled service on a pro's profile.
2. **Pre-fill from the Bob chat.** If the customer reached this pro via a Bob conversation, a `job_briefs` row exists. Because `booking_fields` reuse the brief's `scope`-key vocabulary (§4), any matching keys pre-fill the form (`mq_approx`, `rooms`, `recurring`, `frequency`, `timing_availability`, etc.), marked as editable. Pre-filled values carry the brief's `source`/`confidence`; the customer confirms or corrects. This turns the chat into a head start on the booking rather than throwaway context.
3. Customer completes/adjusts the job's `booking_fields`; UI computes and shows the live total (§5).
4. Picks a real slot from the pro's availability (§3.3, occupying `slot_duration_min`), minus already-booked slots.
5. **Online payment (required).** Direct booking is pay-at-booking: the customer pays online before the slot is held. Payment (full price, or a deposit once deposits ship) runs through the Stripe workstream (Stripe Connect → pro payout). The booking is only `confirmed` once payment succeeds; a failed/abandoned payment leaves no held slot. This couples instant-book to the payments workstream — see §7 and §9 sequencing.
6. On successful payment → an `appointments` row is written (`source='direct'`, `status='confirmed'`, `proposed_by='customer'`, `booking_answers` saved, linked to the payment record).
7. **Only now** the pro's full contact details are revealed to the customer (progressive disclosure — pseudonymized/limited before this point).
8. A **transactional** confirmation is sent to both parties (booking details, time, price, cancellation terms). Strictly non-promotional — no marketing content, no consent required.

Cancellation follows the pro's `cancellation_window_hours` (§3.2): free cancel/refund inside the window, pro's policy beyond it, all above the platform minimum.

Matching stays **customer-chooses**: the customer books a specific pro they selected. No auto-assignment — this keeps the feature out of Art 22 / Annex III / Platform Work Directive scope. The quote path (§1) is untouched.

---

## 7. Compliance done-list (per DATA_COMPLIANCE.md)

Before this ships, all of the following are part of "done":

- **Legal basis:** the booking itself is *contract* (performance of a service the customer requested). Add a Records-of-Processing row for "prenotazioni dirette". No new consent needed for the booking or its transactional emails.
- **Payments (PSP):** card/payment data is handled by Stripe as processor — Bob does not store PANs. Add Stripe to the processor register with a signed DPA; add a RoPA row for "pagamenti prenotazioni". Payment records (amounts, status, references) are transaction data → contract basis, retention per §5 (linked invoice 10y). Refund path must honour the cancellation window (§3.2).
- **Pre-fill from `job_briefs`:** reusing brief data to pre-fill the booking is compatible use (same purpose — fulfilling the customer's service request); no new basis needed, but the pre-filled fields stay editable and the brief's existing retention rule applies.
- **Progressive disclosure:** customer sees pseudonymized pro info until booking is confirmed; full contact only post-confirmation. Pro ToS forbids reusing the customer's contact for the pro's own marketing.
- **RLS:** `professional_availability`, `professional_availability_blocks`, and the new `appointments` columns all get policies — a customer reads only their own bookings; a pro reads bookings/availability for their own `professional_id`; staff access least-privilege (admin vs cs).
- **Retention & deletion:** bookings are transaction-linked → keep for the limitation period; any linked invoice 10y (§5 of the doc). On account deletion, de-identify the customer on past `appointments` (mirror the "Utente eliminato" rating rule) rather than orphaning personal data. Availability rows deleted with the pro account.
- **No new special-category data**; `booking_answers` must not collect health/other sensitive fields — keep fields operational.
- **Advisors:** run the Supabase security advisors after the migration and clear any RLS-missing / SECURITY DEFINER / mutable search_path / public-bucket findings before considering it done.
- **AI Act labelling** only applies if AI drafts/prices anything in this flow — v1 pricing is deterministic arithmetic, so no automated-decision labelling is triggered. If AI-assisted pricing is added later, revisit.

---

## 8. Admin curation (Layer 1)

A small admin surface to, per subservice: toggle `instant_book_eligible`, edit `booking_fields`, set `default_rate_unit`. Seed an initial eligible set from the clearly fixed-rate jobs — candidates: `pulizie` (ordinarie-ricorrenti, profonda-una-tantum, uffici-negozi, vetri-vetrate), `tuttofare` (montaggio-mobili, mensole-quadri-tende, piccole-riparazioni), `ripetizioni` (all), `personal-trainer` (coaching-online, allenamento-gruppo). Everything assessment-heavy (impianti, ristrutturazioni, traslochi completi, serramenti su misura) stays quote-only.

---

## 9. Migration path & sequencing

**Decision (2026-07-19):** there is no payments workstream yet, and direct booking is pay-at-booking (§6). So we build the **groundwork now** and hold the customer-facing booking flow until Stripe exists. This lets pros configure everything and lets us seed the catalog, without shipping a half-feature that takes money it can't process.

### Phase 0 — groundwork (ship now, no payment, no public booking)

1. Additive migration: new columns on `subservices`, `professional_services` (incl. `slot_duration_min`, `cancellation_window_hours`), `appointments`; new `professional_availability` (+ blocks) tables; the enablement trigger (incl. the cancellation-minimum check). Ships as `supabase/migrations/NNN_instant_booking.sql` (idempotent) in the same commit as the code depending on it. RLS + advisors run as part of this step.
2. Admin curation UI + seed the initial eligible subservices and their `booking_fields`.
3. Pro dashboard: per-service instant config form (rate/unit/min + `slot_duration_min` + `cancellation_window_hours` + the switch) gated on tier; availability editor (extends the existing calendar / `AppointmentDialog`). The switch can be set, but produces no public booking surface yet — treat it as "ready when booking opens".
4. Run security advisors; add the bookings RoPA row and retention/deletion path.

*Note:* until the payment step exists, `instant_book_enabled` is effectively a "prepared" flag — no customer-facing entry point reads it yet, so pros can safely configure ahead of launch.

### Phase 1 — depends on the Stripe payments workstream (later)

5. Stripe Connect workstream (separate project): pro onboarding/KYC, `payments`/`payouts` tables, webhooks, payments RoPA + DPA.
6. Payments wiring: link booking confirmation to a Stripe payment (hold slot only on success); refund path honouring the cancellation window.
7. Public profile + booking flow: brief pre-fill, field form, live price, slot picker, pay → appointment write, contact reveal, transactional email. This is the step that actually exposes `instant_book_enabled` to customers.

**Non-goals v1:** multi-field pricing formulas; AI-assisted pricing; recurring bookings (though `recurring`/`frequency` can be captured as qualifying fields now and acted on later). Deposits (partial vs full payment) ride on the payments workstream — v1 can charge full price at booking and add deposit logic when that workstream exposes it.

---

## 10. Resolved decisions

- **Pre-fill from Bob chat:** yes — matching `job_briefs` `scope` keys pre-fill the booking fields, editable (§6.2).
- **Online payment:** required at booking, via the Stripe workstream; slot held only on payment success (§6.5).
- **Slot length for non-time units:** pro sets `slot_duration_min` per service (§3.2).
- **Deposits:** tied to the Stripe payments workstream (Phase 1/2), not a separate contact-only launch (§9).
- **Cancellation:** pro sets `cancellation_window_hours` per service, above a platform minimum (§3.2, §6).

Remaining to decide later: the exact platform-minimum cancellation window (e.g. 24h); whether v1 charges full price or introduces deposits from day one (depends on payments workstream readiness).

---

## 11. Build status (as of 2026-07-19)

**Phase 0 groundwork — shipped:**

- Migration `028_instant_booking.sql` — `subservices`/`professional_services`/`appointments` columns, `professional_availability` (+ blocks), enablement trigger (eligibility + completeness + 24h cancellation minimum), RLS. Applied to Supabase + in repo.
- Migration `029_seed_instant_booking_catalog.sql` — 20 instant-eligible subservices (pulizie, tuttofare, ripetizioni, personal-trainer) with `booking_fields` + `default_rate_unit`. Applied + in repo.
- Pro config UI (`InstantBookingConfig` on `/dashboard/profilo`) — per-service rate/unit/min/slot/cancellation + enable toggle, tier-gated.
- Admin catalog curation (`/admin/catalogo` + `PATCH /api/admin/subservices/[id]`) — eligibility, `default_rate_unit`, `booking_fields` editor. Admin-only, service-role writes.
- Pro availability editor (`AvailabilityEditor`) — weekly hours into `professional_availability`.

**Payments groundwork — shipped as DORMANT (migration `030_payments_groundwork.sql`):**

Data model + RLS only. NO Stripe keys, NO SDK, NO webhooks, NO onboarding, NO app code touching these tables. Tables: `pro_payment_accounts`, `subscriptions`, `subscription_invoices`, `payments`, `refunds`, `disputes`, `payouts`. Money as integer cents. RLS = owner read-only; all writes reserved for the service role (Stripe webhooks). FKs to users/professionals are `ON DELETE SET NULL` so financial rows survive account deletion de-identified.

**Deliberately NOT done (do at activation, not before):**

- Records-of-Processing rows for "pagamenti prenotazioni" and "abbonamenti pro" (register entries, per `DATA_COMPLIANCE.md`).
- Signed Stripe DPA (EU-region / retention terms).
- Any integration code — would rot before the 2027 launch and can't be tested without live keys.

## 12. Activation checklist (2027 launch)

Ordered. Each step depends on the previous.

1. **Compliance first.** Sign the Stripe DPA; add the two RoPA rows (payments, subscriptions); confirm retention rules (invoices 10y; transaction-linked records to the limitation period); update the privacy notice for the payment purpose.
2. **Stripe account + keys.** Create the Stripe account, enable Connect (Express) and Billing; add `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / publishable key to Vercel env (do not commit).
3. **Connect onboarding.** Pro dashboard flow that creates a Stripe Express account and writes `pro_payment_accounts` (charges/payouts enabled, onboarding_status).
4. **Webhook handlers** (service role): payment_intent, charge, refund, dispute, transfer/payout, and subscription/invoice events → write `payments`/`refunds`/`disputes`/`payouts`/`subscriptions`/`subscription_invoices`. Verify signatures with the webhook secret.
5. **Subscriptions.** Wire Bob Pro/Business checkout; keep `professionals.subscription_tier` as the effective entitlement mirror driven by subscription status.
6. **Booking payment.** In the instant-booking confirmation, create a PaymentIntent (full price, or deposit when introduced); hold the slot only on payment success; write the `payments` row (link `appointment_id`); refund path honouring `cancellation_window_hours`.
7. **Public booking flow.** Expose `instant_book_enabled`: brief pre-fill → field form → live price → slot picker (reads `professional_availability`) → pay → `appointments` write → contact reveal → transactional confirmation email.
8. **Re-run security advisors** and confirm no RLS/SECURITY DEFINER/search_path/public-bucket findings introduced by the new code paths.
