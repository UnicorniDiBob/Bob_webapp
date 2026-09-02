# Database migrations

Schema changes for Bob are tracked here as **sequential** files named
`NNN_name.sql` (e.g. `015_review_submission.sql`). Running them in order from the
lowest number rebuilds the database schema from scratch on any machine or fresh clone.

**Next free number: 063.**

## The rule

**When you change the database, add the matching `NNN_*.sql` file in the same commit
as the code that depends on it.** The live Supabase database and this folder are not
linked automatically — applying a change through the Supabase dashboard/tools does *not*
create the file here. If you skip it, the repo silently falls behind the live schema and
another machine rebuilding from this folder will produce a broken database.

Use the next sequential number and a short snake_case name.

## Checking for drift — run the rebuild, don't read the list

```bash
./scripts/schema_check.sh
```

It builds an empty Postgres 16, applies the platform shim, replays every file in
this folder in order, and prints an eight-row fingerprint of the result. Then run
`scripts/schema_fingerprint.sql` against production and compare the eight rows.
Same fingerprints = a fresh clone reproduces production.

**Why not `supabase db diff`:** the CLI matches files to applied migrations by a
`<timestamp>_name.sql` filename, and this folder uses `NNN_name.sql`. There is
also no `supabase/config.toml`. The CLI can't pair the two, so its diff is not a
usable check here. The rebuild script is the check that fits the convention this
repo actually uses.

**Last verified: 8 August 2026** — `001` → `049` applies with 0 errors on an
empty Postgres, and all eight categories match production exactly: columns
(310), constraints (146), indexes (82), policies (83), tables and RLS flags (32),
triggers (11), event triggers (1), functions (15 after `048`).

## Live history vs this folder

The applied-migration history in `supabase_migrations.schema_migrations` uses
Supabase's own timestamps and does **not** line up name-for-name with these
files. That is expected and harmless — the rebuild above is what matters — but
the mapping is worth writing down, because five live names have no file and one
file has no live row.

| Live history name | Where its content lives here | Note |
|---|---|---|
| `portfolio_pro_limit_1` | `013_pro_portfolio.sql` | Same `portfolio_limit()` body, byte-identical. Was a later tweak, folded back in. |
| `034_verification_public_and_review` | `038_verification_review_and_admin_queue.sql` | Applied as "034", renumbered to 038 here to avoid a collision. |
| `034b_revoke_trigger_function_execute` | `038_…` lines 145–146 | Superseded by `034c`. |
| `034c_fix_revoke_and_insert_policy` | `038_…` (revokes + "Pro creates own profile") | The version that stuck. |
| `036_verification_badge_denormalize` | `038_…` (incl. `professionals_verification_level_idx`) | 036 added a second parallel badge; 037 removed it. |
| `037_reconcile_verification_badge` | `038_…` | 038 declares the end state both left behind. |
| `011_customer_memory.sql` | file only, no live history row | Applied via the SQL editor. The table exists in production. |

Numbering has collided three times (`029` ×2, `034` ×3, `042` ×2). Sorting still
puts them in a valid order — each pair is independent — so they are left as they
are rather than renumbered, which would break every existing clone. Don't add a
fourth.

## Keep migrations idempotent

So they are safe to re-run anywhere:

- `create table ... if not exists`, `add column if not exists`
- `create index if not exists`
- `drop policy if exists ...` before `create policy ...`
- `create or replace function ...`
- `drop trigger if exists ...` before `create trigger ...`

**Six early files predate this rule and break on a second pass** (`001`, `005`,
`010`, `011`, `013`, `014` — bare `create table` / `create policy`). A
first-pass rebuild is unaffected, which is why `schema_check.sh` only replays
once. Fixing them is safe but touches history for no functional gain; do it as
one deliberate commit if you ever want the folder to be re-runnable against a
live database.

## 2026-07-16 backfill note

Files `001`–`010` were reconstructed on this date from the live database's
`supabase_migrations.schema_migrations` table — they existed only as applied
changes, never as files, going back to the project's creation on 2026-06-02.
Files that already existed (`010`–`016` at the time) were renumbered to
`011`–`017` to make room, preserving their original order and content
unchanged. If you have an older local clone with the previous numbering,
re-clone rather than trying to reconcile filenames by hand.

## 2026-08-08 reconciliation note

`047` declares `public.rls_auto_enable()` and the `ensure_rls` event trigger,
which existed in production but in no file. Because `032` revokes EXECUTE on
that function, a fresh clone aborted at `032` and lost everything through `046`
— the folder could not rebuild a database at all. `032`'s revoke is now
conditional. `048` moves the five RLS helper functions into a non-exposed
`private` schema and rewrites the 21 policies that call them, which clears ten
Supabase security-advisor warnings without the breakage the advisor's own
suggested remedy would cause. `049` adds `system_job_runs` so a cron pass that
finds nothing to do still leaves a trace.
