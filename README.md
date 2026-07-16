# Bob_webapp — meetonda.com

Customer-first services marketplace. Next.js 14, TypeScript, Tailwind, Supabase, deployed on Vercel.

- **Live site:** https://www.meetonda.com
- **Repo:** github.com/andreatonda/Bob_webapp (branch `main`)
- **Supabase project:** `bijgitnulucdzluqjxrx` (EU region)
- **Vercel project:** `bob-webapp`, auto-deploys on push to `main`

## Getting started

```bash
git clone git@github.com:andreatonda/Bob_webapp.git
cd Bob_webapp
npm install
cp .env.example .env.local   # fill in the real keys, see below
npm run dev
```

App runs at `http://localhost:3000`.

### Environment variables

See `.env.example` for the full list. You'll need, at minimum:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase → Project Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — same location; used server-side only (e.g. creating CS accounts without email confirmation)
- `ANTHROPIC_API_KEY` — optional; without it, Bob's AI features fall back to rule-based behavior
- `NEXT_PUBLIC_SITE_URL` — used for SEO metadata

## Contributing

More than one person now works on this repo — see [CONTRIBUTING.md](./CONTRIBUTING.md)
for branching, PRs, and the migration rule below in more detail.

## Database & migrations

Schema changes live in `supabase/migrations/` as sequential `NNN_name.sql` files — see
`supabase/migrations/README.md` for the full rule. In short:

- **Every schema change ships with a matching migration file in the same commit** as the code that depends on it.
- Migrations must be idempotent (`if not exists`, `drop ... if exists` before `create`).
- Vercel deploys on push but **does not run migrations** — those are applied to Supabase separately (dashboard, CLI, or MCP tooling) and must always be mirrored here. If a change is applied live without a matching file, the repo silently drifts from production — check `supabase_migrations.schema_migrations` on the live DB against this folder if in doubt.

## Conventions

- Escape apostrophes/quotes in JSX text — `react/no-unescaped-entities` is enforced by ESLint (`npm run lint`).
- The `[PLACEHOLDER]` legal/company fields in `src/lib/company.ts` are intentional, deferred to January 2027 — not a bug.
- After any UI change ships, verify it live on both desktop and a 390px mobile viewport before considering it done.

## Scripts

```bash
npm run dev     # local dev server
npm run build   # production build (also what Vercel runs)
npm run start   # run a production build locally
npm run lint    # ESLint
```

## Deploying

```bash
npm run build   # sanity-check the build locally first
git add -A
git commit -m "..."
git push origin main   # Vercel auto-deploys from here
```
