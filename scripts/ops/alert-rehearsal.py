#!/usr/bin/env python3
"""Rehearse a real probe outage and private webhook delivery on a deployed host."""
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import time
import urllib.request


def emit(event, **fields):
    print(json.dumps({'at': datetime.now(timezone.utc).isoformat(), 'event': event, **fields}), flush=True)


def get(path):
    with urllib.request.urlopen('http://127.0.0.1:9090' + path, timeout=5) as response:
        return json.load(response)


runtime = Path('/opt/sprintboard/runtime')
release = json.loads((runtime / 'current.json').read_text())
compose = ['docker', 'compose', '--env-file', str(runtime / '.env'), '-f',
           str(runtime / 'releases' / release['commit'] / 'infra/compose.yml')]
sink = subprocess.check_output(compose + ['ps', '-q', 'alert-sink'], text=True).strip()
started = datetime.now(timezone.utc).isoformat()
emit('outage-start', environment=release['environment'], release=release['commit'])
try:
    subprocess.run(compose + ['stop', 'blackbox'], check=True)
    for attempt in range(42):
        alerts = get('/api/v1/alerts')['data']['alerts']
        firing = [a for a in alerts if a['labels'].get('alertname') == 'ServiceUnavailable' and a['state'] == 'firing']
        receipt = subprocess.run(['docker', 'exec', sink, 'cat', '/events/alerts.jsonl'], capture_output=True, text=True)
        events = [json.loads(line) for line in receipt.stdout.splitlines() if line.strip()]
        delivered = [e for e in events if e['receivedAt'] >= started and e['notification'].get('status') == 'firing'
                     and any(a['labels'].get('alertname') == 'ServiceUnavailable' for a in e['notification'].get('alerts', []))]
        if firing and delivered:
            emit('firing-and-delivered', alerts=firing, receipt=delivered[-1])
            break
        time.sleep(5)
    else:
        raise RuntimeError('No matching real firing alert and webhook receipt within 210 seconds')
finally:
    subprocess.run(compose + ['start', 'blackbox'], check=True)
    emit('probe-restarted')
for attempt in range(30):
    targets = get('/api/v1/targets')['data']['activeTargets']
    alerts = get('/api/v1/alerts')['data']['alerts']
    if all(t['health'] == 'up' for t in targets) and not any(a['labels'].get('alertname') == 'ServiceUnavailable' for a in alerts):
        emit('recovery-verified', targets={t['labels']['job']: t['health'] for t in targets})
        break
    time.sleep(5)
else:
    raise RuntimeError('Probe restart did not restore target and alert health')
