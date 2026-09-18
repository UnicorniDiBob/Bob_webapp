# Bob — Quote Intake Spec

How a customer submits a request for a preventivo, what a professional needs in order to price it,
and how Bob collects it.

**Status:** draft v1 — 16 September 2026
**Extends:** `Bob_Job_Brief_Spec.md` (the conversational brief). This document covers what happens
*after* the brief identifies the job.
**Scope of v1:** client-side intake only, core five services (idraulico, elettricista, pulizie,
imbianchino, tuttofare), plus a generic fallback for the other ten.
**Not in v1:** the preventivo entity itself (P1.1), the comparison view (P1.10), the assisted
draft generator (P2.11), the per-pro listino (W13). This spec defines the data those four will
consume, and nothing more.

---

## 0. Verified starting state

Measured against production Supabase `bijgitnulucdzluqjxrx` on 16 September 2026. Not from memory,
not from a board.

**Amended 17 September, Phase 3.** The reading below was wrong about *why* the table looks like
this. Left in place rather than rewritten from scratch, because the raw numbers are still real and
still the right evidence — only the causal story attached to them was wrong.

| | |
|---|---|
| `job_briefs` rows | 8, `source = 'ai'` on all eight — **see note below, this is not what it looks like** |
| …with `summary` / `severity` | 7 / 8 |
| …with `subtask_slug` | **0** |
| …with `scope` populated | **0** |
| …with photos | **0** |
| …with `field_meta` | 2 |
| `requests` rows | 10 |
| …with `subservice_id` | **0** |
| …with `brief_id` | 1 |
| `subservices` | 120 rows, 20 with `booking_fields`, 20 `instant_book_eligible` |
| `professional_services` | 13 rows / 6 pros, 4 with `rate_amount`, every `rate_unit = 'hour'` |
| quote / preventivo entity | does not exist (G41) |
| latest migration | `080_verifica_ordine_rinnovo_e_sla` |

**The LLM path in `/api/bob/chat` has never executed, anywhere.** `ANTHROPIC_API_KEY` has never
existed — not in `.env.local`, not on Vercel development, not on Vercel production. Every brief
this project has ever produced, including these eight, came from `ruleBasedDecision` (the
keyword-and-severity fallback in `src/lib/bob.ts`), never from Bob's LLM-driven understanding. The
original reading below blamed the system prompt for asking for "the single most useful scope key"
with no key list attached. That diagnosis is wrong: the prompt was never sent to anything, because
`chat/route.ts`'s `if (!apiKey)` branch fires every single time and returns before the prompt is
even built.

`source = 'ai'` on all eight rows is **not evidence the LLM ran** — it's a second, independent bug.
`BobChat.tsx` never reads the `source` field back from `/api/bob/chat`'s response, and its later
call to `/api/bob/brief` never sends one either, so `brief/route.ts`'s
`body.source === "rules" ? "rules" : "ai"` always sees `undefined` and always falls through to
`"ai"`. That ternary would have written `'ai'` no matter which of the four possible decision paths
produced the brief. The column has never been a trustworthy signal, independent of the key ever
existing.

Given that, 0/8 `subtask_slug` and 0/8 `scope` need no theory about prompt wording at all:
`ruleBasedDecision` only ever sets `serviceSlug`, `severity` and `summary` — it has no branch that
touches `subtaskSlug` or `scope`. Running only that path, every time, produces exactly this table.

**What this changes and what it doesn't.** The structured-intake work this spec describes —
Phases 1-5 — is still correct and still needed: once a real key exists, Bob's LLM path will hit
the same free-form-scope trap the original diagnosis described, because the tool schema and system
prompt genuinely did invite it before Phase 3. But until 17 September this was **untested code
fixing a bug nothing had ever observed happen**, not a fix to observed production behaviour — the
observed behaviour (empty scope, no subtask) had a simpler, complete explanation that had nothing
to do with prompt wording. Two things follow: the fallback's three-months-silent failure mode is
itself worth fixing (proposed, not yet built, as of Phase 3 — a log line per fallback branch, and
threading the real `source` value through so the column stops lying); and Phase 3's acceptance test
— a live conversation ending in a `job_briefs` row with a real `subtask_slug` and non-empty `scope`
— cannot be run until a real `ANTHROPIC_API_KEY` exists somewhere this app can read it.

