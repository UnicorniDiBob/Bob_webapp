# Appointment location — design and compliance record

_Shipped 2026-07-28 · migration `031_appointment_location.sql` · see `docs/DATA_COMPLIANCE.md` for the governing guideline_

## 1. The gap this closes

The pro calendar showed **when** an appointment was, never **where**. Concretely:

| Appointment source | Where the address lived before | Result for the pro |
|---|---|---|
| `source='direct'` (instant booking) | Nowhere. `request_id` is `NULL` and none of the seeded `subservices.booking_fields` collects an address. | Could not know where to go at all. |
| `source='pro'` with `request_id` | As prose inside `requests.problem_description`, concatenated by `QuoteDialog.tsx:104` (`"… — Indirizzo: <address_line>"`). | Had to read the request description and re-type it. |
| `source='pro'` without `request_id` | Free-text `notes`, by convention only. | Unstructured. |

`appointments` had no location column, so no view could order, group or route by it.

## 2. What was built

- **Migration 031** adds `location_address`, `location_city`, `location_notes` to `public.appointments`, and extends the `appointments_customer_guard` trigger (originally migration 021) so the three new columns are covered by its blacklist.
- **Pro dialog** (`AppointmentDialog.tsx`) gains a *Luogo* section: address, city, access notes.
- **Direct booking** (`InstantBookingDialog.tsx` → `POST /api/pro/instant-book`) now asks the customer where the pro should come, preselecting their default saved address, and the route writes the snapshot server-side.
- **Detail panel** (`AppointmentDetail.tsx`) shows the address, city and access notes with an *Apri in Maps* link.
- **Giro del giorno** (`DayItinerary.tsx`) lists the focused day's stops in time order with travel gaps, overlap warnings, per-stop Maps links and a multi-waypoint route link.

### Snapshot, not a foreign key

`location_*` is a **copy** taken at booking time, deliberately not `customer_address_id → customer_addresses(id)`:

1. An appointment is a job record and must survive the customer editing or deleting the saved address (DATA_COMPLIANCE §6, *"design deletes now, not later"*).
2. An FK would have required a **new RLS policy letting a pro read `customer_addresses`**. Today those four policies (`020:29-44`) are owner-only, and there is value in keeping it that way.

### The customer-guard blacklist

Migration 021's trigger enumerates the columns a customer may **not** change when confirming a proposal. That is a blacklist, so **every future column is modifiable by default** until added to it. 031 recreates the function with the three location columns included. Any migration adding a column to `appointments` must do the same.

## 3. Compliance record

| Item | Determination |
|---|---|
| **Legal basis** | Art. 6(1)(b), performance of the contract. Without the address a house-call cannot be performed. No consent needed, no LIA required. |
| **Purpose** | Not new — already covered by "managing the appointment". No privacy-notice change needed for the purpose itself; the notice should mention that the address is shared with the booked professional. |
| **ROPA row** | *Appointment location* — categories: address, access notes; subjects: customers; recipients: the single booked professional (independent controller for their own use, EDPB 07/2020); basis: 6(1)(b); retention: life of the job record; transfers: none introduced. |
| **Retention** | Inherits the job record's tier (DATA_COMPLIANCE §5 — transaction-linked records up to the limitation period), erased or anonymised with it. No new retention track. |
| **Minimisation** | Free text only. **No coordinates, no geocoding, no third-party processor.** Length-capped server-side (200 / 80 / 300 chars). |
| **DPIA** | Not triggered. No systematic monitoring, no Art. 9 special categories, no automated decision-making, no profiling (§7.3). |
| **New vendor** | None. §8's *"If new vendor: DPA signed, transfer mechanism checked, added to notice"* does not fire. |
| **Progressive disclosure (§4)** | Respected: the address reaches exactly one professional, the one the customer chose and booked. It is not broadcast to a match batch. |

### The Maps links are not a vendor integration

`mapsSearchUrl` / `mapsRouteUrl` in `src/lib/calendar.ts` build plain `google.com/maps` URLs. **Nothing is sent from Bob** — the address reaches Google only if the pro clicks, as the pro's own act, and the pro is an independent controller for the data they have received. No DPA, no transfer analysis, no cookie consent implication for Bob.

## 4. Why there is no map yet

A map with pins needs coordinates, which needs geocoding, which is a **processor** decision: DPA, transfer mechanism, subprocessor list, ROPA row, privacy-notice update and a fresh §7.3 DPIA check. That is roadmap **40.0** (*"Address geocoding enabler — maps vendor DPA/EU"*), scheduled 2027-03.

The schema is deliberately map-ready: a later migration can add a nullable `location_lat` / `location_lng` geocode cache plus a `location_geocoded_at`, with no change to anything built here. `DayItinerary` is the natural mount point — the ordered stop list becomes the map's legend. Vendor choice is deferred to 40.0; the shortlist to evaluate is EU-hosted commercial (MapTiler, Geoapify) versus self-hosted Nominatim + OSM tiles, the latter avoiding a processor entirely at the cost of running the geocoder.

## 5. Known issue, NOT fixed here

**The customer's exact street address is readable by every professional in a quote batch, before the customer accepts anyone.**

Mechanism: `QuoteDialog.tsx:104` writes the address into `requests.problem_description`, and `:128` into `request_messages.message`. The policy `"Pro reads assigned requests"` (`008:17-20`, via `my_assigned_request_ids()`) grants read access to every pro in `request_professionals` — rows the customer's client inserts at `QuoteDialog.tsx:116-132`, i.e. **at send time, before any reply or acceptance**. `/api/pro/request-summary/route.ts:55` then forwards the same string, address included, to the Anthropic API with no stripping (contra DATA_COMPLIANCE §2, *"strip … addresses from prompts"*).

This is the pattern §4 calls *"the most sanctionable"*. It predates this change and is untouched by it. Tracked as roadmap **#41**. Fixing it means changing how the quote flow composes the request, gating a structured address behind acceptance, stripping addresses from the LLM prompt, and backfilling existing rows — deliberately not bundled into a calendar change.

Note also that `docs/DATA_COMPLIANCE.md` is cited by in-repo docs but is not actually committed to the repo; it currently lives only in project knowledge. Worth committing.
