#!/usr/bin/env bash
set -euo pipefail
# Use the CLI directly: the action wrapper's artifact uploader assumes a workspace under HOME.
version=8.30.1
work=$(mktemp -d "${RUNNER_TEMP:-/tmp}/g05-gitleaks.XXXXXX")
cleanup() { python3 - "$work" <<'PY'
from pathlib import Path
import shutil,sys
p=Path(sys.argv[1]);assert p.name.startswith('g05-gitleaks.');shutil.rmtree(p)
PY
}
trap cleanup EXIT
archive="gitleaks_${version}_linux_x64.tar.gz"
base="https://github.com/gitleaks/gitleaks/releases/download/v${version}"
curl --fail --silent --show-error --location "$base/$archive" -o "$work/$archive"
curl --fail --silent --show-error --location "$base/gitleaks_${version}_checksums.txt" -o "$work/checksums.txt"
(cd "$work" && sha256sum --check --ignore-missing checksums.txt)
tar -xzf "$work/$archive" -C "$work" gitleaks
mkdir -p reports/security
"$work/gitleaks" git --redact --no-banner --report-format json --report-path reports/security/gitleaks.json .
