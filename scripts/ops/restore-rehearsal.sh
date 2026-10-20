#!/usr/bin/env bash
set -euo pipefail
runtime=/opt/sprintboard/runtime
set -a
# shellcheck source=/dev/null
source "$runtime/.env"
set +a
[[ "$ENVIRONMENT" == staging ]] || { echo 'Restore rehearsal is restricted to staging' >&2; exit 2; }
: "${BACKUP_BUCKET:?}"
key=${1:?S3 backup key required}
[[ "$key" == backups/staging/*.tar.gz ]] || exit 2
[[ $(aws sts get-caller-identity --query Account --output text) == "${AWS_ACCOUNT_ID:?set pinned AWS account}" ]] || exit 2
project="g05-restore-$(date +%s)"
work=$(mktemp -d "$runtime/restore.XXXXXX")
chmod 700 "$work"
cp "$runtime/compose.yml" "$work/compose.yml"
cp "$runtime/.env" "$work/.env"
export BACKEND_PORT=3520 AUTH_PORT=3521 ENVIRONMENT=restore
# Rebind issuer discovery to this isolated backend, never the live staging instance.
export CONVEX_URL=http://127.0.0.1:3210 CONVEX_SITE_URL=http://127.0.0.1:3211
compose=(docker compose -p "$project" --env-file "$work/.env" -f "$work/compose.yml")
cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null
  # The directory is created above and contains only this rehearsal's downloaded copy.
  python3 - "$work" <<'PY'
import shutil,sys
from pathlib import Path
p=Path(sys.argv[1]);assert p.parent==Path('/opt/sprintboard/runtime') and p.name.startswith('restore.');shutil.rmtree(p)
PY
}
trap cleanup EXIT
aws s3 cp "s3://$BACKUP_BUCKET/$key" "$work/backup.tar.gz" --only-show-errors
tar -xzf "$work/backup.tar.gz" -C "$work"
(cd "$work" && sha256sum -c SHA256SUMS)
"${compose[@]}" up -d --wait postgres
"${compose[@]}" exec -T postgres pg_restore --single-transaction --clean --if-exists -U convex -d convex_self_hosted < "$work/postgres.dump"
"${compose[@]}" create backend
backend=$("${compose[@]}" ps -aq backend)
docker run --rm --volumes-from "$backend" -v "$work:/backup:ro" alpine:3.22 tar -xzf /backup/convex.tar.gz -C /convex/data
"${compose[@]}" up -d --wait backend
# Authentication configuration contains origin-bound JWKS discovery. Reapply the same
# source release so the restored instance uses its own keys and internal origin.
docker run --rm --network host --env-file "$runtime/backend.env" -e CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3520 -v "$PWD:/app" -w /app node:24.22.0-bookworm-slim bash -c 'corepack enable && pnpm exec convex deploy --yes --typecheck=disable'
python3 - <<'PY'
import json,os,urllib.request
request=urllib.request.Request('http://127.0.0.1:3521/health/ready',headers={'x-readiness-token':os.environ['READINESS_TOKEN']})
with urllib.request.urlopen(request,timeout=20) as response:r=json.load(response)
assert r['ok'] and r['mode']=='write-read',r
print(json.dumps({'restoredDatabaseWriteRead':True,'release':r['release'],'mode':r['mode']}))
PY
if [[ -f "$runtime/demo.env" ]]; then
  docker run --rm --network host --env-file "$runtime/demo.env" --env-file "$runtime/.env" -e SMOKE_BACKEND_URL=http://127.0.0.1:3520 -e SMOKE_SITE_URL=http://127.0.0.1:3521 -v "$PWD:/app" -w /app node:24.22.0-bookworm-slim node scripts/ops/authenticated-smoke.mjs
fi
printf 'Isolated staging restore passed at %s\n' "$(date -u +%FT%TZ)"
