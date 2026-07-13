# Database migrations

Schema changes for Bob are tracked here as **sequential** files named
`NNN_name.sql` (e.g. `015_review_submission.sql`). Running them in order from the
lowest number rebuilds the database schema from scratch on any machine or fresh clone.

## The rule

**When you change the database, add the matching `NNN_*.sql` file in the same commit
as the code that depends on it.** The live Supabase database and this folder are not
linked automatically — applying a change through the Supabase dashboard/tools does *not*
create the file here. If you skip it, the repo silently falls behind the live schema and
another machine rebuilding from this folder will produce a broken database.

Use the next sequential number and a short snake_case name.

## Keep migrations idempotent

So they are safe to re-run anywhere:

- `create table ... if not exists`, `add column if not exists`
- `create index if not exists`
- `drop policy if exists ...` before `create policy ...`
- `create or replace function ...`
- `drop trigger if exists ...` before `create trigger ...`

## Checking for drift

Compare what the live database has applied against the files here:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

Any applied change with no corresponding file in this folder is drift. Retrieve its
exact SQL from the `statements` column of that table and save it as the next
sequential file — don't rewrite it from memory.
