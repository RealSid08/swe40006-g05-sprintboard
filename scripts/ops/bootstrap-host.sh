#!/usr/bin/env bash
set -euo pipefail
role=${1:?ci, staging or production}
[[ "$role" == ci || "$role" == staging || "$role" == production ]] || exit 2
sudo -n cloud-init status --wait >/dev/null
sudo -n dnf install -y libicu git docker jq
sudo -n systemctl enable --now docker
sudo -n usermod -aG docker ec2-user
node_version=24.22.0
archive="node-v${node_version}-linux-x64.tar.xz"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
curl -fsSL "https://nodejs.org/dist/v${node_version}/$archive" -o "$work/$archive"
curl -fsSL "https://nodejs.org/dist/v${node_version}/SHASUMS256.txt" -o "$work/SHASUMS256.txt"
(cd "$work" && sha256sum --check --ignore-missing SHASUMS256.txt)
sudo -n tar -xJf "$work/$archive" -C /opt
for binary in node npm npx; do sudo -n ln -sfn "/opt/node-v${node_version}-linux-x64/bin/$binary" "/usr/local/bin/$binary"; done
sudo -n /usr/local/bin/npm install --global --prefix /usr/local pnpm@12.10.1
sudo -n install -d -o ec2-user -g ec2-user -m 700 /opt/sprintboard/runtime
if [[ "$role" != production ]]; then
  sudo -n install -d -o ec2-user -g ec2-user /opt/actions-runner
  curl -fsSL https://github.com/actions/runner/releases/download/v2.338.0/actions-runner-linux-x64-2.338.0.tar.gz -o "$work/runner.tar.gz"
  echo 'af4b794c1bc41d73d40535e3fe092a39f9679cd8d965954c2aca25a05ca41d32  runner.tar.gz' > "$work/runner.sha256"
  (cd "$work" && sha256sum -c runner.sha256)
  tar -xzf "$work/runner.tar.gz" -C /opt/actions-runner
fi
printf 'Host bootstrap ready: %s\n' "$role"
