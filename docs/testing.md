# SprintBoard test suites

| Command | Where it runs | Target |
|---|---|---|
| `pnpm lint` | CI quality job | ESLint flat config (`eslint.config.js`), TypeScript + React hooks rules |
| `pnpm typecheck` | CI quality job | `tsc` for web/tests and for `convex/` |
| `pnpm test` / `pnpm test:coverage` | CI quality job and Test Server | Unit tests: `convex/**/*.test.ts` (convex-test, edge runtime) and `src/**/*.test.{ts,tsx}` (jsdom). Coverage gate: 80% lines over `convex/` and `src/` |
| `pnpm test:integration` | Test Server (staging) | Real deployed backend and web app (`tests/integration`) |
| `pnpm test:e2e` | Test Server (staging) | Playwright acceptance suite in Chromium against the deployed app (`tests/e2e`) |

## Target environment (integration and acceptance)

The suites never fall back to a local fixture. They read the staging runtime `.env`:

| Variable | Meaning |
|---|---|
| `SITE_URL` | Public web origin. `E2E_BASE_URL` overrides it. (`BASE_URL` is ignored: Vite/Vitest set it to `/`.) |
| `CONVEX_URL` | Public Convex client URL (`https://api.<domain>`) |
| `CONVEX_SITE_URL` | Convex HTTP actions URL (`https://auth.<domain>`): auth API, `/health/*`, `/test/outbox` |
| `TEST_OUTBOX_TOKEN` | Staging-only bearer token for the test mailbox (verification and reset links) |
| `READINESS_TOKEN` | Optional. Enables the operator write-then-read readiness assertion |
| `TEST_RUN_ID` | Optional but recommended (e.g. the commit SHA or workflow run id). Prefixes every synthetic account |

Missing or relative URLs fail the run immediately with a message naming the variable.

## What is covered

- Integration (16): unverified sign-in refused, anonymous access refused, profile, project list
  isolation, non-member access hidden (NOT_FOUND), add member by email (unknown email rejected),
  owner-only actions (FORBIDDEN), task create/edit/move/filter (status, priority, assignee,
  unassigned)/delete, invalid due date rejected, activity history, leave clears assignments,
  password reset through the mailbox (old password rejected), web liveness, public read-only
  readiness, bad readiness token stays read-only, operator write-then-read (when token present),
  mailbox rejects missing token, backend liveness.
- Acceptance (8): landing shows running release, anonymous redirect, wrong credentials, health
  headers, UI sign-up then email-link verification then sign-out, UI password reset, two-user board
  collaboration (create project, add member, create task with priority/date/assignee, drag and drop
  between columns, keyboard status control, live updates in the second browser, URL filters
  surviving reload, activity, edit, delete, outsider blocked, rename, remove member, typed-name
  project deletion), member leaves a project.

## Test data isolation and reset

Every synthetic account is `qa-<TEST_RUN_ID>-<label>-<n>@example.test` (reserved domain, no real
mailbox). Suites delete the projects they create. After a run, an operator removes the run's
accounts, sessions, credential accounts, memberships, owned projects and mailbox messages:

```
# on the staging host, with CONVEX_SELF_HOSTED_URL / CONVEX_SELF_HOSTED_ADMIN_KEY for staging
pnpm test:cleanup --prefix qa-<TEST_RUN_ID>-     # one run
pnpm test:cleanup --prefix qa-                   # every synthetic QA account
```

`testData:purgeRun` is an internal Convex function (admin key only, no HTTP route). It refuses when
`APP_ENVIRONMENT=production`, rejects prefixes that do not start with `qa-`, and only matches
`@example.test` addresses, so seeded demo accounts (`demo.*`) are never touched.

## Running locally

Point the variables at any self-hosted stack whose backend `SITE_URL` matches the web origin, with
`EMAIL_TRANSPORT=outbox` and a `TEST_OUTBOX_TOKEN` set on the backend, then run
`pnpm test:integration` and `pnpm test:e2e`. The JWT issuer (`CONVEX_SITE_URL` as seen by the
backend container) must be reachable from inside the backend container, otherwise authenticated
calls fail with "Could not fetch JWKS".
