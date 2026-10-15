# Operate the G05 Learner Lab deployment

This runbook describes the technical environment. It is not a submitted project report.

## Account and hosts

All project AWS commands target account `877560905830` in `us-east-1`. The Learner Lab permits `us-east-1` and `us-west-2`. The local operations wrapper checks STS identity before AWS calls. It reads temporary lab credentials from ignored `.local/lab-credentials`, never the unrelated business profiles.

CloudFormation stack: `swe40006-g05`. Staging instance: `i-0f29ac1cd34a328bd`, stable address `98.94.118.124`. Production instance: `i-0ab21e0e346aeb102`, stable address `32.195.104.152`. Dedicated CI instance: `i-012fd7de41c6979cb` (no AWS instance profile or application secrets).

Public app origins:

- Staging: `https://staging.98-94-118-124.sslip.io`
- Production: `https://sprintboard.32-195-104-152.sslip.io`

The corresponding `api.` and `auth.` subdomains route client subscriptions and auth HTTP actions. Caddy obtains public TLS certificates. PostgreSQL and admin deployment endpoints are private. Grafana and Prometheus bind only to host loopback. Elastic IPs preserve these names when the lab stops and starts the hosts.

## Start a demonstration session

1. Sign into AWS Academy and choose **Start Lab**.
2. Check `python3 scripts/ops/lab_aws.py sts get-caller-identity` after refreshing temporary credentials if needed.
3. Check the stack and EC2 instance states through the wrapper. Start only the three G05 instances if the lab has not restarted them.
4. Check each app's `/api/health` and `/api/ready`. Verify the expected release SHA.
5. Check the repository runner is online: `gh api repos/RealSid08/swe40006-g05-sprintboard/actions/runners`.
6. Open the synthetic demo account details in the private `.local/*-demo.env` files. Do not include passwords in recordings or submissions.

Lab sessions expire after four hours. Refresh the session before presenting. The lab can stop EC2 between sessions. Stable IP allocations and EBS volumes still consume budget while hosts are stopped.

## Deploy a release

Pushes to the repository's default project branch run quality checks on the dedicated CI EC2 instance and build an immutable GHCR image. The trusted staging runner deploys that digest and its matching Convex source, then runs unit, real-backend integration, and browser acceptance suites on the Test Server. Production promotion depends on successful staging tests and uses the same image digest.

GitHub refused hosted execution due to an account billing/spending-limit issue. A separate CI EC2 instance now runs builds. It has no AWS instance role and no application secrets. The lab cannot create the OIDC role proposed in the brief. The dedicated staging runner instead uses `LabInstanceProfile` and SSM to deploy production. Only trusted same-repository pull requests can run on the private CI runner. Fork pull requests cannot enter this worker. Pull requests cannot enter the deployment jobs. The repository is private. Only trusted contributors may push to the deployment branch.

Registry authorization for production is short-lived. It travels inside an encrypted private S3 transport object, never in SSM command text. Promotion removes the object and extracted registry configuration after use.

Each host stores private configuration in `/opt/sprintboard/runtime/.env` and `backend.env`. Code releases live under `/opt/sprintboard/runtime/releases/<commit>`. `current.json` records the healthy commit and web digest. The app and backend expose matching release identifiers.

## Inspect monitoring

Forward host loopback ports with the private operator key and recorded host keys:

```
ssh -N -i .local/operator-key -o UserKnownHostsFile=.local/known_hosts \
  -L 127.0.0.1:3425:127.0.0.1:3001 \
  -L 127.0.0.1:3426:127.0.0.1:9090 ec2-user@98.94.118.124
```

Open Grafana on `http://127.0.0.1:3425`; credentials are in the private environment file. Replace the host address to inspect production. Close the tunnel after use.

Node Exporter supplies host counters. Caddy supplies HTTP rate and latency histograms. Blackbox Exporter checks the backend's read-only readiness endpoint. Direct Convex metrics were rejected by Prometheus with `invalid metric type "vmhistogram"`; the deployment uses HTTP probes instead of claiming those metrics were ingested.

Alertmanager delivers notifications to a private webhook receiver retained in the `alert-events` volume. AWS SES access is denied, so notifications are not emailed. A webhook receipt proves internal delivery only.

## Back up and rehearse restoration

`/opt/sprintboard/current/scripts/ops/backup.sh` stops Convex, takes a consistent PostgreSQL dump and Convex storage archive, restarts Convex, records checksums, and uploads an encrypted private S3 package. Backups expire after seven days. The deployment installs a nightly systemd timer and backs up before later releases. Environment secrets are recovered separately from the operator's private configuration.

Run `scripts/ops/restore-rehearsal.sh <backups/staging/timestamp.tar.gz>` on staging from a complete source release. It creates separate Docker volumes and loopback ports3520/3521, restores both data stores, reapplies the same source with local issuer discovery, and verifies checksums, database writes, account authentication, and project read/write. It removes its own containers and volumes on exit. It refuses production backups.

The authentication rebind is required: a copied auth configuration can otherwise fetch the live instance's JWKS and reject a token signed by the restored instance.

## Recover a failed release

The deploy script records the previous compatible release before changing services. A failed deployment check reapplies its Convex functions, starts the previous web digest, and verifies web/backend release identity and database write/read. This supports additive schema changes only. It does not undo destructive data migrations.

Do not claim the five-minute rollback target until the timed rehearsal passes. Raw execution records belong in `../project-implementation/evidence/`.

## Email limitation

AWS SES is unavailable in the Learner Lab due to denied permissions. The demo uses synthetic accounts; real verification and password-reset email delivery is not demonstrated. Production uses `EMAIL_TRANSPORT=disabled`. Staging tests follow links from a protected outbox. That outbox is disabled in production.

## Stop costs after use

Stop the three G05 instances when a live app or pipeline is no longer needed. This pauses both project runners too. Keep the Elastic IPs and data volumes only while stable marking access or recovery is required. Remove the G05 CloudFormation stack when the team no longer needs it; its backup bucket is retained deliberately and needs separate scoped deletion after evidence is preserved.

Never remove the AWS Academy management stack, functions, `LabRole`, or `LabInstanceProfile`. The old `swe40006-task4-board` deployment has already been deleted.
