#!/usr/bin/env bash
set -euo pipefail
# Execute on target host. Environment secrets are operator provisioned, never in release archives.
environment=${1:?staging or production required}
[[ "$environment" == staging || "$environment" == production ]] || exit 2
: "${RELEASE_SHA:?}" "${WEB_IMAGE:?}"
[[ "$RELEASE_SHA" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$WEB_IMAGE" =~ ^ghcr.io/realsid08/sprintboard-g05@sha256:[a-f0-9]{64}$ ]] || exit 2
runtime=/opt/sprintboard/runtime
mkdir -p "$runtime/releases" "$runtime/evidence"
exec 9>"$runtime/deployment.lock"
flock -w 600 9
release="$runtime/releases/$RELEASE_SHA"
mkdir -p "$release"
cp -R infra scripts convex package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json "$release/"
cp "$runtime/.env" "$release/infra/.env"
chmod 600 "$release/infra/.env"
set -a
# shellcheck source=/dev/null
source "$runtime/.env"
set +a
[[ "$ENVIRONMENT" == "$environment" ]] || { echo "Target environment mismatch" >&2; exit 2; }
[[ $(aws --region us-east-1 sts get-caller-identity --query Account --output text) == 877560905830 ]] || exit 2
export RELEASE_SHA WEB_IMAGE ENVIRONMENT="$environment" APP_RELEASE="$RELEASE_SHA"
compose=(docker compose --env-file "$runtime/.env" -f "$release/infra/compose.yml" --profile application --profile monitoring)
previous=''
[[ ! -f "$runtime/current.json" ]] || previous=$(cat "$runtime/current.json")
start=$(date -u +%FT%TZ)
rollback() {
  local exit_code=$?
  trap - ERR
  printf 'Deployment failed at %s; attempting compatible release rollback\n' "$(date -u +%FT%TZ)" >&2
  if [[ -n "$previous" ]]; then
    local old_sha old_image
    old_sha=$(echo "$previous" | python3 -c 'import sys,json;print(json.load(sys.stdin)["commit"])')
    old_image=$(echo "$previous" | python3 -c 'import sys,json;print(json.load(sys.stdin)["image"])')
    export RELEASE_SHA="$old_sha" WEB_IMAGE="$old_image"
    if [[ -d "$runtime/releases/$old_sha" ]]; then
      cd "$runtime/releases/$old_sha"
      docker run --rm --network host --env-file "$runtime/backend.env" -e APP_RELEASE="$RELEASE_SHA" -v "$PWD:/app" -w /app node:24.22.0-bookworm-slim bash -c 'corepack enable && pnpm install --frozen-lockfile && node scripts/ops/configure_backend.mjs && pnpm exec convex deploy --yes --typecheck=disable'
      docker compose --env-file "$runtime/.env" -f infra/compose.yml --profile application --profile monitoring up -d --no-deps web
      bash scripts/ops/smoke.sh "$SITE_URL" "$old_sha"
      echo "$previous" > "$runtime/current.json"
      printf 'Rollback verified at %s\n' "$(date -u +%FT%TZ)"
    fi
  fi
  exit "$exit_code"
}
trap rollback ERR
cp "$release/infra/compose.yml" "$runtime/compose.yml"
"${compose[@]}" up -d postgres backend
if [[ -n "$previous" ]]; then
  bash "$release/scripts/ops/backup.sh"
fi
"${compose[@]}" pull web
cd "$release"
# Use containerized CLI so remote deployment does not depend on global Node or pnpm.
docker run --rm --network host --env-file "$runtime/backend.env" -e APP_RELEASE="$RELEASE_SHA" -v "$PWD:/app" -w /app node:24.22.0-bookworm-slim bash -c 'corepack enable && pnpm install --frozen-lockfile && node scripts/ops/configure_backend.mjs && pnpm exec convex deploy --yes --typecheck=disable'
"${compose[@]}" up -d --no-deps web caddy node-exporter blackbox prometheus grafana alertmanager alert-sink
python3 scripts/ops/monitoring-smoke.py
bash scripts/ops/smoke.sh "$SITE_URL" "$RELEASE_SHA"
python3 - "$RELEASE_SHA" "$WEB_IMAGE" "$environment" "$start" <<'PY'
import json,sys
from datetime import datetime,timezone
from pathlib import Path
sha,image,environment,start=sys.argv[1:]
r={'commit':sha,'image':image,'environment':environment,'startedAt':start,'healthyAt':datetime.now(timezone.utc).isoformat()}
p=Path('/opt/sprintboard/runtime');(p/'current.json').write_text(json.dumps(r,indent=2));(p/'evidence'/f'{sha}.json').write_text(json.dumps(r,indent=2))
print(json.dumps(r))
PY
ln -sfn "$release" /opt/sprintboard/current
sudo -n install -m 644 "$release/scripts/ops/backup.service" /etc/systemd/system/sprintboard-backup.service
sudo -n install -m 644 "$release/scripts/ops/backup.timer" /etc/systemd/system/sprintboard-backup.timer
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now sprintboard-backup.timer
trap - ERR