Nothing needs to be invented for storage. What is missing is a per-sub-task definition of what to
ask, and a UI step that collects it without being a form.

---

## 1. What a professional needs, in four layers

Each layer, missing, forces either a phone call or a padded price.

**Layer 0 — which job.** `service_slug` + `subtask_slug`. "Idraulico" has no price. "Scarico
otturato" does. This is the field that unlocks every other one, and it is 0/8 today.

**Layer 1 — how much of it.** The billable quantity for that sub-task's rate unit. Single largest
driver of the number.

**Layer 2 — the conditions that move the price.** Two or three per sub-task, never more. Access,
state of the existing thing, who supplies materials, disposal, whether a certification is required,
out-of-hours.

**Layer 3 — logistics of quoting.** Coarse location (zone / CAP, never the address — progressive
disclosure, migration 044), when the work must happen, when the customer is reachable, whether a
site visit is possible.

Plus **evidence**: photographs, which frequently satisfy layers 0–2 at once.

### 1.1 Two rules that matter more than the field list

**Every quantity field needs a layperson proxy.** Most people cannot answer "quanti m²". They can
answer "bilocale / trilocale / quattro locali", or "quante stanze". Collect the proxy, store the
derived quantity, and record which of the two the customer actually gave.

**"Non lo so" is a first-class answer on every field.** A declared unknown is worth more to a
professional than a bad guess: it is the signal that says *sopralluogo necessario*, and it is
honest. An unknown must never silently become a number in a quote.

---

## 2. The quotability ladder

A sub-task carries a **default level**. The customer's answers can only ever push it **down**,
toward sopralluogo — never up. This is the rule that keeps Bob from quoting what it cannot quote.

| Level | `quote_level` | What the customer gets | Depends on |
|---|---|---|---|
| 0 | `bookable` | fixed rate, book a slot, no quote | working instant booking + per-pro rate |
| 1 | `range` | a forbice ("tra 180 e 260 €"), labelled a range, never a price | price catalogue (P1.2) + billable quantity |
| 2 | `assisted` | a line-item quote from the pro; Bob pre-fills the draft for paying pros | quote entity (P1.1) + listino (W13) |
| 3 | `survey` | no number; the output is a free site visit | nothing — this is the honest default |

**Pre-check that short-circuits the ladder.** If `red_flags` contains `danno_in_corso` or
`rischio_sicurezza`, or `urgency = 'emergenza'`, the correct output is not a quote at all. It is a
safety line plus immediate dispatch to whoever is available, priced afterwards. Somebody standing
in four centimetres of water does not want a forbice.

**Level 0 is unavailable in the pilot.** Instant booking is broken in four places (C16). Until it
is fixed, every `bookable` sub-task is served as level 1. The column still carries the truth; the
runtime resolver degrades it.

**Level 3 is a feature, not a failure.** "Per questo lavoro serve vedere di persona — ti trovo chi
viene a guardare gratis, senza impegno" is a better experience than an invented number, and it is
exactly what a lead-seller cannot afford to say.

### 2.1 Escalation rules

Evaluated server-side, deterministic, after the scheda is submitted. Any rule that fires lowers the
level; the lowest level wins. Result stored on `requests.quote_mode`.

| Sub-task | Condition | Resulting level |
|---|---|---|
| `tinteggiatura-interni` | `mold_present = true` | `survey` |
| `tinteggiatura-interni` | `mq_approx` unknown **and** no photo | `survey` |
| `tinteggiatura-esterni-facciata` | always (ponteggi, vincoli condominiali) | `survey` |
| `perdita-tubatura-infiltrazione` | always (nothing visible is the point) | `survey` |
| `caldaia-scaldabagno` | `intervento = 'sostituzione'` and model unknown | `survey` |
| `corto-salvavita-scatta` | always (diagnosis precedes price) | `survey` |
| `quadro-elettrico`, `impianto-nuovo-rifacimento`, `messa-a-norma-certificazione` | always | `survey` |
| `rifacimento-impianto-bagno` | always | `survey` |
| any | `property_type = 'ufficio_commerciale'` and quantity unknown | one level down |
| any | building requires scaffolding, demolition, or asbestos-era material | `survey` |

