#!/usr/bin/env python3
"""Verify live monitoring endpoints after a release, with bounded startup retries."""
from datetime import datetime, timezone
import json
import time
import urllib.parse
import urllib.request


def get(url):
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.load(response)


last_error = ''
for attempt in range(30):
    try:
        targets = get('http://127.0.0.1:9090/api/v1/targets')['data']['activeTargets']
        jobs = {t['labels']['job'] for t in targets}
        assert jobs == {'host', 'convex', 'caddy', 'prometheus'}, jobs
        assert all(t['health'] == 'up' for t in targets), [(t['labels']['job'], t['health']) for t in targets]
        query = urllib.parse.urlencode({'query': 'probe_success{job="convex"}'})
        probe = get('http://127.0.0.1:9090/api/v1/query?' + query)['data']['result']
        assert len(probe) == 1 and probe[0]['value'][1] == '1', probe
        grafana = get('http://127.0.0.1:3001/api/health')
        assert grafana['database'] == 'ok', grafana
        print(json.dumps({'verifiedAt': datetime.now(timezone.utc).isoformat(),
                          'scrapeTargets': {t['labels']['job']: t['health'] for t in targets},
                          'backendReadinessProbe': True, 'grafanaDatabase': 'ok',
                          'grafanaVersion': grafana.get('version')}))
        break
    except (OSError, ValueError, AssertionError, KeyError) as error:
        last_error = str(error)
        if attempt == 29:
            raise RuntimeError('Monitoring health did not converge: ' + last_error) from error
        time.sleep(3)
