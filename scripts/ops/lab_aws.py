#!/usr/bin/env python3
"""Pinned-account AWS client; credentials stay in ignored local storage."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
ACCOUNT = '877560905830'

def call(service, operation, *args, region='us-east-1', check=True):
    env = os.environ.copy()
    env['AWS_SHARED_CREDENTIALS_FILE'] = str(ROOT / '.local/lab-credentials')
    env['AWS_PAGER'] = ''
    result = subprocess.run(['aws', '--profile', 'task-lab', '--region', region,
                             service, operation, *args, '--output', 'json'],
                            env=env, text=True, capture_output=True)
    if result.returncode:
        if check:
            raise RuntimeError(result.stderr.strip())
        return {'error': result.stderr.strip()}
    return json.loads(result.stdout) if result.stdout.strip() else {}

def verify():
    identity = call('sts', 'get-caller-identity')
    if identity['Account'] != ACCOUNT:
        raise RuntimeError('Refusing operation outside verified Learner Lab account')
    return identity

if __name__ == '__main__':
    verify()
    print(json.dumps(call(*sys.argv[1:]), indent=2))
