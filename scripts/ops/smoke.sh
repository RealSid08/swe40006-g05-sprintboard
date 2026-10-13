#!/usr/bin/env bash
set -euo pipefail
base=${1:?HTTPS application URL required}
sha=${2:?Expected release required}
[[ "$base" == https://* ]] || { echo 'Public smoke requires HTTPS' >&2; exit 2; }
for attempt in $(seq 1 40); do
  if curl --fail --silent --show-error --max-time 10 "$base/api/health" > /tmp/sprintboard-health-$$.json; then break; fi
  printf "Health retry %s/40\n" "$attempt" >&2
  sleep 3
done
trap 'rm -f /tmp/sprintboard-health-$$.json' EXIT
python3 - "$sha" /tmp/sprintboard-health-$$.json <<'PY'
import json,sys
r=json.load(open(sys.argv[2]));assert r.get('release') == sys.argv[1],f'Release mismatch: {r}';print(json.dumps(r))
PY
python3 - "$base" "$sha" <<'PYREADY'
import json,os,sys,urllib.request
request=urllib.request.Request(sys.argv[1]+'/api/ready',headers={'x-readiness-token':os.environ['READINESS_TOKEN']})
with urllib.request.urlopen(request,timeout=20) as response:r=json.load(response)
assert r['ok'] and r['backend']['mode']=='write-read',r
assert r['web']['release']==sys.argv[2] and r['backend']['release']==sys.argv[2],r
print(json.dumps(r))
PYREADY
curl --fail --silent --show-error --max-time 20 "$base/" -o /dev/null