The rules live in one function, not scattered through components, so the reasoning is auditable.
Suggested home: `src/lib/quoting.ts`, pure, unit-tested.

---

## 3. `quote_fields` — the schema

Same shape as the existing `subservices.booking_fields`, which already works, plus four keys.
Stored in a **new column**, not inside `booking_fields`: instant booking is broken and should not be
entangled with this.

```json
{
  "key": "mq_approx",
  "type": "number",
  "unit": "m2",
  "label": "Quanti metri quadri?",
  "required": true,
  "is_billable_unit": true,
  "pro_visible": true,
  "unknown_ok": true,
  "proxy": {
    "label": "Non li so — quante stanze?",
    "type": "select",
    "options": ["monolocale", "bilocale", "trilocale", "quattro locali o più"],
    "derive": { "monolocale": 40, "bilocale": 60, "trilocale": 85, "quattro locali o più": 115 }
  },
  "photo_prompt": "Fammi una foto di ogni stanza da un angolo, così stimo io la superficie.",
  "ask_if": null
}
```

| Key | Meaning |
|---|---|
| `key` | stable name; becomes the key in `scope`. Never renamed once live |
| `type` | `number` \| `bool` \| `select` \| `text` |
| `unit` | display unit, and the unit the listino will price against |
| `required` | required to leave `assisted`; never required to submit the request |
| `is_billable_unit` | the quantity the price multiplies |
| `pro_visible` | does this travel to the pro before the customer accepts (progressive disclosure) |
| `unknown_ok` | offer "non lo so". Default true. Set false only where the customer certainly knows |
| `proxy` | the layperson alternative and how to derive the real value from it |
| `photo_prompt` | the exact shot that would answer *this* field. Shown when the customer says "non lo so" |
| `ask_if` | show only when another answer makes it relevant, e.g. `{"fixture": "caldaia"}` |

**Hard limit: six fields per sub-task,** at most three `required`. If a seventh feels necessary,
the sub-task is probably level 3 and the honest answer is a site visit.

### 3.1 Server-side validation

- `scope` keys must exist in that sub-task's `quote_fields`. Unknown keys rejected, not stored.
  This is what today's code lacks and why `scope` is empty.
- Free-text values screened for anything resembling an address, phone number or email. The scheda
  must not become a bypass around migration 044.
- Numeric values bounded per field (`mq_approx` between 5 and 2000, etc.). An out-of-range value
  becomes an unknown, not a stored absurdity.
- Merge-with-previous: a filled field never regresses to null.

---

## 4. Field sets for the core five

Written against the canonical slugs. **See §9 — six legacy duplicate slugs must be resolved
first**, or this content gets written twice and the data splits.

### idraulico

| Sub-task | Default level | Fields |
|---|---|---|
| `perdita-rubinetto-sifone` | `assisted` | `fixture`, `leak_active`, `water_shutoff_done`, `part_purchased`, `floor` |
| `scarico-otturato` | `assisted` | `drain_location`, `standing_water`, `tried_products`, `floor` |
| `wc-sanitari` | `assisted` | `intervento`, `item_count`, `part_purchased`, `removal_needed` |
| `caldaia-scaldabagno` | `assisted` | `intervento`, `boiler_model`, `boiler_age`, `last_service`, `fuel` |
| `allaccio-elettrodomestici` | `range` | `appliance`, `connection_exists`, `item_count` |
| `perdita-tubatura-infiltrazione` | `survey` | `where_visible`, `neighbour_involved`, `damage_extent` |
| `rifacimento-impianto-bagno` | `survey` | `mq_approx`, `demolition_needed`, `sanitari_included` |
| `emergenza-allagamento` | pre-check | none — dispatch |

Fully specified, highest volume:

