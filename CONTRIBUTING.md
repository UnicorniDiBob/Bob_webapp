# Contributing to Bob_webapp

This project moved from a single-founder workflow to a team one — this doc
exists to carry over the rules that were previously just in one person's head.

## Branching & PRs

There's no enforced branch protection on `main` yet — treat it as protected
by convention:

- Branch off `main` (`feature/short-name` or `fix/short-name`).
- Open a PR rather than pushing straight to `main`, even for small changes,
  once more than one person is working in the repo.
- Squash or keep history as you prefer, but the commit that lands on `main`
  should say *why*, not just *what* — see the migration rule below for why
  that matters here specifically.
- Vercel auto-deploys `main` to production on every merge. There's no staging
  environment yet; Vercel preview deployments on PRs are the closest thing to
  one — check the PR's preview URL before merging anything user-facing.

## Before you open a PR

```bash
npm run build   # must pass — this is what Vercel runs
npm run lint     # react/no-unescaped-entities and other ESLint rules are enforced
```

## The one rule that actually matters: schema changes ship with their migration

If your change touches the database in any way — new table, new column, new
policy, new function, new trigger — it **must** ship with a matching
`supabase/migrations/NNN_name.sql` file in the *same commit or PR* as the
code that depends on it.

Why this is non-negotiable: applying a change through the Supabase dashboard
or an ad-hoc script does **not** create a file here automatically. The two
are only connected if someone remembers to do it by hand. This has already
gone wrong twice — once with migrations 015/016 shipping live without files,
and more seriously, the first 10 migrations covering the entire original
schema existed *only* on the live database with zero corresponding files
until it was caught and backfilled on 2026-07-16 (see the git history and
`supabase/migrations/README.md`). A team makes this more likely to happen
again, not less, unless everyone treats it as a hard rule rather than a
reminder to self.

Migrations must be idempotent: `create table if not exists`,
`drop policy if exists ... ; create policy ...`, `create or replace function`,
etc. — see `supabase/migrations/README.md` for the full pattern and how to
check for drift between the repo and the live database.

## Code conventions

- TypeScript, Next.js 14 App Router, Tailwind. Follow existing patterns in
  `src/app` and `src/components` rather than introducing new ones without
  discussion.
- Escape apostrophes/quotes in JSX text — `react/no-unescaped-entities` is
  enforced by ESLint and will fail the build otherwise.
- RLS (row-level security) is how this app enforces access control — almost
  every table has policies rather than relying on application-level checks.
  If you add a table, it needs RLS enabled and explicit policies, or it's
  wide open by default.
- The `[PLACEHOLDER]` legal/company fields in `src/lib/company.ts` are
  intentional and deferred to January 2027 — not a bug, don't "fix" them.

## Verifying UI changes

After anything user-facing ships, check it live on
[www.meetonda.com](https://www.meetonda.com) in both a normal desktop view
and a ~390px mobile viewport — a lot of layout issues only show up at mobile
widths and won't show in a resized desktop browser window.

## Access you'll need

- GitHub: push access to `andreatonda/Bob_webapp`.
- Supabase: a seat on the `Bob_webapp` project (ref `bijgitnulucdzluqjxrx`,
  EU region) to run migrations or inspect data.
- Vercel: a seat on the team project to see deployments and logs.

Ask André for these rather than sharing a single account's credentials —
per-person access makes it possible to tell who changed what later.
