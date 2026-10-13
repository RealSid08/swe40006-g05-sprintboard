# SprintBoard implementation status

Owner: application agent (frontend, backend, tests, draft deck). Parent owns AWS, `infra/`,
`.github/` workflows, `scripts/ops/` and operations files. Runtime contract: `docs/runtime-config.md`.

## Current state (2026-10-20 04:00 local)

Done and verified locally against the parent's Docker backend (127.0.0.1:3410/3411):
- Convex backend: schema, Better Auth (email verification required, password reset), membership
  authorization on every protected function, projects, members (add by email, remove, leave with
  assignment clearing), tasks (create/edit/status/priority/due/assignee/delete, filters), activity feed,
  email transports (outbox/disabled/resend/ses), health routes, operator seed.
- Backend unit tests: 41 passing (`pnpm vitest run --project backend`), convex `tsc` clean.
- Production server: `node server.mjs` serving `dist/`. Verified: `/api/health`, `/api/ready`,
  seeded account sign-in through `/api/auth/*` proxy, JWT issuance, authenticated SSR of `/projects`,
  anonymous redirect to `/sign-in`.
- Auth UI routes, project list, landing page.

Update 2026-10-20 (app agent takeover, Opus 5.5): scope is app/backend/tests/runtime docs only.
Deck, contribution document and demo script moved to a separate task.
- Board route `/projects/$projectId` done: four columns, drag and drop plus per-card status select,
  task create/edit/delete (priority, due date, assignee), URL filters, activity feed, members panel
  (owner add/remove, member leave), owner settings (rename, delete with typed confirmation).
- Demo notice shown on landing/auth pages when the web env has `EMAIL_TRANSPORT=disabled`.
- ESLint flat config added; `pnpm lint` and `pnpm typecheck` clean.
- Integration suite (`pnpm test:integration`, 16 tests) passes against a real self-hosted backend +
  production build. In progress: Playwright, web unit tests/coverage, final gate.

## Integration notes for parent

- Build output is `dist/client` + `dist/server/server.js`, run with `node server.mjs`
  (bundle is self-contained; pruned node_modules are harmless but not needed).
- Env names: web `CONVEX_URL`, `CONVEX_SITE_URL`, optional `CONVEX_INTERNAL_URL`, `APP_ENVIRONMENT`,
  `APP_RELEASE` (`RELEASE_SHA` accepted). Backend adds `READINESS_TOKEN` and `EMAIL_TRANSPORT=disabled`.
- Public readiness no longer writes. Write proof requires header `x-readiness-token` = backend `READINESS_TOKEN`.
- Seed CLI: `pnpm seed:account ...` (see runtime-config.md).
- I accidentally overwrote `.env.local` at 03:46 while starting a temporary local backend; restored at
  03:54 to point at 127.0.0.1:3410 with the key from `.local/convex-admin` (not printed). My temporary
  backend on 3460 is stopped. I set local-backend env vars (SITE_URL, BETTER_AUTH_SECRET, EMAIL_TRANSPORT=outbox,
  APP_ENVIRONMENT=local) on the local Docker backend only.
- Local demo accounts on the local backend: demo.owner@example.test, demo.member@example.test (local only).

## Blockers

None. Not touching `infra/`, `.github/`, `Dockerfile`, `scripts/ops/`.
