# SprintBoard implementation status

Owner: application agent (frontend, backend, tests, draft deck). Parent owns AWS, `infra/`,
`.github/` workflows, `scripts/ops/` and operations files. Runtime contract: `docs/runtime-config.md`.

## Current state (2026-10-20 ~04:45 local): first verified deployable candidate

Scope of this agent: app, backend, tests, runtime docs. Deck, contribution document and demo script
are owned by a separate task.

### Verified locally (production build `node server.mjs` + real self-hosted Convex backend)

- `pnpm lint` clean (ESLint flat config, 76+ files), `pnpm typecheck` clean, `pnpm build` OK.
- `pnpm test:coverage`: 21 files, 128 tests, lines 92.8%, statements 91.6%, branches 90.1%,
  functions 91.4%. No coverage exclusions were added (config unchanged from the backend baseline).
- `pnpm test:integration`: 16/16 against a real backend + production web build.
- `pnpm test:e2e`: 8/8, repeated 3 times with no flakes, Chromium, two-user live collaboration.
- `pnpm test:cleanup --prefix qa-<run>-` removed exactly that run's 12 accounts and 16 mailbox
  messages; a seeded `demo.owner` account still signed in afterwards; non-`qa-` prefix refused.

### Verified against remote AWS staging (backend only; web was 502, not yet deployed)

- `tests/integration/backend.test.ts` + `password-reset.test.ts`: 10/10 passed against
  `https://api.staging.98-94-118-124.sslip.io` / `https://auth.staging.98-94-118-124.sslip.io`
  (backend release `bootstrap`), run prefix `qa-stagingprobe1-`. Those synthetic accounts remain on
  staging until the new `testData` functions are deployed and `pnpm test:cleanup --prefix
  qa-stagingprobe1-` is run.
- Not yet run remotely: `health.test.ts` (needs the staging web) and the Playwright suite.

### Application features (done)

- Board `/projects/$projectId`: four columns (To do, In progress, Review, Done), HTML5 drag and
  drop with optimistic update, per-card keyboard-accessible status select, task create/edit/delete
  (title, description, status, priority, due date, assignee), URL filters (status, priority,
  assignee, unassigned) that survive reload, live activity feed, members panel (owner add by email,
  remove with confirm; member leave with confirm), owner settings (rename, description, delete after
  typing the exact name).
- Demo notice on landing and auth pages when the web env has `EMAIL_TRANSPORT=disabled`: "Email
  delivery is turned off because AWS SES is unavailable in the Learner Lab ... Sign in with a
  provided demo account."
- Bugs found by the new tests and fixed: stale filter closure (quick change after Clear restored old
  filters); reload race where protected queries ran before the session token was applied
  (`useAuthedQuery` in `src/lib/convex.ts`); failed leave/delete errors were lost because the panel
  unmounted (now a toast).
- Security hygiene: `server.mjs` error logs record method + path only (no query strings, which can
  carry verification/reset tokens). Seed CLI requires `SEED_ACCOUNT_PASSWORD` (12+ chars), never
  prints it, outputs only `{email, created}`.

### Not done / limits (truthful)

- Remote staging web health and Playwright not executed yet (staging web returned 502).
- Real email delivery is not demonstrated: AWS SES is denied in the Learner Lab; production uses
  `EMAIL_TRANSPORT=disabled` with operator-seeded verified synthetic accounts.
- No production run of any suite (by design; production has no test helpers).

## Integration notes for parent

- Build output is `dist/client` + `dist/server/server.js`, run with `node server.mjs`
  (bundle is self-contained). Web env: `CONVEX_URL`, `CONVEX_SITE_URL`, optional `CONVEX_INTERNAL_URL`,
  `APP_ENVIRONMENT`, `APP_RELEASE` (`RELEASE_SHA` accepted), and `EMAIL_TRANSPORT` (only `disabled`
  changes behaviour: it shows the demo notice).
- Staging test step: `pnpm test && pnpm test:integration && pnpm test:e2e` works unchanged with the
  runtime `.env` (SITE_URL/E2E_BASE_URL, CONVEX_URL, CONVEX_SITE_URL, TEST_OUTBOX_TOKEN, READINESS_TOKEN).
  Please add `-e TEST_RUN_ID=<sha or run id>` to the test container and, afterwards on the host with the
  staging admin key, `pnpm test:cleanup --prefix qa-<TEST_RUN_ID>-` (see docs/testing.md). Reports:
  `test-results/integration-junit.xml`, `test-results/e2e-junit.xml`, `playwright-report/`,
  failure traces/videos in `test-results/e2e-artifacts/`.
- New Convex functions to deploy: `testData:*` (internal, cleanup; refuses production). No schema
  change, no new env var. Deploy with the existing `convex deploy` step.
- Seed CLI now REQUIRES `SEED_ACCOUNT_PASSWORD` (12+ chars) and never prints credentials.
- Pending remote cleanup: `pnpm test:cleanup --prefix qa-stagingprobe1-` on staging after deploy.
- Backend JWT: the backend container must reach its own `CONVEX_SITE_URL` (JWKS fetch). True on AWS via
  the public auth domain; NOT true for the local compose stack, where `CONVEX_SITE_ORIGIN` is
  `127.0.0.1:3411` (host port) so authenticated calls fail locally with "Could not fetch JWKS". I tested
  locally with my own temporary container mapped to 3210/3211 instead.
- Earlier note: `.env.local` was overwritten at 03:46 by the previous agent and restored at 03:54; not
  changed since. I added `TEST_OUTBOX_TOKEN` and `READINESS_TOKEN` to the parent's local Docker backend
  env (local only). I also re-ran the seed CLI against the parent's local backend at ~04:07, which
  reset the LOCAL passwords of demo.owner/demo.member@example.test (stored privately in
  `.local/app-agent-local-test.env` as LOCAL_DEMO_PASSWORD; re-seed with your own if needed). No AWS
  accounts were re-seeded.

## Blockers

None for the app. Remote web/e2e verification waits on the staging web deploy.
