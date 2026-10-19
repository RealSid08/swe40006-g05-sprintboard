#!/usr/bin/env python3
"""Promote tested source/image through S3 and SSM using the instance's lab role.

Registry auth travels only inside an encrypted private, short-lived S3 object, never
in SSM command text, console output, repository files or retained CI artifacts.
"""
import base64
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile
import time


def aws(service, operation, *args):
    p = subprocess.run(['aws', '--region', 'us-east-1', service, operation, *args,
                        '--output', 'json'], text=True, capture_output=True, check=True)
    return json.loads(p.stdout) if p.stdout.strip() else {}


def main():
    assert aws('sts', 'get-caller-identity')['Account'] == '877560905830'
    sha, image = os.environ['RELEASE_SHA'], os.environ['WEB_IMAGE']
    assert re.fullmatch('[0-9a-f]{40}', sha)
    assert re.fullmatch(r'ghcr.io/realsid08/sprintboard-g05@sha256:[0-9a-f]{64}', image)
    instance, bucket = os.environ['PRODUCTION_INSTANCE_ID'], os.environ['RELEASE_BUCKET']
    assert re.fullmatch(r'i-[0-9a-f]+', instance)
    assert re.fullmatch(r'swe40006-g05-backups-[a-z0-9]+', bucket)
    key = f'transport/{sha}-{time.time_ns()}.tar'
    source = subprocess.check_output(['git', 'archive', '--format=tar', sha])
    with tempfile.TemporaryDirectory(prefix='g05-promotion-') as tmp:
        archive = Path(tmp) / 'release.tar'
        archive.write_bytes(source)
        archive.chmod(0o600)
        auth = base64.b64encode(('RealSid08:' + os.environ['GH_TOKEN']).encode()).decode()
        config = json.dumps({'auths': {'ghcr.io': {'auth': auth}}}).encode()
        with tarfile.open(archive, 'a') as tar:
            info = tarfile.TarInfo('.registry/config.json')
            info.mode = 0o600
            info.size = len(config)
            tar.addfile(info, io.BytesIO(config))
        aws('s3api', 'put-object', '--bucket', bucket, '--key', key,
            '--body', str(archive), '--server-side-encryption', 'AES256')
        command = f'''set -eu
install -d -m 700 /opt/sprintboard/deploy/{sha}
cd /opt/sprintboard/deploy/{sha}
aws s3 cp s3://{bucket}/{key} release.tar --only-show-errors
trap 'rm -rf .registry; rm -f release.tar' EXIT
tar -xf release.tar
export DOCKER_CONFIG="$PWD/.registry"
export RELEASE_SHA={sha}
export WEB_IMAGE={image}
bash scripts/ops/deploy.sh production
'''
        try:
            result = aws('ssm', 'send-command', '--instance-ids', instance,
                         '--document-name', 'AWS-RunShellScript', '--parameters',
                         json.dumps({'commands': [command], 'executionTimeout': ['900']}),
                         '--comment', f'G05 promote tested release {sha}')
            command_id = result['Command']['CommandId']
            print(f'Production SSM command: {command_id}', flush=True)
            for _ in range(180):
                time.sleep(5)
                try:
                    outcome = aws('ssm', 'get-command-invocation', '--command-id', command_id,
                                  '--instance-id', instance)
                except subprocess.CalledProcessError:
                    continue
                if outcome['Status'] in ['Pending', 'InProgress', 'Delayed']:
                    continue
                print(outcome.get('StandardOutputContent', ''))
                print(outcome.get('StandardErrorContent', ''))
                if outcome['Status'] != 'Success':
                    raise RuntimeError('Production promotion failed: ' + outcome['Status'])
                return
            aws('ssm', 'cancel-command', '--command-id', command_id, '--instance-ids', instance)
            raise TimeoutError('Production promotion exceeded fifteen minutes')
        finally:
            aws('s3api', 'delete-object', '--bucket', bucket, '--key', key)


if __name__ == '__main__':
    main()