```json
[
  {"key":"fixture","type":"select","label":"Cosa perde?","required":true,
   "options":["rubinetto","sifone sotto il lavello","doccia","wc","non lo so"],
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "photo_prompt":"Fammi una foto di dove esce l'acqua."},
  {"key":"leak_active","type":"bool","label":"L'acqua esce adesso?","required":true,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"water_shutoff_done","type":"bool","label":"Hai chiuso il rubinetto generale?",
   "required":false,"ask_if":{"leak_active":true},"is_billable_unit":false,
   "pro_visible":true,"unknown_ok":true},
  {"key":"part_purchased","type":"bool","label":"Hai già comprato il pezzo di ricambio?",
   "required":false,"is_billable_unit":false,"pro_visible":true,"unknown_ok":true},
  {"key":"floor","type":"number","label":"A che piano?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
   "proxy":{"label":"Piano","type":"select","options":["terra","1-3","4 o più"],
            "derive":{"terra":0,"1-3":2,"4 o più":5}}}
]
```

`caldaia-scaldabagno` is the clearest case for photo extraction: the model plate determines the
spare part, and the spare part is most of the price.

```json
{"key":"boiler_model","type":"text","label":"Marca e modello della caldaia","required":false,
 "is_billable_unit":false,"pro_visible":true,"unknown_ok":true,
 "photo_prompt":"Apri lo sportello della caldaia e fotografa la targhetta: c'è marca e modello, e a me basta quella."}
```

### elettricista

| Sub-task | Default level | Fields |
|---|---|---|
| `presa-interruttore` | `assisted` | `item_count`, `installation_type`, `power_available`, `wall_type` |
| `punto-luce-lampadario` | `assisted` | `item_count`, `point_exists`, `ceiling_height`, `fixture_purchased` |
| `citofono-videocitofono` | `assisted` | `intervento`, `existing_brand`, `units_count` |
| `corto-salvavita-scatta` | `survey` | `frequency`, `power_available`, `when_started` |
| `quadro-elettrico` | `survey` | `intervento`, `panel_age`, `certification_needed` |
| `impianto-nuovo-rifacimento` | `survey` | `mq_approx`, `rooms`, `certification_needed` |
| `messa-a-norma-certificazione` | `survey` | `purpose`, `mq_approx`, `has_old_docs` |
| `emergenza-senza-corrente` | pre-check | none — dispatch |

`installation_type` (`sotto traccia` / `esterno / canalina`) roughly doubles the price and almost
nobody volunteers it. `certification_needed` (dichiarazione di conformità, DM 37/08) is the field
professionals complain is never asked.

### imbianchino

| Sub-task | Default level | Fields |
|---|---|---|
| `tinteggiatura-interni` | `range` | `mq_approx` (+ proxy), `ceiling_included`, `mold_present`, `furniture_to_move`, `dark_to_light`, `ceiling_height` |
| `verniciatura-infissi-ringhiere` | `assisted` | `item_count`, `material`, `current_state` |
| `cartongesso` | `assisted` | `intervento`, `mq_approx`, `insulation_needed` |
| `effetti-decorativi-stucchi` | `survey` | `mq_approx`, `technique`, `reference_photo` |
| `trattamento-muffa` | `survey` | `mq_approx`, `cause_known`, `recurring` |
| `tinteggiatura-esterni-facciata` | `survey` | `mq_approx`, `floors`, `scaffolding_access` |

`dark_to_light` is the field that silently costs a coat of paint. `furniture_to_move` is the one
that silently costs half a day.

### pulizie

| Sub-task | Default level | Fields |
|---|---|---|
| `ordinarie-ricorrenti` | `bookable` → `range` | `mq_approx` (+ proxy), `frequency`, `hours_estimate`, `materials_provided`, `has_pets` |
| `profonda-una-tantum` | `range` | `mq_approx`, `last_deep_clean`, `materials_provided`, `has_pets` |
| `fine-locazione-trasloco` | `range` | `mq_approx`, `empty_property`, `oven_included`, `deadline` |
| `uffici-negozi` | `range` | `mq_approx`, `frequency`, `after_hours`, `wc_count` |
| `vetri-vetrate` | `range` | `window_count`, `both_sides`, `height_access` |
| `post-ristrutturazione` | `assisted` | `mq_approx`, `debris_present`, `paint_residue`, `disposal_needed` |
| `sanificazione` | `assisted` | `mq_approx`, `purpose`, `certificate_needed` |

