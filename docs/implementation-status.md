# SprintBoard implementation status

Final state on 20 October 2026, release `12e656f9193db07bdbb26fac8bf2ca35f2f2b70a`. Raw records are indexed in `../../project-implementation/evidence/final-evidence-index.md`.

## Application

- Accounts: registration, email verification, sign-in, sign-out and password reset through Better Auth on self-hosted Convex.
- Projects: the creator owns the project; the owner adds members by email and removes them with confirmation; members may leave, which clears their task assignments but keeps history. The owner can rename a project, and delete it after typing its exact name.
- Board `/projects/$projectId`: four columns (To do, In progress, Review, Done), drag and drop with optimistic updates, a keyboard-accessible status control on each card, and task create, edit and delete (title, description, status, priority, due date, assignee).
- Filters by status, priority, assignee and unassigned are stored in the URL, so they survive reload and can be shared.
- A live activity feed records who changed what, and Convex subscriptions update every open browser.
- Permission boundary: every protected backend function checks project membership; non-members receive `NOT_FOUND`, and owner-only actions return `FORBIDDEN` to members.
- The footer and `/api/health` report the environment and release SHA.
- When `EMAIL_TRANSPORT=disabled`, the landing and auth pages show a notice that email is off because AWS SES is unavailable in the Learner Lab, and direct users to a provided demo account.

## Verified results

| Area | Result |
|---|---|
| Delivery | Three successful automatic releases (runs 39300683725, 39302860056, 39303753383): quality, image, staging tests, then production by digest |
| Tests on the Test Server | 128 unit, 16 integration and 8 Chromium acceptance tests passed |
| Coverage | 92.84% of lines (973 of 1,048) in the CI quality job; coverage scope unchanged from the configured baseline |
| Security | Gitleaks found no leaks; the final image has no HIGH or CRITICAL vulnerabilities |
| Release identity | Staging and production run the same image digest and release |
| Production | Synthetic owner created a task, moved it to Done, and it persisted after reload |
| Timing | Median CI 2 min 45 s; median push to healthy production 8 min 21 s (n = 3) |

## Bugs found by the tests and fixed

- A stale filter closure restored old filters after a quick change following Clear.
- On reload, protected queries could run before the session token was applied; fixed by `useAuthedQuery` in `src/lib/convex.ts`.
- Errors from failed leave or delete actions were lost because the panel unmounted; they now appear as a toast.

## Security hygiene

- `server.mjs` error logs record only the method and path, never query strings, which can carry verification or reset tokens.
- The seed CLI requires `SEED_ACCOUNT_PASSWORD` (12 or more characters), never prints it, and outputs only `{email, created}`.
- `testData:purgeRun` refuses production, only accepts `qa-` prefixes and only matches `@example.test` addresses.

## Limits

- Real email delivery is not demonstrated: AWS SES is denied in the Learner Lab. Production uses `EMAIL_TRANSPORT=disabled` with operator-seeded verified synthetic accounts.
- No automated test suite runs against production, by design; production has no test helpers. Production is verified with health, readiness and a browser check.
- The local Compose backend needs the issuer setting described at the end of `runtime-config.md` for authenticated calls.

Runtime variables are in `runtime-config.md`, the suites in `testing.md`, and AWS operation and recovery in `operations.md`.
