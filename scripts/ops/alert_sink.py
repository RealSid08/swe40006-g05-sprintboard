#!/usr/bin/env python3
"""Private alert webhook receiver used when the Learner Lab denies email services."""
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', '0'))
        if self.path != '/alerts' or not 0 < length <= 65536:
            self.send_error(400)
            return
        try:
            payload = json.loads(self.rfile.read(length))
        except ValueError:
            self.send_error(400)
            return
        event = {'receivedAt': datetime.now(timezone.utc).isoformat(), 'notification': payload}
        with Path('/events/alerts.jsonl').open('a') as output:
            output.write(json.dumps(event) + '\n')
        print(json.dumps({'receivedAt': event['receivedAt'], 'status': payload.get('status'),
                          'alerts': [a.get('labels', {}).get('alertname') for a in payload.get('alerts', [])]}), flush=True)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')


HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