`materials_provided` is the difference between a rate and a rate plus twelve euros a visit, and it
is the single most common source of dispute in this category.

### tuttofare

| Sub-task | Default level | Fields |
|---|---|---|
| `montaggio-mobili` | `bookable` → `range` | `item_count`, `furniture_type`, `has_instructions`, `packaging_disposal` |
| `mensole-quadri-tende` | `bookable` → `range` | `item_count`, `wall_type`, `materials_provided` |
| `silicone-guarnizioni` | `bookable` → `range` | `item_count`, `removal_needed` |
| `piccole-riparazioni` | `range` | `task_list`, `item_count`, `materials_provided` |
| `serrature-semplici` | `range` | `lock_type`, `locked_out`, `door_type` |
| `zanzariere-tende-da-sole` | `assisted` | `item_count`, `measures_taken`, `type`, `window_type` |

`wall_type` (cartongesso vs muratura vs cemento) changes the tooling and occasionally the
feasibility. `locked_out = true` is a pre-check: that person needs a phone number, not a scheda.

### The other ten services

One generic set, three fields, per service until the editorial pass:

```json
[
  {"key":"what_exactly","type":"text","label":"Cosa ti serve esattamente?","required":true,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":false},
  {"key":"quantity","type":"number","label":"Quante volte / quanti pezzi / quante ore?",
   "required":false,"is_billable_unit":true,"pro_visible":true,"unknown_ok":true},
  {"key":"deadline","type":"text","label":"Entro quando ti serve?","required":false,
   "is_billable_unit":false,"pro_visible":true,"unknown_ok":true}
]
```

Default level `survey` for all ten. Honest, and it costs nothing to improve later.

---

## 5. The scheda lavoro — how the customer submits

Not a form. A form is what the competitors do and it is where their funnels die. Three stages, and
the structured part comes **after** intent is committed, never before.

**A — Conversation, as today.** Free text, max two questions, photo encouraged. Goal:
`service_slug` + `subtask_slug` + `severity`. Output stays a `JobBrief`.

**B — Scheda lavoro: confirm, do not ask.** The recap card from §5 of the Job Brief spec, promoted
from decorative to load-bearing. Bob shows 3–6 fields for that sub-task, **already filled with its
own inference**, each visibly marked as Bob's guess. The customer taps to confirm or taps to
correct. Corrections re-enter as `source: option_click, confidence: high`.

This is the whole trick. "Quanti metri quadri?" against an empty field is work. "Mi sembra un
trilocale, circa 85 m² — confermi?" is one tap.

**C — Optional precision, with an honest meter.** Up to three further fields behind a visible
"Preventivo preciso al 70%" and a skip that is always available. The copy states the trade plainly:
more detail means fewer visits and tighter prices. A legitimate nudge under the rules the project
has already set for itself. A pre-ticked box, a hidden skip, or a meter that never reaches 100%
would not be.

**Tapping "non lo so" triggers the field's `photo_prompt`,** never a generic "carica una foto".
The specificity is the difference between a photo that answers something and a blurry picture of a
wall.

The scheda is also exactly the artifact the professional receives. One object, three readers: the
customer confirms it, the professional prices from it, ranking learns from it.

---

## 6. Photographs

Two uses, decoupled, with different risk profiles. **Do not couple them.**

**Photo as evidence** — the image travels to the professional with the request. No AI involved, no
risk, and it is already most of the value: fewer blind site visits is the thing a professional will
pay for. Ships regardless of any test result.

**Photo as data** — Bob extracts facts into `scope`. Enabled **one category at a time**, gated on
the calibration test below.

