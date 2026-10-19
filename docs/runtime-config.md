# SprintBoard runtime configuration contract

One web image serves every environment. Nothing environment-specific is baked in at build time.

## Build and run (web)

- Build: `pnpm build` (= `vite build`). Output: `dist/client/` (static assets) and
  `dist/server/server.js` (fetch handler). The SSR bundle is self-contained (all deps bundled,
  `ssr.noExternal: true` for builds), so production `node_modules` are not required at runtime.
- Run: `node server.mjs` (repo root). Needs `server.mjs`, `dist/`, and `package.json`
  (`"type": "module"`, avoids a Node module-type warning). Listens on `HOST` (default `0.0.0.0`)
  and `PORT` (default `3000`). Graceful shutdown on SIGTERM.
- Honors `X-Forwarded-Proto` / `X-Forwarded-Host` from Caddy.

## Web container environment

| Name | Required | Meaning |
|---|---|---|
| `CONVEX_URL` | yes | Public Convex client URL used by browsers (e.g. `https://api.<domain>`). Embedded in HTML at request time. |
| `CONVEX_SITE_URL` | yes | Convex HTTP-actions URL used **server-side** by the auth proxy and readiness (may be a private address, e.g. `http://backend:3211`). |
| `CONVEX_INTERNAL_URL` | no | Server-side override for SSR Convex queries (e.g. `http://backend:3210`). Defaults to `CONVEX_URL`. |
| `APP_ENVIRONMENT` | no | `local`, `test`, `staging`, `production`. Shown in the footer and health output. |
| `APP_RELEASE` | no | Release identifier (commit SHA). `RELEASE_SHA` is accepted as a fallback. |
| `HOST`, `PORT` | no | Bind address. |

`VITE_*` variables are **not** used. `SITE_URL` is a Convex backend variable, not a web one.

Browser auth requests go to the web origin (`/api/auth/*`) and are proxied server-side to
`CONVEX_SITE_URL`, so the public `auth.<domain>` endpoint is not needed by the browser. It is
harmless to keep it.

## Convex backend environment (set with `npx convex env set NAME=value`)

| Name | Required | Meaning |
|---|---|---|
| `SITE_URL` | yes | Public web origin, e.g. `https://sprintboard.44-204-23-168.sslip.io`. Better Auth base URL and trusted origin; email links point here. |
| `BETTER_AUTH_SECRET` | yes | 32+ random bytes, unique per environment. |
| `APP_ENVIRONMENT` | yes | `staging` or `production` (production refuses `EMAIL_TRANSPORT=outbox`). |
| `APP_RELEASE` | no | Convex function release id (commit SHA), reported by `/health/*`. |
| `EMAIL_TRANSPORT` | yes | `outbox` (store links for tests; staging/local only), `disabled` (drop emails; demo deployments with seeded verified accounts), `resend`, `ses`. |
| `TEST_OUTBOX_TOKEN` | staging only | 16+ chars. Enables `GET <site>/test/outbox?email=&kind=verify_email|reset_password` with `Authorization: Bearer`. Disabled in production and unless transport is `outbox`. |
| `READINESS_TOKEN` | recommended | 16+ chars. Operator header `x-readiness-token` turns readiness into a write-then-read proof. |
| `EMAIL_FROM`, `RESEND_API_KEY` | resend only | Not used in this deployment. |
| `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `SES_SESSION_TOKEN` | ses only | Not usable: SES is denied in the Learner Lab. |

Recommended for this project (SES AccessDenied verified by parent):
- staging: `EMAIL_TRANSPORT=outbox` + `TEST_OUTBOX_TOKEN` (acceptance tests follow verification and reset links).
- production: `EMAIL_TRANSPORT=disabled`; operator seeds verified synthetic accounts.

## Health endpoints

| Path | Writes? | Meaning |
|---|---|---|
| web `/health`, `/api/health` | no | Web process up and config valid. `{ok, service, environment, release}` |
| web `/ready`, `/api/ready` | no (public) | Calls backend `/health/ready`; 200 only if the backend answered a real DB read. Forwards `x-readiness-token`. `{ok, web:{environment,release}, backend:{...}}` |
| convex site `/health/live` | no | `{ok, environment, release}` |
| convex site `/health/ready` | only with valid `x-readiness-token` | Public: read-only query (`mode: "read"`, `lastWriteProofAt`). Operator: increments one bounded probe row then reads it back (`mode: "write-read"`, `probeCount`). |

Smoke example (operator, on host): `curl -H "x-readiness-token: $READINESS_TOKEN" https://<app>/api/ready` expects `backend.mode == "write-read"`.

## Operator seeding (synthetic verified accounts)

Internal Convex functions, callable only with the deployment admin key. No public route exists.

```
export CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 CONVEX_SELF_HOSTED_ADMIN_KEY=...   # host loopback
SEED_ACCOUNT_PASSWORD='...' pnpm seed:account --email demo.owner@example.test --name "Demo Owner"
SEED_ACCOUNT_PASSWORD='...' pnpm seed:account --email demo.member@example.test --name "Demo Member"
pnpm seed:account --demo-project --owner demo.owner@example.test --member demo.member@example.test
```

Idempotent: re-running resets the password and keeps the account verified.
`SEED_ACCOUNT_PASSWORD` (12+ characters) is required and is never printed; the CLI outputs only
`{email, created}`. Without the CLI, the equivalent is `npx convex run seed:createVerifiedAccount '{"email":"...","name":"...","password":"..."}'`.

## Deploying Convex functions

`npx convex deploy` (or `convex dev --once`) with `CONVEX_SELF_HOSTED_URL` and
`CONVEX_SELF_HOSTED_ADMIN_KEY`. Schema changes are additive only.
