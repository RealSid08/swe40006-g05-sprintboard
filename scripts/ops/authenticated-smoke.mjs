import assert from 'node:assert/strict';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
const {SMOKE_BACKEND_URL: backend, SMOKE_SITE_URL: site, DEMO_EMAIL: email, DEMO_PASSWORD: password, SITE_URL: origin} = process.env;
assert(backend && site && email && password && origin);
const response = await fetch(`${site}/api/auth/sign-in/email`, {
  method: 'POST', headers: {'content-type':'application/json', origin},
  body: JSON.stringify({email,password}),
});
assert(response.ok, `Authentication failed HTTP ${response.status}`);
const cookie = response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
const tokenResponse = await fetch(`${site}/api/auth/convex/token`, {headers:{cookie,origin}});
assert(tokenResponse.ok,`JWT issue failed HTTP ${tokenResponse.status}`);
const {token} = await tokenResponse.json();
assert(typeof token === 'string');
const client = new ConvexHttpClient(backend);
client.setAuth(token);
const existing = await client.query(api.projects.list,{});
const name = `Restore proof ${Date.now()}`;
const projectId = await client.mutation(api.projects.create,{name,description:'Temporary authenticated restore rehearsal'});
const project = await client.query(api.projects.get,{projectId});
assert(project?.name === name);
const taskId = await client.mutation(api.tasks.create, {projectId,title:'Smoke verification',description:'Synthetic operational check',priority:'low',dueDate:null,assigneeId:null});
await client.mutation(api.tasks.setStatus,{taskId,status:'done'});
const done = await client.query(api.tasks.list,{projectId,status:'done'});
assert(done.some(task=>task._id===taskId && task.status==='done'));
await client.mutation(api.projects.remove,{projectId,confirmName:name});
console.log(JSON.stringify({authentication:true,target:backend,existingProjectCount:existing.length,authenticatedProjectWriteRead:true,taskStateChange:true,temporaryProjectRemoved:true}));