The bar is not raw accuracy, it is calibration: the system must know when it is unsure. A
low-confidence extraction degrades into a question, or travels to the professional as a declared
assumption ("dalla foto sembra una caldaia a camera stagna — da confermare"). A wrong fact is only
damaging when presented as certain. `field_meta` already carries per-field confidence for exactly
this.

### 6.1 What vision can and cannot do

| Category | Expectation | Example |
|---|---|---|
| Identification | strong | boiler make/model from the plate, tap type, frame material, socket standard |
| Condition | strong | mold extent, rust, crack, water damage |
| Counting discrete items | decent | windows, radiators, light points, doors |
| Dimensions in m² | weak — do not ship | route to the proxy question instead |
| Anything behind a wall or under a floor | impossible, and must stay impossible | this is what keeps level 3 honest |

For rooms, three photos from three corners beat one photo badly, and a reference object (an A4
sheet taped to the wall) is worth more than any prompt engineering.

### 6.2 Calibration protocol

Set the bars **before** running it, so the result decides rather than the enthusiasm.

1. Collect 40 photographs across the core five, each with known ground truth. Source: ask the five
   existing professionals for photos of past jobs plus what the job turned out to be and what it
   cost. Free, it is real ground truth, and the conversation doubles as outreach practice.
2. Run each through the production prompt. Compare Haiku against Sonnet in the same harness — a
   single vision call per photo is trivial against the value of a lead, and reading a model plate
   is precisely where the larger model earns its cost.
3. Score the four categories separately.

| Category | Pass bar | Confident-and-wrong ceiling |
|---|---|---|
| Identification | 85% | 5% |
| Condition | 80% | 5% |
| Counting | 80% | 10% |
| Dimensions | not shipped | — |

A category that fails stays off. A category that passes is enabled alone.

### 6.3 Prerequisites, non-negotiable

`/api/bob/chat` has no authentication, no rate limit and no payload cap (G20–G22, P1.5, marked
critical). Making photographs central multiplies that exposure and the bill is Bob's. **Nothing
photo-heavy ships before the rate limit exists.**

EXIF stripping, moderation, and orphan purge must be real rather than specced. A photo of a room
contains faces, documents, and a GPS tag that would go straight through the progressive-disclosure
design that migration 044 exists to enforce.

---

## 7. Plan gating — gate the drafting, never the format

**Every professional can send a structured quote. Paying professionals get it pre-filled.**

If paying professionals sent structured line-item quotes while free ones sent a paragraph, the paid
quote would look better in the comparison view regardless of price, and Bob would be shaping which
offer the customer picks. That is the one thing the positioning says it never does.

The free professional fills six fields himself in four minutes. The Pro subscriber reviews a draft
in forty seconds. The upsell is time, not appearance — and "quote in under a minute from your own
prices" is a claim that can be demonstrated in outreach, where "your quote will look more
professional" is a claim that causes problems.

**Tier:** auto-draft is Bob Pro and above (decision, 16 September 2026). Note that P2.13 still has
the plan matrix unaligned with the public pricing page; this line needs to land in that matrix, not
only here.

**Declaration required.** P.IVA verification is already paid-only, and verification is the first
sort key, so paying professionals already rank above free ones. Auto-draft adds a second paid
advantage on the same surface — response time is a matching signal. Each is defensible alone;
stacked and undeclared they are what P2P Regulation 2019/1150 art. 5 exists for. Both go on the
ranking-parameters page **before outreach starts in October**. Cheap now, expensive afterwards.

**Never auto-send.** A preventivo is a contractual offer and needs a human author — this is also
the project's own level-3 autonomy rule (P2.11). Additionally: require an explicit confirmation on
the price-bearing line, because a draft approvable in one tap will be rubber-stamped, and a bad
draft then becomes a binding offer the professional has to honour. Carry the assumptions into the
quote text ("80 m² dichiarati dal cliente, non verificati") so it can be issued with a conditional
clause.

---

## 8. Data model changes

### Migration 090 — sub-service de-duplication

Prerequisite for everything else. See §9.

### Migration 091 — quote intake

