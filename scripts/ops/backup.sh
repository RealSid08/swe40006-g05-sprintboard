#!/usr/bin/env bash
set -euo pipefail
runtime=/opt/sprintboard/runtime
set -a
# shellcheck source=/dev/null
source "$runtime/.env"
set +a
: "${BACKUP_BUCKET:?}"
[[ $(aws sts get-caller-identity --query Account --output text) == "${AWS_ACCOUNT_ID:?set pinned AWS account}" ]] || exit 2
cd "$runtime"
compose=(docker compose --env-file .env -f compose.yml)
backup=$(mktemp -d "$runtime/backup.XXXXXX")
chmod 700 "$backup"
restart_backend() { "${compose[@]}" start backend >/dev/null; }
trap restart_backend EXIT
"${compose[@]}" stop backend
"${compose[@]}" exec -T postgres pg_dump -U convex -Fc convex_self_hosted > "$backup/postgres.dump" < /dev/null
backend=$("${compose[@]}" ps -aq backend)
docker run --rm --volumes-from "$backend":ro -v "$backup:/backup" alpine:3.22 tar -czf /backup/convex.tar.gz -C /convex/data .
"${compose[@]}" start backend
trap - EXIT
cd "$backup"
sha256sum postgres.dump convex.tar.gz > SHA256SUMS
stamp=$(date -u +%Y%m%dT%H%M%SZ)
tar -czf "$runtime/backup-$stamp.tar.gz" postgres.dump convex.tar.gz SHA256SUMS
aws s3 cp "$runtime/backup-$stamp.tar.gz" "s3://$BACKUP_BUCKET/backups/$ENVIRONMENT/$stamp.tar.gz" --sse AES256 --only-show-errors
printf 'Consistent backup uploaded: %s %s\n' "$ENVIRONMENT" "$stamp"
rm -rf "$backup"
rm -f "$runtime/backup-$stamp.tar.gz"
