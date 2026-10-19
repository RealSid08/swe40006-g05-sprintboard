# Operations integration contract

The application (`src/`, `convex/`, `tests/`, `scripts/dev.mjs`) and operations (`infra/`, `.github/`, `scripts/ops/`) meet at these points:

- One web image serves every environment. Configuration is injected at run time; see `runtime-config.md`.
- The web container listens on `0.0.0.0:3000`. `/api/health` reports the environment and release; `/api/ready` confirms a real backend database read, or a write and read with the operator token.
- Staging and production are separate EC2 hosts with their own Convex instance, PostgreSQL database, volumes, secrets and DNS names. Each host serves the app on its root domain, the Convex client API on `api.<domain>` (port 3210) and HTTP actions on `auth.<domain>` (port 3211). Admin paths are blocked publicly; operator deployment uses host loopback.
- Grafana (3001) and Prometheus (9090) bind to host loopback and are reached through an SSH tunnel; see `operations.md`.
- Local development uses `infra/compose.yml` with the backend image pinned by digest, on the dedicated `colima-swe40006-g05` Docker context at loopback ports 3410/3411.
- The Learner Lab account cannot create IAM roles or OIDC providers, so a trusted staging runner deploys production through `LabInstanceProfile` and SSM.