```sql
alter table public.subservices
  add column if not exists quote_level text not null default 'survey'
    check (quote_level in ('bookable','range','assisted','survey')),
  add column if not exists quote_fields jsonb not null default '[]'::jsonb;

alter table public.requests
  add column if not exists scope jsonb not null default '{}'::jsonb,
  add column if not exists quote_mode text
    check (quote_mode in ('bookable','range','assisted','survey','dispatch'));

create index if not exists requests_quote_mode_idx
  on public.requests (quote_mode, created_at desc);
```

Idempotent, per the repo rule. The file goes in the PR **before** it is applied to Supabase, and
the Supabase security advisors run after it.

### Code changes

| File | Change |
|---|---|
| `src/lib/bob.ts` | the `update_job_brief` tool receives the candidate sub-task's `quote_fields` key list; `scope` becomes a constrained object rather than free-form. System prompt stops saying "the single most useful scope key" and starts naming them |
| `src/lib/quoting.ts` (new) | pure resolver: default level + escalation rules + pre-check → `quote_mode`. Unit-tested |
| `src/app/api/bob/chat/route.ts` | validate `scope` keys against `quote_fields`; reject unknown keys and address-shaped strings |
| `src/components/SchedaLavoro.tsx` (new) | stage B and C of §5 |
| `src/components/QuoteDialog.tsx` | write `subservice_id`, `scope`, `quote_mode` onto `requests`. Currently writes none of the three |
| `src/components/RequestDialog.tsx` | same, and inherit the zone/CAP props it still lacks (P1.3) |
| `src/components/ProRequestSummary.tsx` | render the scheda as fields rather than a paragraph; AI label per P2.8 |

---

## 9. Blocker found on 16 September: duplicate sub-service slugs

**Amended 17 September**, after row-by-row verification of the actual collision data in migration
090: the original table below had two mappings wrong. Corrected here rather than left to drift
from what actually shipped — this section is the record of what the catalog does, not what it did
on the day the blocker was found.

The core five carry **six legacy duplicates**, kept during migration 013/014 because professional
profiles may reference them. They split the taxonomy and would double the editorial work.

| Service | Legacy slug | Canonical slug |
|---|---|---|
| idraulico | `riparazione-perdite` | `perdita-rubinetto-sifone` / `perdita-tubatura-infiltrazione` |
| elettricista | `prese-e-interruttori` | `presa-interruttore` |
| elettricista | `messa-a-norma` | `messa-a-norma-certificazione` |
| imbianchino | `imbiancatura-camere` | `tinteggiatura-interni` |
| pulizie | `pulizie-appartamenti` | `ordinarie-ricorrenti` / `profonda-una-tantum` |
| pulizie | `pulizie-uffici-piccoli` | `uffici-negozi` |

**`sostituzione-rubinetteria` is not a duplicate.** The original table treated it as one, mapped to
`perdita-rubinetto-sifone` / `wc-sanitari`. It isn't either: replacing a tap that already works is
a distinct quotable job, not a leak repair and not general sanitary-fixture work. It stays a
canonical sub-task on its own and carries no `superseded_by`.

**`pulizie-appartamenti` maps primarily to `ordinarie-ricorrenti`, not `profonda-una-tantum`.** The
original resolution read the two legacy rows' `booking_fields` being byte-identical to
`profonda-una-tantum`'s as evidence. It wasn't — the rows were cloned from the same seed source,
which produces identical JSON regardless of which job the row is actually about. The legacy pair
splits the taxonomy by **premises type** (appartamenti / uffici piccoli); the canonical set splits
it by **job type** (ricorrente / una tantum) — two different axes, not a matching pair. "Pulizie
appartamenti" priced at 20 €/hour with a 2-hour minimum is ordinary recurring domestic cleaning,
which is what `ordinarie-ricorrenti` is.

Aggravating detail: `pulizie-appartamenti` and `pulizie-uffici-piccoli` are **legacy slugs that
carry `instant_book_eligible = true` and populated `booking_fields`**, while their canonical
equivalents also do. Whichever one a professional's profile points at decides whether they are
bookable. That is currently decided by which demo row happened to be seeded first.

