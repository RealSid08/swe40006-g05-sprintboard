#!/usr/bin/env python3
"""Record the exact source, runtime and immutable images associated with a release."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[2]
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
image = os.environ['WEB_IMAGE']
assert re.fullmatch(r'ghcr.io/realsid08/sprintboard-g05@sha256:[a-f0-9]{64}', image)
backend = re.search(r'image: (ghcr.io/convex/convex-backend@sha256:[a-f0-9]{64})',
                    (root / 'infra/compose.yml').read_text()).group(1)
def digest(name):
    return hashlib.sha256((root / name).read_bytes()).hexdigest()
print(json.dumps({
    'commit': sha, 'image': image, 'backendImage': backend,
    'convexCliVersion': json.loads((root / 'package.json').read_text())['dependencies']['convex'],
    'nodeVersion': (root / '.nvmrc').read_text().strip(),
    'schemaSha256': digest('convex/schema.ts'),
    'lockfileSha256': digest('pnpm-lock.yaml'),
    'recordedAt': datetime.now(timezone.utc).isoformat(),
}, indent=2))
