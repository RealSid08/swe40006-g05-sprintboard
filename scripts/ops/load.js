/* global __ENV, __VU, __ITER, open */
// k6 staging baseline:25 authenticated virtual users, each with its own project/task.
// Only phase=steady HTTP metrics describe the five-minute measurement window.
import http from 'k6/http';
import {check, sleep} from 'k6';
import {Rate, Trend} from 'k6/metrics';
const accounts = JSON.parse(open(__ENV.USERS_FILE));
const origin = __ENV.SITE_URL;
const site = __ENV.CONVEX_SITE_URL;
const backend = __ENV.CONVEX_URL;
const failures = new Rate('operation_failures');
const duration = new Trend('operation_duration', true);
const requestDuration = new Trend('request_duration', true);
let previousStatus;
const thresholds = {'operation_failures':['rate<0.01'],'http_req_failed{phase:steady}':['rate<0.01']};
if (__ENV.BASELINE_P95_MS) thresholds.operation_duration = [`p(95)<${Number(__ENV.BASELINE_P95_MS)*1.2}`];
export const options = {scenarios:{baseline:{executor:'constant-vus',vus:25,duration:'5m'}},thresholds,summaryTrendStats:['avg','med','p(95)','max']};
function call(token,path,args,phase,operation) {
  const response=http.post(`${backend}/api/${operation}`,JSON.stringify({path,args,format:'json'}),{headers:{'content-type':'application/json',authorization:`Bearer ${token}`},tags:{phase,name:path}});
  if(phase==='steady') requestDuration.add(response.timings.duration,{operation:path});
  let result;
  try {result=response.json();} catch {return {ok:false,response};}
  return {ok:response.status===200 && result.status==='success',value:result.value,response};
}
export function setup() {
  if(accounts.length!==25) throw new Error('Exactly25 synthetic accounts required');
  const users=[];
  for (let i=0;i<accounts.length;i++) {
    const account=accounts[i];
    const login=http.post(`${site}/api/auth/sign-in/email`,JSON.stringify(account),{headers:{'content-type':'application/json',origin},tags:{phase:'setup'}});
    if(login.status!==200) throw new Error(`Synthetic sign-in failed HTTP ${login.status}`);
    const issued=http.get(`${site}/api/auth/convex/token`,{headers:{origin},tags:{phase:'setup'}});
    if(issued.status!==200) throw new Error('Synthetic token issuance failed');
    const token=issued.json('token');
    const name=`Load rehearsal ${__ENV.RUN_ID} ${i}`;
    const project=call(token,'projects:create',{name,description:'Temporary staging load workload'},'setup','mutation');
    if(!project.ok) throw new Error('Load project creation failed');
    const task=call(token,'tasks:create',{projectId:project.value,title:'Load operation',description:'Synthetic workload',priority:'medium',dueDate:null,assigneeId:null},'setup','mutation');
    if(!task.ok) throw new Error('Load task creation failed');
    users.push({token,projectId:project.value,taskId:task.value,name});
    sleep(1.1);
  }
  return users;
}
export default function(users) {
  const user=users[(__VU-1)%users.length];
  const start=Date.now();
  const read=call(user.token,'tasks:list',{projectId:user.projectId},'steady','query');
  const statuses=['in_progress','review','done','todo'];
  const update=call(user.token,'tasks:setStatus',{taskId:user.taskId,status:statuses[__ITER%4]},'steady','mutation');
  const row=read.ok && Array.isArray(read.value) ? read.value.find(task=>task._id===user.taskId) : undefined;
  const success=!!row && (previousStatus===undefined || row.status===previousStatus) && update.ok;
  if(update.ok) previousStatus=statuses[__ITER%4];
  failures.add(!success);
  duration.add(Date.now()-start);
  check(success,{'board read and task update succeed':value=>value},{phase:'steady'});
  sleep(1);
}
export function teardown(users) {
  for(const user of users) {
    const removed=call(user.token,'projects:remove',{projectId:user.projectId,confirmName:user.name},'cleanup','mutation');
    if(!removed.ok) console.error('Synthetic project cleanup failed');
  }
}
export function handleSummary(data) {
  return { [__ENV.SUMMARY_FILE || '/results/load-summary.json']:JSON.stringify(data,null,2) };
}
