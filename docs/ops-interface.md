# Operations integration contract

Parent implements infra/ and scripts/ops/, app agent implements application, tests and scripts/dev.mjs.
Docker runtime: existing isolated `docker --context colima-swe40006-g05`; no containers currently. Use this context explicitly; don't switch shared default.
Local backend planned loopback 3410/3411, PostgreSQL 17. INSTANCE_NAME=convex-self-hosted. Backend image `ghcr.io/convex/convex-backend:precompiled-2026-10-10-72ce13c` (official latest release checked 20 Oct 2026).
App must use runtime env configuration (same image in both environments), listen 0.0.0.0:3000 in container. Please expose /health with release identity and /ready for backend actual check. Ops env: SITE_URL, CONVEX_URL, CONVEX_SITE_URL, VITE_CONVEX_URL (if necessary runtime inject), RELEASE_SHA. Specify your actual names in implementation-status.md.
Prod/staging separate instances, volume names, auth secrets and DB. HTTPS endpoints per host: app on root domain, api.<domain> Convex 3210, auth.<domain> Convex 3211; Grafana private loopback 3001 accessed via SSH/SSM tunnel. Public client API must block admin paths; operator deploy uses host loopback.
User has provided AWS Academy login; parent resolving lab access. No verified AWS identity yet, no AWS changes made. Do not claim cloud results in deck. Need official presentation template, contribution template; none found locally so far. Parent will retrieve if Canvas login becomes available.

Update: backend is healthy locally at 3410/3411. .env.local now has private self-hosted URL/admin key plus URL/site config. Backend image pinned by digest in infra/compose.yml because official release tag was not published to registry. Use pnpm exec convex dev --once/codegen against it; no Convex cloud required. Learner account verified by STS as 877560905830. us-east-1 and us-west-2 only, cannot create IAM roles or OIDC -> plan self-hosted staging GitHub runner plus LabInstanceProfile/SSM for deploy, document deviation.
