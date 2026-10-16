# Brief for Claude Code — BOB BEE logo + bee mascot

Date: 16 Oct 2026 · Owner: André (track Client/Pro) · Decided with Claude (Cowork) in this session.
Scope: **only the logo and the mascot.** No colour, font or layout changes.

Repo: `/Users/andre/Claude/Projects/Bob/Bob_webapp_git`
Bee asset pack: `/Users/andre/Claude/Projects/Bob/BOBbee/BOB-mascot-asset-pack-v2.0` (read its `README.md` and `asset-manifest.json` first)
Visual reference of the approved logo: `bob-bee-logo-final.html` (attached to the chat; wordmark A + icon M2).

## 0. Before you start

- The local clone is currently on branch `demo-idraulici` with an untracked `supabase/.temp/`. Do not touch that branch's work. Start from main:
  `git switch main && git pull origin main`
- Two tasks, **two branches, two PRs**, in this order. Finish and merge PR 1 before starting PR 2.
- Code comments in Italian, in the same style as the existing files (explain *why*).
- Escape apostrophes/quotes in JSX text (`react/no-unescaped-entities`).
- No database changes, no personal data. No migration needed.

---

## PR 1 — branch `logo-bob-bee`

### 1a. Wordmark — `src/components/Logo.tsx`, function `Logo`
Replace the yellow dot with the word **BEE**:
- "BOB": unchanged (Schibsted Grotesk, weight 900, `tracking-tight`, indigo / white via `tinta`).
- "BEE": colour `bob-yellow` (#fbbf24) on both light and dark backgrounds, **font-size 0.48em of BOB**, weight 800, letter-spacing 0, `margin-left: 0.12em`, **same baseline as BOB** (keep `items-baseline`).
- Both sizes (`normale`, `grande`) scale from the em value, so no separate size table is needed.
- `aria-label="BOB BEE"`; BEE is part of the label, so it is not `aria-hidden`.

### 1b. Square icon — `LogoMark` in the same file
- Indigo tile as today (same sizes and radii).
- Big white **B** shifted slightly left (≈ `translateX(-12%)`).
- Small yellow **B**, weight 900, **0.42em** of the big B, at the **bottom right**, sitting on the big B's baseline (about `right: 14%`, `bottom: 24%` — adjust by eye until the two baselines match exactly).
- `aria-label="BOB BEE"`.

### 1c. Favicon — `src/app/icon.svg`
- Same design as LogoMark (M2). **Convert the letters to paths**: a favicon can't load Schibsted Grotesk.
- At **16px** show **only the big B** (the small B becomes a blob). If one SVG can't do both, add a 16×16 `favicon.ico` with the big B only, and check which file Chrome/Safari actually pick. If you can't get 16px to differ, use M2 everywhere and say so in the PR.

### 1d. Share image — `public/og.png`
Update it to the new wordmark (same size and layout as today).

### 1e. Check
Grep for other places that hard-code the dot or "BOB." (e.g. emails, `manifest`, metadata) and list them in the PR. Fix the ones that are part of the site UI.

---

## PR 2 — branch `mascotte-ape`

### 2a. Assets
- Copy **only the files you use** from the pack's `web/` folder into `public/mascotte/` (AVIF + WebP + PNG fallback, at the widths in the manifest). Don't copy `source/`, `reference/` or `tools/`.
- Keep the pack's file names.

### 2b. Component
- New component `src/components/BobApe.tsx`: a `<picture>` (AVIF → WebP → PNG), with props `posa`, `alt`, `className`, `sizes`, `priorita` (eager + fetchpriority high only for the home hero; everything else `loading="lazy"`).
- Always set `width`/`height` so there is no layout shift.
- Start from the pack's snippet in `component/bob-mascot.html`.
- Allowed poses: `sceglie-strumento`, `benvenuto`, `successo`, `nessun-risultato`, `elettricista`, `pulizie`, `giardinaggio`.

### 2c. Where the man is replaced (checked on origin/main, 16 Oct)

| # | Where | File | Today | Bee pose |
|---|---|---|---|---|
| 1 | Home hero | `src/app/page.tsx` → `BobCheSaluta` | waving | `benvenuto` (priority) |
| 2 | Home + /come-funziona, step 1 | `SceneBob.tsx` → `ScenaRichiesta` | standing | `benvenuto` |
| 3 | Same, step 2 | `ScenaConfronto` | standing + scale | `sceglie-strumento` |
| 4 | Same, step 3 | `ScenaMessaggio` | on the phone | `successo` |
| 5 | Home, lower section | `BobConElenco` | holds phone with pro list | `sceglie-strumento` |
| 6 | /servizi hero | `src/app/servizi/page.tsx` | standing with wrench | `sceglie-strumento` |
| 7 | /per-i-professionisti hero | `BobConCariola` | pushing wheelbarrow | `successo` |
| 8 | /come-funziona, "Come ordiniamo i risultati" | `ScalaDeiMestieri` | 4 men on ladder, scroll animation | `elettricista` + `pulizie` + `giardinaggio` side by side, **no animation** |

Rules for the scenes:
- Keep each section's frame/background (e.g. `Cerchio`) and its size on the page. Replace only the man.
- Remove the props that only made sense with the man (scale, phone, wheelbarrow, money, ladder) **unless** they still read well next to the bee — when unsure, remove and mention it in the PR.
- Alt texts in Italian, describing the bee (e.g. "Bob, l'ape di BOB BEE, ti dà il benvenuto").
- Delete components that become unused (`Bob.tsx`, `BobCheSaluta`, `BobConCariola`, `BobConElenco`, `ScalaDeiMestieri`, unused parts of `SceneBob`). Git history keeps them.
- Mobile: check each scene at 390px wide. The images must not overflow or crop the bee's antennae or feet.

### 2d. Missing poses list (approach B)
Add `docs/MASCOTTE_pose_mancanti.md` listing the poses to generate later from `reference/` in the pack, with where each would go:
- Bee on the phone → rows 4 and 5
- Bee with the scale / comparing → row 3
- Bee pushing a wheelbarrow → row 7
- Bees from behind at work (ladder) → row 8, with the old scroll animation idea
André plans to animate the mascot later; note that here, don't build it now.

---

## Done means (both PRs)

1. `npm run lint` and `npm run build` pass locally; CI passes on the PR.
2. Start the dev server and **check with requests/screens**, not by reading files: `/`, `/come-funziona`, `/servizi`, `/per-i-professionisti`, `/login`, plus header and footer on any page.
3. Merge (whoever opened it merges). Vercel deploys from main.
4. Verify live on **www.meetonda.com**, desktop and **390px mobile** (use the same-origin iframe technique if a resize doesn't give a real mobile viewport).
5. Overwrite `HANDOFF.md` with three lines: what I did, what's half-finished, what changed in production.

If push is not allowed from your session, leave the branch committed locally and give André the exact commands to push it.
