// Operator-only staging workload accounts. Passwords are written to a private file, not stdout.
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const runId=process.env.RUN_ID;
if(!/^[a-z0-9-]+$/.test(runId??'')) throw new Error('RUN_ID must be a unique lowercase rehearsal ID');
if(process.env.APP_ENVIRONMENT!=='staging') throw new Error('Load accounts are restricted to staging');
const accounts=[];
for(let i=0;i<25;i++) {
  const email=`qa-load-${runId}-${i}@example.test`;
  const password=randomBytes(24).toString('base64url');
  execFileSync('pnpm',['exec','convex','run','seed:createVerifiedAccount',JSON.stringify({email,name:`Load user ${i}`,password})],{stdio:['ignore','ignore','inherit']});
  accounts.push({email,password});
}
writeFileSync(process.env.USERS_FILE ?? '/opt/sprintboard/runtime/load-users.json',JSON.stringify(accounts),{mode:0o600});
console.log(JSON.stringify({runId,syntheticAccountCount:accounts.length,credentials:'private file'}));