**Resolution:** alias rather than delete. Add `superseded_by uuid references subservices(id)`,
point the legacy rows at the canonical ones, repoint `professionals.subservice_slugs` and any
`requests.subservice_id`, and exclude superseded rows from every read path. Deleting them would
break existing profiles.

**Checked against production on 17 September:** every `professional_services` row this migration
touches belongs to one of the five demo professionals seeded 2 June (`b1000000-...`). FOTOPRO-MILANO,
the one real professional in production, has none of these six slugs. Low stakes today — the
never-invent-a-price discipline in migration 090 is for when that stops being true, not because it
mattered this time.

---

## 10. Compliance gates

Part of "done", per `docs/DATA_COMPLIANCE.md`.

- **Legal basis** Art. 6(1)(b), pre-contractual measures. RoPA row for `requests.scope`; retention
  aligned to `requests`.
- **Art. 9 trap.** `personal-trainer` sub-tasks include `dimagrimento` and
  `posturale-ripresa-infortunio`; a `goal` field collects health data. Either drop it from v1 or
  put it behind an explicit consent gate. It must not arrive by default.
- **Third-party minors.** `ripetizioni` scope describes someone who is usually not the account
  holder and often a minor. Non-identifying only: no name, no school.
- **Progressive disclosure holds inside `scope`.** Server-side rejection of address-, phone- and
  email-shaped values, or the scheda becomes a bypass around migration 044.
- **`pro_visible = false` fields never leave the server** before the customer accepts.
- **AI Act Art. 50**, in force since 2 August 2026: pre-filled guesses must be visibly labelled as
  Bob's inference, not as facts the customer supplied. Photo-derived values likewise.
- **Photo retention:** orphan purge on the existing `pg_cron` job (P1.5), moderation pass before
  storage, EXIF stripped client-side.
- New columns: RLS reviewed, advisors run for both `security` and `performance` after 090 and 091.

---

## 11. Phases

Default track split (CLAUDE.md): André = client and pro interfaces, Lucio = infrastructure,
admin, legal. **Exception for this initiative, decided 17 September 2026:** André owns the
entire quote flow end to end, client side and pro side, including the migrations. The table
below reflects that decision; the default split still governs everything outside this document.

| # | Content | Owner | Done when |
|---|---|---|---|
| 0 | Resolve the six duplicate slugs (migration 090) | André | every read path returns one row per real sub-task |
| 1 | Freeze the field sets for the core five; Art. 9 review | André | this document merged with §4 complete |
| 2 | Migration 091 + seed `quote_level` and `quote_fields` | André | file in PR before applied; advisors clean |
| 3 | `quoting.ts` resolver + tool schema takes the key list + server validation | André | a live chat writes a non-empty `scope` and a non-null `subtask_slug` |
| 4 | Scheda lavoro UI (stages B and C) | André | new `requests` rows carry `subservice_id`, `scope`, `quote_mode` |
| 5 | Pro-side structured render + `quote_mode` badge | André | a professional sees fields, not a paragraph |
| 6 | Photo calibration test, §6.2 | André | four scored categories, bars set beforehand, decision recorded |
| 7 | Editorial pass: remaining ten services | André | every sub-task has at least the generic fallback |

Phases 2–3 are independent of 4, so they can run in parallel. Phase 0 blocks everything.

**Deferred, recorded, accepted:** the per-professional listino stays at W13 rather than being
pulled into pre-October onboarding. Consequence acknowledged on 16 September 2026: the sixty to
eighty professionals recruited from October will have to be re-contacted in December for their
rates.

---

## 12. Open decisions

| # | Question | Blocks |
|---|---|---|
| A | Alias or hard-migrate the six legacy slugs? Alias is safer, leaves dead rows — decided: alias (090) | phase 0, resolved |
| B | `personal-trainer` `goal`: drop, or consent-gate? | phase 1 |
| C | Does the forbice (level 1) ship before the price catalogue P1.2 exists? If not, level 1 degrades to `assisted` in the pilot | phase 3 |
| D | Who writes the ranking-parameters declaration, and before which outreach date? | before October |
