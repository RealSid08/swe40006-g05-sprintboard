# SprintBoard · SWE40006 G05

A shared task board backed by self-hosted Convex and PostgreSQL. The delivery
workflow builds an immutable web image, deploys it to a separate AWS staging
server, runs automated suites there, then promotes the tested digest to production.

## Project locations

- [Delivery workflow](.github/workflows/delivery.yml)
- [Architecture, AWS operation and recovery](docs/operations.md)
- [Runtime variables and synthetic account seeding](docs/runtime-config.md)
- [Test suites and scoped cleanup](docs/testing.md)
- [Implementation status and verified results](docs/implementation-status.md)
- [Assessment requirements and brief feedback](docs/project-requirements.md)
- Presentation, raw evidence and demo recording: `../project-implementation/` (start with `HANDOVER.md`)

## Development

Use Node 24 (see `.nvmrc`) and the pinned pnpm version from `package.json`.
Run `pnpm install --frozen-lockfile`. Private `.env.local` supplies the local
self-hosted backend URL/admin key and public web configuration described in the
runtime contract. The local Docker backend and PostgreSQL use `infra/compose.yml`;
on this Mac use the dedicated `colima-swe40006-g05` context. Never change the
shared default Docker context. Local issuer discovery needs the setting described
at the end of the runtime contract.

Run `pnpm dev` for the local backend watcher and web server on loopback port 3417.
Stop both with Ctrl-C. `pnpm build && pnpm start` runs the production web build.
Run lint, typecheck and coverage before delivery. Integration and browser suites
need a running backend and web server with the protected staging outbox enabled.

## Demonstration boundary

AWS SES is unavailable in the Learner Lab due to denied permissions. The demo
uses synthetic accounts; real verification and password-reset email delivery is
not demonstrated. Staging acceptance tests follow links in a protected outbox.
Production has that helper disabled and uses operator-seeded verified accounts.
