# SprintBoard · SWE40006 G05

A shared task board backed by self-hosted Convex and PostgreSQL. The delivery
workflow builds an immutable web image, deploys it to a separate AWS staging
server, runs automated suites there, then promotes the tested digest to production.

## Project locations

- [Delivery workflow](.github/workflows/delivery.yml)
- [Architecture, AWS operation and recovery](docs/operations.md)
- [Runtime variables and synthetic account seeding](docs/runtime-config.md)
- [Test suites and scoped cleanup](docs/testing.md)
- [Assessment requirements and original feedback](docs/project-requirements.md)
- Presentation, raw evidence and demo artifacts: `../project-implementation/`

## Development

Use Node24 (see `.nvmrc`) and the pinned pnpm version from `package.json`.
Run `pnpm install --frozen-lockfile`. Private `.env.local` supplies the local
self-hosted backend URL/admin key and public web configuration described in the
runtime contract. The local Docker backend and PostgreSQL use `infra/compose.yml`;
on this Mac use the dedicated `colima-swe40006-g05` context. Never change the
shared default Docker context. Local issuer discovery needs the setting described
at the end of the runtime contract.

Run `pnpm dev` for the local backend watcher and web server on loopback port3417.
Stop both with Ctrl-C. `pnpm build && pnpm start` runs the production web build.
Run lint, typecheck and coverage before delivery. Integration and browser suites
need a running backend and web server with the protected staging outbox enabled.

## Demonstration boundary

AWS SES is unavailable in the Learner Lab due to denied permissions. The demo
uses synthetic accounts; real verification and password-reset email delivery is
not demonstrated. Staging acceptance tests follow links in a protected outbox.
Production has that helper disabled and uses operator-seeded verified accounts.

The presentation files are AI-generated working drafts. The course assignment
requires the team to rewrite the content before submission. Team contributions
and signatures must be completed truthfully by the members. Nothing is submitted
to Canvas automatically.
