// Apply only function settings. Infrastructure and registry secrets never enter Convex.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const names = ['SITE_URL', 'BETTER_AUTH_SECRET', 'APP_ENVIRONMENT', 'APP_RELEASE', 'EMAIL_TRANSPORT', 'TEST_OUTBOX_TOKEN', 'READINESS_TOKEN'];
const vars = Object.fromEntries(names.filter(name => process.env[name]).map(name => [name, process.env[name]]));
const dir = mkdtempSync(path.join(tmpdir(), 'convex-config-'));
const file = path.join(dir, 'settings.env');
try {
  writeFileSync(file, Object.entries(vars).map(([k,v]) => `${k}=${v}`).join('\n'), {mode: 0o600});
  execFileSync('pnpm', ['exec', 'convex', 'env', 'set', '--force', '--from-file', file], {stdio: ['ignore', 'ignore', 'inherit']});
  console.log(`Configured Convex settings: ${Object.keys(vars).join(', ')}`);
} finally { rmSync(dir, {recursive: true, force: true}); }
